import { Router } from 'express'
import { getUserNotifications, markNotificationRead, getUnreadNotificationCount } from '../data.js'

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

router.get('/notifications', authenticate, (req, res) => {
  const notifications = getUserNotifications(req.userId)
  res.json({ status: 'success', data: notifications })
})

router.get('/notifications/unread', authenticate, (req, res) => {
  const count = getUnreadNotificationCount(req.userId)
  res.json({ status: 'success', data: { count } })
})

router.patch('/notifications/:id/read', authenticate, (req, res) => {
  markNotificationRead(req.params.id)
  res.json({ status: 'success', message: 'Notificación marcada como leída' })
})

export default router
