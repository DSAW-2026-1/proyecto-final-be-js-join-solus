import { Router } from 'express'
import { getCart, checkoutOrder, getOrders, getSellerOrders, getAllOrders, getProductById, updateProduct, updateOrderStatus, createNotification, getUserById, prisma } from '../db.js'
import { authenticate } from '../middleware/auth.js'
import { checkoutSchema, orderStatusSchema, orderSchema, validate } from '../validators/index.js'
import { sendOrderConfirmation, sendSellerNotification } from '../email.js'
import { auditLog, LOG_ACTIONS } from '../services/audit.js'

const ORDER_STATUSES = ['PAID', 'PENDIENTE', 'ENVIADO', 'ENTREGADO']

// Idempotency key store (in-memory, reset on restart; use Redis for multi-instance)
const processedKeys = new Map()
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of processedKeys) {
    if (now - entry.timestamp > 3600000) processedKeys.delete(key)
  }
}, 60000)

const router = Router()

router.post('/orders', authenticate, validate(orderSchema), async (req, res) => {
  const cart = await getCart(req.userId)
  if (!cart || cart.items.length === 0) {
    return res.status(400).json({ status: 'error', message: 'El carrito está vacío' })
  }

  for (const item of cart.items) {
    const product = await getProductById(item.product_id)
    if (!product || product.status !== 'ACTIVO') {
      return res.status(400).json({ status: 'error', message: `El producto "${item.title}" ya no está disponible` })
    }
    if (product.stock < item.quantity) {
      return res.status(400).json({ status: 'error', message: `Stock insuficiente para "${item.title}". Disponible: ${product.stock}` })
    }
  }

  for (const item of cart.items) {
    const product = await getProductById(item.product_id)
    await updateProduct(item.product_id, { stock: product.stock - item.quantity })
  }

  const total = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const order = await createOrder(req.userId, cart.items, total)
  await clearCart(req.userId)

  const buyer = await getUserById(req.userId)
  const buyerName = buyer?.profile?.full_name || buyer?.email || 'Alguien'
  const sellerIds = [...new Set(cart.items.map((i) => i.seller_id || '').filter(Boolean))]
  for (const sid of sellerIds) {
    await createNotification(sid, 'order', 'Nueva orden recibida', `${buyerName} ha comprado productos de tu tienda`, '/messages')
  }

  res.status(201).json({ status: 'success', message: 'Orden creada exitosamente', data: order })
})

router.post('/orders/checkout', authenticate, validate(checkoutSchema), async (req, res) => {
  const { payment_method, bank_name, shipping_address, cart_id } = req.body

  // Idempotency: skip if already processed
  const idempotencyKey = req.headers['idempotency-key'] || req.headers['Idempotency-Key']
  if (idempotencyKey && processedKeys.has(idempotencyKey)) {
    return res.json(processedKeys.get(idempotencyKey))
  }

  const targetUserId = cart_id || req.userId
  if (targetUserId !== req.userId) {
    return res.status(403).json({ status: 'error', message: 'No tienes permiso para usar este carrito' })
  }

  const cart = await getCart(targetUserId)
  if (!cart || cart.items.length === 0) {
    return res.status(400).json({ status: 'error', message: 'El carrito está vacío' })
  }

  for (const item of cart.items) {
    const product = await getProductById(item.product_id)
    if (!product || product.status !== 'ACTIVO') {
      return res.status(400).json({ status: 'error', message: `El producto "${item.title}" ya no está disponible` })
    }
    if (product.stock < item.quantity) {
      return res.status(400).json({ status: 'error', message: `Stock insuficiente para "${item.title}". Disponible: ${product.stock}` })
    }
  }

  const total = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0)

  // Atomic transaction: stock decrement + order creation + cart clear
  let order
  try {
    order = await checkoutOrder(req.userId, cart.items, total, payment_method, bank_name, shipping_address)
  } catch (err) {
    return res.status(409).json({ status: 'error', message: err.message || 'Error al procesar el pago. Los fondos no han sido debitados.' })
  }

  // Notifications and emails (outside transaction — can fail independently)
  const buyer = await getUserById(req.userId)
  const buyerName = buyer?.profile?.full_name || buyer?.email || 'Alguien'
  const sellerIds = [...new Set(cart.items.map((i) => i.seller_id || '').filter(Boolean))]
  for (const sid of sellerIds) {
    await createNotification(sid, 'order', 'Venta realizada', `${buyerName} compró productos de tu tienda. Orden: ${order.id}`, '/messages')
  }

  // Enviar emails
  if (buyer?.email) {
    sendOrderConfirmation(buyer.email, buyerName, order.id, cart.items, total)
  }
  const uniqueSellers = [...new Map(cart.items.map((i) => [i.seller_id || i.seller_name, { id: i.seller_id, name: i.seller_name }])).values()]
  for (const s of uniqueSellers) {
    const sellerItems = cart.items.filter((i) => i.seller_id === s.id || i.seller_name === s.name)
    if (s.id) {
      const sellerUser = await getUserById(s.id)
      if (sellerUser?.email) {
        sendSellerNotification(sellerUser.email, sellerUser?.profile?.full_name || 'Vendedor', buyerName, order.id, sellerItems)
      }
    }
  }

  res.status(201).json({
    status: 'success',
    message: 'Pago procesado correctamente',
    data: {
      order_id: order.id,
      transaction_id: order.transaction_id,
      total_amount: order.total,
      status: order.status,
      items: order.items.map((i) => ({ title: i.title, quantity: i.quantity })),
    },
  })

  // Cache for idempotency
  if (idempotencyKey) {
    processedKeys.set(idempotencyKey, { status: 'success', data: { order_id: order.id, transaction_id: order.transaction_id } })
  }

  auditLog({
    action: LOG_ACTIONS.ORDER_CHECKOUT,
    userId: req.userId,
    userEmail: buyer?.email,
    details: { order_id: order.id, total: total, status: order.status },
    ip: req.ip,
  })
})

router.get('/orders', authenticate, async (req, res) => {
  const orders = await getOrders(req.userId)
  res.json({ status: 'success', data: orders })
})

router.get('/orders/history', authenticate, async (req, res) => {
  const role = req.query.role || 'buyer'
  let orders

  if (role === 'seller') {
    orders = await getSellerOrders(req.userId)
  } else {
    orders = await getOrders(req.userId)
  }

  // Batch-load all product IDs in a single query
  const allProductIds = [...new Set(orders.flatMap((o) => (o.items || []).map((i) => i.product_id)))]
  const products = allProductIds.length > 0 ? await prisma.product.findMany({ where: { id: { in: allProductIds } } }) : []
  const productMap = new Map(products.map((p) => [p.id, p]))

  const data = orders.map((o) => {
    const items = (o.items || []).map((item) => {
      const p = productMap.get(item.product_id)
      return { ...item, product: p || null }
    })

    if (role === 'seller') {
      const sellerItems = items.filter((item) => item.product?.owner_id === req.userId)
      const sellerTotal = sellerItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
      return {
        order_id: o.id,
        date: o.created_at,
        total: sellerTotal,
        status: o.status,
        items: sellerItems.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          price: item.price,
          thumbnail: item.product?.images?.[0] || null,
        })),
        buyer: { name: o.buyer_name, email: o.buyer_email },
      }
    }

    return {
      order_id: o.id,
      date: o.created_at,
      total: o.total,
      status: o.status,
      items: items.map((item) => ({
        title: item.title,
        quantity: item.quantity,
        thumbnail: item.product?.images?.[0] || null,
      })),
      seller: (() => {
        const first = items.find((item) => item.product)
        return first?.product
          ? { id: first.product.owner_id, name: first.product.seller_info?.store_name || first.product.owner?.name || first.title }
          : { name: o.items?.[0]?.seller_name || 'Desconocido' }
      })(),
    }
  })

  res.json({ status: 'success', data })
})

router.patch('/orders/:id/status', authenticate, validate(orderStatusSchema), async (req, res) => {
  const { status } = req.body
  if (!status || !ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ status: 'error', message: `Estado inválido. Valores permitidos: ${ORDER_STATUSES.join(', ')}` })
  }

  const allOrders = await getAllOrders()
  const order = allOrders.find((o) => o.id === req.params.id)
  if (!order) {
    return res.status(404).json({ status: 'error', message: 'Orden no encontrada' })
  }

  let isSeller = false
  for (const item of (order.items || [])) {
    const p = await getProductById(item.product_id)
    if (p?.owner_id === req.userId) { isSeller = true; break }
  }

  if (!isSeller) {
    return res.status(403).json({ status: 'error', message: 'No tienes permiso para actualizar esta orden' })
  }

  const updated = await updateOrderStatus(req.params.id, status)
  await createNotification(order.buyer_id, 'order_status', 'Estado de orden actualizado', `Tu orden ${order.id} cambió a ${status}`, '/orders')

  // Emitir evento en tiempo real al comprador
  const io = req.app.get('io')
  if (io) {
    io.to(order.buyer_id).emit('order_status', { order_id: order.id, status })
  }

  res.json({ status: 'success', message: 'Estado de orden actualizado', data: updated })
})

router.get('/orders/all', authenticate, async (req, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ status: 'error', message: 'Acceso denegado. Se requieren permisos de administrador' })
  }
  const orders = await getAllOrders()
  res.json({ status: 'success', data: orders })
})

export default router
