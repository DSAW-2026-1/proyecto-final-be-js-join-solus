import { Router } from 'express'
import { getCart, createOrder, checkoutOrder, clearCart, getOrders, getSellerOrders, getAllOrders, getProductById, updateProduct, updateOrderStatus, createNotification, getUserById } from '../data.js'

const ORDER_STATUSES = ['PAID', 'PENDIENTE', 'ENVIADO', 'ENTREGADO']

const router = Router()

function authenticate(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'Token requerido' })
  }
  try {
    const payload = JSON.parse(atob(auth.split('.')[1]))
    req.userId = payload.sub
    next()
  } catch {
    return res.status(401).json({ status: 'error', message: 'Token inválido' })
  }
}

router.post('/orders', authenticate, (req, res) => {
  const cart = getCart(req.userId)
  if (!cart || cart.items.length === 0) {
    return res.status(400).json({ status: 'error', message: 'El carrito está vacío' })
  }

  for (const item of cart.items) {
    const product = getProductById(item.product_id)
    if (!product || product.status !== 'ACTIVO') {
      return res.status(400).json({
        status: 'error',
        message: `El producto "${item.title}" ya no está disponible`,
      })
    }
    if (product.stock < item.quantity) {
      return res.status(400).json({
        status: 'error',
        message: `Stock insuficiente para "${item.title}". Disponible: ${product.stock}`,
      })
    }
  }

  for (const item of cart.items) {
    const product = getProductById(item.product_id)
    updateProduct(item.product_id, { stock: product.stock - item.quantity })
  }

  const total = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const order = createOrder(req.userId, cart.items, total)
  clearCart(req.userId)

  const buyer = getUserById(req.userId)
  const buyerName = buyer?.profile?.full_name || buyer?.email || 'Alguien'
  const sellerIds = [...new Set(cart.items.map((i) => {
    const p = getProductById(i.product_id)
    return p?.owner?.id
  }).filter(Boolean))]
  for (const sid of sellerIds) {
    createNotification(sid, 'order', 'Nueva orden recibida', `${buyerName} ha comprado productos de tu tienda`, '/messages')
  }

  res.status(201).json({
    status: 'success',
    message: 'Orden creada exitosamente',
    data: order,
  })
})

router.post('/orders/checkout', authenticate, (req, res) => {
  const { payment_method, bank_name, shipping_address, cart_id } = req.body
  if (!payment_method || !bank_name || !shipping_address) {
    return res.status(400).json({ status: 'error', message: 'payment_method, bank_name y shipping_address son requeridos' })
  }

  const targetUserId = cart_id || req.userId
  if (targetUserId !== req.userId) {
    return res.status(403).json({ status: 'error', message: 'No tienes permiso para usar este carrito' })
  }

  const cart = getCart(targetUserId)
  if (!cart || cart.items.length === 0) {
    return res.status(400).json({ status: 'error', message: 'El carrito está vacío' })
  }

  for (const item of cart.items) {
    const product = getProductById(item.product_id)
    if (!product || product.status !== 'ACTIVO') {
      return res.status(400).json({ status: 'error', message: `El producto "${item.title}" ya no está disponible` })
    }
    if (product.stock < item.quantity) {
      return res.status(400).json({ status: 'error', message: `Stock insuficiente para "${item.title}". Disponible: ${product.stock}` })
    }
  }

  for (const item of cart.items) {
    const product = getProductById(item.product_id)
    updateProduct(item.product_id, { stock: product.stock - item.quantity })
  }

  const total = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  const order = checkoutOrder(req.userId, cart.items, total, payment_method, bank_name, shipping_address)
  clearCart(req.userId)

  const buyer = getUserById(req.userId)
  const buyerName = buyer?.profile?.full_name || buyer?.email || 'Alguien'
  const sellerIds = [...new Set(cart.items.map((i) => {
    const p = getProductById(i.product_id)
    return p?.owner?.id
  }).filter(Boolean))]
  for (const sid of sellerIds) {
    createNotification(sid, 'order', 'Venta realizada', `${buyerName} compró productos de tu tienda. Orden: ${order.id}`, '/messages')
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
})

router.get('/orders', authenticate, (req, res) => {
  const orders = getOrders(req.userId)
  res.json({ status: 'success', data: orders })
})

router.get('/orders/history', authenticate, (req, res) => {
  const role = req.query.role || 'buyer'
  let orders

  if (role === 'seller') {
    orders = getSellerOrders(req.userId)
  } else {
    orders = getOrders(req.userId)
  }

  const data = orders.map((o) => {
    if (role === 'seller') {
      const sellerItems = o.items.filter((item) => {
        const p = getProductById(item.product_id)
        return p?.owner?.id === req.userId
      })
      return {
        order_id: o.id,
        date: o.created_at,
        total: o.total,
        status: o.status,
        items: sellerItems.map((item) => ({
          title: item.title,
          quantity: item.quantity,
          thumbnail: (() => { const p = getProductById(item.product_id); return p?.images?.[0] || null })(),
        })),
        buyer: {
          name: o.buyer_name,
          email: o.buyer_email,
        },
      }
    }

    const uniqueSellers = [...new Map(o.items.map((item) => {
      const p = getProductById(item.product_id)
      return [p?.owner?.id, { name: p?.owner?.name || item.seller_name, email: p?.owner?.email || '' }]
    })).values()]

    return {
      order_id: o.id,
      date: o.created_at,
      total: o.total,
      status: o.status,
      items: o.items.map((item) => ({
        title: item.title,
        quantity: item.quantity,
        thumbnail: (() => { const p = getProductById(item.product_id); return p?.images?.[0] || null })(),
      })),
      seller: uniqueSellers[0] || { name: o.items[0]?.seller_name || 'Desconocido', email: '' },
    }
  })

  res.json({ status: 'success', data })
})

router.patch('/orders/:id/status', authenticate, (req, res) => {
  const { status } = req.body
  if (!status || !ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ status: 'error', message: `Estado inválido. Valores permitidos: ${ORDER_STATUSES.join(', ')}` })
  }

  const order = getAllOrders().find((o) => o.id === req.params.id)
  if (!order) {
    return res.status(404).json({ status: 'error', message: 'Orden no encontrada' })
  }

  const isSeller = order.items.some((item) => {
    const p = getProductById(item.product_id)
    return p?.owner?.id === req.userId
  })

  if (!isSeller) {
    return res.status(403).json({ status: 'error', message: 'No tienes permiso para actualizar esta orden' })
  }

  const updated = updateOrderStatus(req.params.id, status)
  createNotification(order.buyer_id, 'order_status', 'Estado de orden actualizado', `Tu orden ${order.id} cambió a ${status}`, '/orders')
  res.json({ status: 'success', message: 'Estado de orden actualizado', data: updated })
})

router.get('/orders/all', authenticate, (req, res) => {
  const auth = req.headers.authorization
  let isAdmin = false
  try {
    const payload = JSON.parse(atob(auth.split('.')[1]))
    isAdmin = payload.is_admin === true
  } catch {}
  if (!isAdmin) {
    return res.status(403).json({ status: 'error', message: 'Acceso denegado. Se requieren permisos de administrador' })
  }
  const orders = getAllOrders()
  res.json({ status: 'success', data: orders })
})

export default router
