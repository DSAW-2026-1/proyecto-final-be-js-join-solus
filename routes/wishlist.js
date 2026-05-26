import { Router } from 'express'
import { getWishlist, toggleWishlist, getProductById } from '../db.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/wishlist', authenticate, async (req, res) => {
  const products = await getWishlist(req.userId)
  res.json({ status: 'success', data: products })
})

router.post('/wishlist/:productId', authenticate, async (req, res) => {
  const result = await toggleWishlist(req.userId, req.params.productId)
  res.json({
    status: 'success',
    message: result.added ? 'Agregado a favoritos' : 'Eliminado de favoritos',
    data: { added: result.added, wishlist: result.wishlist },
  })
})

router.get('/wishlist/check/:productId', authenticate, async (req, res) => {
  const wishlist = await getWishlist(req.userId)
  res.json({ status: 'success', data: { favorited: wishlist.some((p) => p.id === req.params.productId) } })
})

export default router
