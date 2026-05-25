import { Router } from 'express'
import { getUsers, getProducts, getAllOrders, updateProductStatus, updateUserRole, getPendingReports, getAllReports, moderateProduct, createReport, getAnalytics } from '../db.js'
import { adminAuth, authenticate } from '../middleware/auth.js'
import { auditLog, LOG_ACTIONS } from '../services/audit.js'

const router = Router()

function audit(action) {
  return (req, res, next) => {
    res.on('finish', () => {
      auditLog({ action, userId: req.userId, userEmail: req.userEmail, details: { statusCode: res.statusCode, path: req.path }, ip: req.ip })
    })
    next()
  }
}

router.get('/admin/stats', adminAuth, audit(LOG_ACTIONS.ADMIN_STATS), async (req, res) => {
  const [users, products, orders] = await Promise.all([getUsers(), getProducts(), getAllOrders()])

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

router.get('/admin/analytics', adminAuth, async (req, res) => {
  const data = await getAnalytics()
  res.json({ status: 'success', data })
})

router.get('/admin/users', adminAuth, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50))
  const skip = (page - 1) * limit
  const allUsers = await getUsers()
  const total = allUsers.length
  const sanitized = allUsers.slice(skip, skip + limit).map(({ password, ...u }) => u)
  res.json({
    status: 'success',
    data: sanitized,
    meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
  })
})

router.patch('/admin/users/:id', adminAuth, audit(LOG_ACTIONS.ADMIN_UPDATE_USER), async (req, res) => {
  const { is_admin, is_seller, onboarding_completed, role_status } = req.body
  const updated = await updateUserRole(req.params.id, { is_admin, is_seller, onboarding_completed, role_status })
  if (!updated) {
    return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' })
  }
  res.json({ status: 'success', data: updated })
})

router.get('/admin/products', adminAuth, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50))
  const skip = (page - 1) * limit
  const allProducts = await getProducts()
  const total = allProducts.length
  res.json({
    status: 'success',
    data: allProducts.slice(skip, skip + limit),
    meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
  })
})

router.patch('/admin/products/:id/status', adminAuth, audit(LOG_ACTIONS.ADMIN_MODERATE_PRODUCT), async (req, res) => {
  const { status } = req.body
  if (!['ACTIVO', 'INACTIVO', 'SUSPENDIDO'].includes(status)) {
    return res.status(400).json({ status: 'error', message: 'Estado inválido' })
  }
  const product = await updateProductStatus(req.params.id, status)
  if (!product) {
    return res.status(404).json({ status: 'error', message: 'Producto no encontrado' })
  }
  res.json({ status: 'success', data: product })
})

router.get('/admin/orders', adminAuth, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50))
  const skip = (page - 1) * limit
  const allOrders = await getAllOrders()
  const total = allOrders.length
  res.json({
    status: 'success',
    data: allOrders.slice(skip, skip + limit),
    meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
  })
})

router.post('/reports', authenticate, async (req, res) => {
  const { product_id, reason } = req.body
  if (!product_id || !reason) {
    return res.status(400).json({ status: 'error', message: 'product_id y reason son requeridos' })
  }

  const report = await createReport(req.userId, product_id, reason)
  if (!report) {
    return res.status(404).json({ status: 'error', message: 'Producto no encontrado' })
  }

  res.status(201).json({ status: 'success', message: 'Reporte enviado. El equipo de administración lo revisará.', data: { report_id: report.id } })
})

router.get('/admin/reports', adminAuth, async (req, res) => {
  const pending = await getPendingReports()
  const mapped = pending.map((r) => ({
    report_id: r.id,
    reason: r.reason,
    reported_by: r.reported_by,
    product: { id: r.product_id, title: r.product_title, seller_name: r.seller_name },
    created_at: r.created_at?.toISOString?.() || r.created_at,
  }))
  res.json({ status: 'success', data: { pending_reports: mapped } })
})

router.post('/admin/moderate-product', adminAuth, audit(LOG_ACTIONS.ADMIN_MODERATE_PRODUCT), async (req, res) => {
  const { product_id, action, reason } = req.body
  if (!product_id || !action || !reason) {
    return res.status(400).json({ status: 'error', message: 'product_id, action y reason son requeridos' })
  }
  if (!['SUSPEND', 'ACTIVATE'].includes(action)) {
    return res.status(400).json({ status: 'error', message: 'Acción inválida. Use SUSPEND o ACTIVATE' })
  }

  const result = await moderateProduct(product_id, action, reason)
  if (!result) {
    return res.status(404).json({ status: 'error', message: 'Producto no encontrado' })
  }

  res.json({ status: 'success', message: `Producto ${action === 'SUSPEND' ? 'suspendido' : 'activado'} exitosamente`, data: result })
})

export default router
