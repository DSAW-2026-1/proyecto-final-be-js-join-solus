import { Router } from 'express'
import { getUsers, getProducts, getAllOrders, updateProductStatus, updateUserRole } from '../data.js'

const router = Router()

function adminAuth(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'Token requerido' })
  }
  try {
    const payload = JSON.parse(atob(auth.split('.')[1]))
    if (!payload.is_admin) {
      return res.status(403).json({ status: 'error', message: 'Acceso denegado. Se requieren permisos de administrador' })
    }
    req.userId = payload.sub
    next()
  } catch {
    return res.status(401).json({ status: 'error', message: 'Token inválido' })
  }
}

router.get('/admin/stats', adminAuth, (req, res) => {
  const users = getUsers()
  const products = getProducts()
  const orders = getAllOrders()

  res.json({
    status: 'success',
    data: {
      total_users: users.length,
      internal_users: users.filter((u) => u.is_internal).length,
      external_users: users.filter((u) => !u.is_internal).length,
      sellers: users.filter((u) => u.is_seller).length,
      total_products: products.length,
      active_products: products.filter((p) => p.status === 'ACTIVO').length,
      inactive_products: products.filter((p) => p.status !== 'ACTIVO').length,
      total_orders: orders.length,
      orders_by_status: {
        CONFIRMADA: orders.filter((o) => o.status === 'CONFIRMADA').length,
      },
    },
  })
})

router.get('/admin/users', adminAuth, (req, res) => {
  const users = getUsers().map(({ password, ...u }) => u)
  res.json({ status: 'success', data: users })
})

router.patch('/admin/users/:id', adminAuth, (req, res) => {
  const { is_admin, is_seller, onboarding_completed, role_status } = req.body
  const updated = updateUserRole(req.params.id, { is_admin, is_seller, onboarding_completed, role_status })
  if (!updated) {
    return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' })
  }
  res.json({ status: 'success', data: updated })
})

router.get('/admin/products', adminAuth, (req, res) => {
  const products = getProducts()
  res.json({ status: 'success', data: products })
})

router.patch('/admin/products/:id/status', adminAuth, (req, res) => {
  const { status } = req.body
  if (!['ACTIVO', 'INACTIVO', 'SUSPENDIDO'].includes(status)) {
    return res.status(400).json({ status: 'error', message: 'Estado inválido' })
  }
  const product = updateProductStatus(req.params.id, status)
  if (!product) {
    return res.status(404).json({ status: 'error', message: 'Producto no encontrado' })
  }
  res.json({ status: 'success', data: product })
})

router.get('/admin/orders', adminAuth, (req, res) => {
  const orders = getAllOrders()
  res.json({ status: 'success', data: orders })
})

export default router
