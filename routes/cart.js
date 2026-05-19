import { Router } from 'express'
import { getCart, addToCart, updateCartItem, removeCartItem, clearCart, formatCartResponse } from '../data.js'

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

router.get('/cart/items', authenticate, (req, res) => {
  const cart = getCart(req.userId)
  res.json({ status: 'success', data: formatCartResponse(req.userId, cart) })
})

router.post('/cart/items', authenticate, (req, res) => {
  const { product_id, quantity } = req.body
  if (!product_id) {
    return res.status(400).json({ status: 'error', message: 'product_id es requerido' })
  }

  const cart = addToCart(req.userId, product_id, quantity || 1)
  if (!cart) {
    return res.status(404).json({ status: 'error', message: 'Producto no encontrado' })
  }

  res.json({
    status: 'success',
    message: 'Producto añadido al carrito',
    data: formatCartResponse(req.userId, cart),
  })
})

router.patch('/cart/items/:productId', authenticate, (req, res) => {
  const { quantity } = req.body
  if (quantity === undefined || quantity < 0) {
    return res.status(400).json({ status: 'error', message: 'quantity inválido' })
  }

  const cart = updateCartItem(req.userId, req.params.productId, quantity)
  if (!cart) {
    return res.status(404).json({ status: 'error', message: 'Producto no encontrado en el carrito' })
  }

  res.json({ status: 'success', data: formatCartResponse(req.userId, cart) })
})

router.delete('/cart/items/:productId', authenticate, (req, res) => {
  const cart = removeCartItem(req.userId, req.params.productId)
  if (!cart) {
    return res.status(404).json({ status: 'error', message: 'Carrito no encontrado' })
  }
  res.json({ status: 'success', data: formatCartResponse(req.userId, cart) })
})

router.delete('/cart/items', authenticate, (req, res) => {
  clearCart(req.userId)
  res.json({ status: 'success', data: formatCartResponse(req.userId, { items: [] }) })
})

export default router
