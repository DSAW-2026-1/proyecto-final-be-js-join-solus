import { Router } from 'express'
import { getWishlist, toggleWishlist, getProductById } from '../data.js'

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

router.get('/wishlist', authenticate, (req, res) => {
  const ids = getWishlist(req.userId)
  const products = ids.map((id) => getProductById(id)).filter(Boolean)
  res.json({ status: 'success', data: products })
})

router.post('/wishlist/:productId', authenticate, (req, res) => {
  const result = toggleWishlist(req.userId, req.params.productId)
  res.json({
    status: 'success',
    message: result.added ? 'Agregado a favoritos' : 'Eliminado de favoritos',
    data: { added: result.added, wishlist: result.wishlist },
  })
})

router.get('/wishlist/check/:productId', authenticate, (req, res) => {
  const wishlist = getWishlist(req.userId)
  res.json({ status: 'success', data: { favorited: wishlist.includes(req.params.productId) } })
})

export default router
