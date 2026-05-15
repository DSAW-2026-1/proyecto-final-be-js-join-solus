import { Router } from 'express'
import { getCart, createOrder, clearCart, getOrders, getAllOrders, getProductById, updateProduct, createNotification, getUserById } from '../data.js'

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

router.get('/orders', authenticate, (req, res) => {
  const orders = getOrders(req.userId)
  res.json({ status: 'success', data: orders })
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
