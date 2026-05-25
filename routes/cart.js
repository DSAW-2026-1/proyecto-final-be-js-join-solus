import { Router } from 'express'
import { getCart, addToCart, updateCartItem, removeCartItem, clearCart, formatCartResponse } from '../db.js'
import { authenticate } from '../middleware/auth.js'
import { cartItemSchema, validate } from '../validators/index.js'

const router = Router()

router.get('/cart/items', authenticate, async (req, res) => {
  const cart = await getCart(req.userId)
  res.json({ status: 'success', data: formatCartResponse(req.userId, cart) })
})

router.post('/cart/items', authenticate, validate(cartItemSchema), async (req, res) => {
  const { product_id, quantity } = req.body
  if (!product_id) {
    return res.status(400).json({ status: 'error', message: 'product_id es requerido' })
  }

  const cart = await addToCart(req.userId, product_id, quantity || 1)
  if (!cart) {
    return res.status(404).json({ status: 'error', message: 'Producto no encontrado' })
  }

  res.json({
    status: 'success',
    message: 'Producto añadido al carrito',
    data: formatCartResponse(req.userId, cart),
  })
})

router.patch('/cart/items/:productId', authenticate, async (req, res) => {
  const { quantity } = req.body
  if (quantity === undefined || quantity < 0) {
    return res.status(400).json({ status: 'error', message: 'quantity inválido' })
  }

  const cart = await updateCartItem(req.userId, req.params.productId, quantity)
  if (!cart) {
    return res.status(404).json({ status: 'error', message: 'Producto no encontrado en el carrito' })
  }

  res.json({ status: 'success', data: formatCartResponse(req.userId, cart) })
})

router.delete('/cart/items/:productId', authenticate, async (req, res) => {
  const cart = await removeCartItem(req.userId, req.params.productId)
  if (!cart) {
    return res.status(404).json({ status: 'error', message: 'Carrito no encontrado' })
  }
  res.json({ status: 'success', data: formatCartResponse(req.userId, cart) })
})

router.delete('/cart/items', authenticate, async (req, res) => {
  await clearCart(req.userId)
  res.json({ status: 'success', data: formatCartResponse(req.userId, { items: [] }) })
})

export default router
