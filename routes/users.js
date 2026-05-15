import { Router } from 'express'
import { getUserById, upsertUser } from '../data.js'

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

router.patch('/users/profile/onboarding', authenticate, (req, res) => {
  const user = getUserById(req.userId)
  if (!user) return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' })

  const { full_name, profile_picture, academic_info, bio } = req.body

  const profile = {
    full_name,
    profile_picture,
    bio,
    academic_info: academic_info?.is_student ? { is_student: true, career: academic_info.career, faculty: academic_info.faculty } : null,
  }

  const updated = {
    ...user,
    onboarding_completed: true,
    profile,
    role_status: user.is_internal ? 'INSTITUTIONAL_BUYER' : 'VISITOR',
    can_list_products: user.is_internal,
  }

  upsertUser(updated)

  res.json({
    status: 'success',
    message: 'Perfil configurado exitosamente',
    data: {
      user_id: updated.id,
      role_status: updated.role_status,
      can_list_products: updated.can_list_products,
      next_step: '/dashboard',
    },
  })
})

router.post('/users/seller/activate', authenticate, (req, res) => {
  const user = getUserById(req.userId)
  if (!user) return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' })

  if (!user.is_internal) {
    return res.status(403).json({
      status: 'error',
      code: 'INSUFFICIENT_PERMISSIONS',
      message: 'Lo sentimos, solo los miembros de la comunidad con correo institucional pueden vender productos.',
    })
  }

  const { accept_selling_policies, seller_type, store_name } = req.body

  const updated = {
    ...user,
    is_seller: true,
    seller_info: {
      store_name,
      seller_type,
      reputation: { score: 5.0, total_reviews: 0, status: 'NUEVO_VENDEDOR' },
    },
    role_status: 'VENDEDOR',
    permissions: {
      ...user.permissions,
      can_sell: true,
      seller_permissions: ['create_product', 'edit_product', 'manage_orders'],
    },
  }

  upsertUser(updated)

  res.json({
    status: 'success',
    data: {
      user_id: updated.id,
      role: 'VENDEDOR',
      reputation: updated.seller_info.reputation,
      permissions: ['create_product', 'edit_product', 'manage_orders'],
    },
  })
})

router.get('/users/me', authenticate, (req, res) => {
  const user = getUserById(req.userId)
  if (!user) return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' })
  res.json({ status: 'success', data: { user } })
})

export default router
