import { Router } from 'express'
import { getUserById, sendMessage, getUserConversations, getConversationMessages, getUserMessages, markMessageRead, getUnreadCount, createNotification } from '../data.js'

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
  const receiverId = req.body.receiver_id || req.body.seller_id
  const messageContent = req.body.content || req.body.message
  const { product_id } = req.body

  if (!receiverId || !messageContent) {
    return res.status(400).json({ status: 'error', message: 'receiver_id y content son requeridos' })
  }

  const user = getUserById(req.userId)
  const fromName = user?.profile?.full_name || user?.email || 'Anónimo'

  const msg = sendMessage(req.userId, fromName, receiverId, product_id || null, messageContent)

  const io = req.app.get('io')
  if (io) {
    io.to(receiverId).emit('new_message', {
      conversation_id: msg.conversation_id,
      sender_id: msg.sender_id,
      sender_name: msg.sender_name,
      text: msg.text,
      timestamp: msg.created_at,
    })
  }

  createNotification(receiverId, 'message', 'Nuevo mensaje', `${fromName} te ha enviado un mensaje`, '/messages')

  const chatMessages = getConversationMessages(msg.conversation_id)
  res.status(201).json({
    status: 'success',
    message: 'Mensaje enviado exitosamente',
    data: {
      conversation_id: msg.conversation_id,
      messages: chatMessages,
    },
  })
})

router.get('/conversations', authenticate, (req, res) => {
  const conversations = getUserConversations(req.userId)
  res.json({ status: 'success', data: conversations })
})

router.get('/conversations/:id/messages', authenticate, (req, res) => {
  const messages = getConversationMessages(req.params.id)
  res.json({ status: 'success', data: { conversation_id: req.params.id, messages } })
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
