import { Router } from 'express'
import { getUserNotifications, markNotificationRead, getUnreadNotificationCount } from '../db.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/notifications', authenticate, async (req, res) => {
  const notifications = await getUserNotifications(req.userId)
  res.json({ status: 'success', data: notifications })
})

router.get('/notifications/unread', authenticate, async (req, res) => {
  const count = await getUnreadNotificationCount(req.userId)
  res.json({ status: 'success', data: { count } })
})

router.patch('/notifications/:id/read', authenticate, async (req, res) => {
  await markNotificationRead(req.params.id)
  res.json({ status: 'success', message: 'Notificación marcada como leída' })
})

export default router
