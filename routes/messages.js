import { Router } from 'express'
import { getUserById, sendMessage, getUserMessages, markMessageRead, getUnreadCount, getProductById, createNotification } from '../data.js'

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

router.post('/messages', authenticate, (req, res) => {
  const { seller_id, product_id, message } = req.body
  if (!seller_id || !message) {
    return res.status(400).json({ status: 'error', message: 'seller_id y message son requeridos' })
  }

  const user = getUserById(req.userId)
  const fromName = user?.profile?.full_name || user?.email || 'Anónimo'

  const msg = sendMessage(req.userId, fromName, seller_id, product_id || null, message)
  createNotification(seller_id, 'message', 'Nuevo mensaje', `${fromName} te ha enviado un mensaje sobre un producto`, '/messages')
  res.status(201).json({ status: 'success', message: 'Mensaje enviado exitosamente', data: msg })
})

router.get('/messages', authenticate, (req, res) => {
  const messages = getUserMessages(req.userId)
  res.json({ status: 'success', data: messages })
})

router.get('/messages/unread', authenticate, (req, res) => {
  const count = getUnreadCount(req.userId)
  res.json({ status: 'success', data: { count } })
})

router.patch('/messages/:id/read', authenticate, (req, res) => {
  markMessageRead(req.params.id)
  res.json({ status: 'success', message: 'Mensaje marcado como leído' })
})

export default router
