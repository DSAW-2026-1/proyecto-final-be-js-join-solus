import { Router } from 'express'
import { createReview, getProductReviews, getProductById, getUserById, getAllOrders, createNotification } from '../db.js'
import { authenticate } from '../middleware/auth.js'
import { reviewSchema, validate } from '../validators/index.js'

const router = Router()

router.post('/reviews', authenticate, validate(reviewSchema), async (req, res) => {
  const { order_id, product_id, rating, comment } = req.body
  if ((!order_id && !product_id) || !rating) {
    return res.status(400).json({ status: 'error', message: 'order_id o product_id, y rating son requeridos' })
  }
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ status: 'error', message: 'La calificación debe ser entre 1 y 5' })
  }

  let targetProductId = product_id

  if (order_id) {
    const orders = await getAllOrders()
    const order = orders.find((o) => o.id === order_id && o.buyer_id === req.userId)
    if (!order) {
      return res.status(404).json({ status: 'error', message: 'Orden no encontrada o no te pertenece' })
    }
    if (product_id) {
      const orderProduct = order.items.find((i) => i.product_id === product_id)
      if (!orderProduct) {
        return res.status(400).json({ status: 'error', message: 'El producto no pertenece a esta orden' })
      }
      targetProductId = product_id
    } else {
      targetProductId = order.items[0]?.product_id
    }
    if (!targetProductId) {
      return res.status(400).json({ status: 'error', message: 'La orden no tiene productos asociados' })
    }
  }

  const product = await getProductById(targetProductId)
  if (!product) {
    return res.status(404).json({ status: 'error', message: 'Producto no encontrado' })
  }

  const user = await getUserById(req.userId)
  const userName = user?.profile?.full_name || user?.email || 'Anónimo'

  const result = await createReview(req.userId, userName, targetProductId, order_id, rating, comment)
  await createNotification(product.owner_id, 'review', 'Nueva reseña', `${userName} te dejó una reseña de ${rating} estrellas`, `/products/${targetProductId}`)
  res.status(201).json({ status: 'success', message: 'Reseña publicada exitosamente', data: result })
})

router.get('/products/:id/reviews', async (req, res) => {
  const reviews = await getProductReviews(req.params.id)
  res.json({ status: 'success', data: reviews })
})

export default router
