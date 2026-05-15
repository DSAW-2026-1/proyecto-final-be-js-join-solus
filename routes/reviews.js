import { Router } from 'express'
import { createReview, getProductReviews, getProductById, getUserById, createNotification } from '../data.js'

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

router.post('/reviews', authenticate, (req, res) => {
  const { product_id, rating, comment } = req.body
  if (!product_id || !rating) {
    return res.status(400).json({ status: 'error', message: 'product_id y rating son requeridos' })
  }
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ status: 'error', message: 'La calificación debe ser entre 1 y 5' })
  }

  const product = getProductById(product_id)
  if (!product) {
    return res.status(404).json({ status: 'error', message: 'Producto no encontrado' })
  }

  const user = getUserById(req.userId)
  const userName = user?.profile?.full_name || user?.email || 'Anónimo'

  const review = createReview(req.userId, userName, product_id, rating, comment)
  createNotification(product.owner.id, 'review', 'Nueva reseña', `${userName} te dejó una reseña de ${rating} estrellas`, `/products/${product_id}`)
  res.status(201).json({ status: 'success', message: 'Reseña publicada exitosamente', data: review })
})

router.get('/products/:id/reviews', (req, res) => {
  const reviews = getProductReviews(req.params.id)
  res.json({ status: 'success', data: reviews })
})

export default router
