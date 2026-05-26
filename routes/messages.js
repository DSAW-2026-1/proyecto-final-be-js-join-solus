import { Router } from 'express'
import { getUserById, sendMessage, getUserConversations, getConversationMessages, getUserMessages, markMessageRead, getUnreadCount, getMessagesWithUser, createNotification, blockUser, unblockUser, isBlocked } from '../db.js'
import { authenticate } from '../middleware/auth.js'
import { messageSchema, validate } from '../validators/index.js'

const router = Router()

router.post('/messages', authenticate, validate(messageSchema), async (req, res) => {
  const receiverId = req.body.receiver_id || req.body.seller_id
  const messageContent = req.body.content || req.body.message
  const { product_id } = req.body

  if (!receiverId || !messageContent) {
    return res.status(400).json({ status: 'error', message: 'receiver_id y content son requeridos' })
  }

  const blocked = await isBlocked(req.userId, receiverId)
  if (blocked) {
    return res.status(403).json({ status: 'error', message: 'No puedes enviar mensajes a este usuario' })
  }

  const user = await getUserById(req.userId)
  const fromName = user?.profile?.full_name || user?.email || 'Anónimo'

  const msg = await sendMessage(req.userId, fromName, receiverId, product_id || null, messageContent)

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

  await createNotification(receiverId, 'message', 'Nuevo mensaje', `${fromName} te ha enviado un mensaje`, '/messages')

  const chatMessages = await getConversationMessages(msg.conversation_id)
  res.status(201).json({
    status: 'success',
    message: 'Mensaje enviado exitosamente',
    data: {
      conversation_id: msg.conversation_id,
      messages: chatMessages,
    },
  })
})

router.get('/conversations', authenticate, async (req, res) => {
  const conversations = await getUserConversations(req.userId)
  res.json({ status: 'success', data: conversations })
})

router.get('/conversations/:id/messages', authenticate, async (req, res) => {
  const messages = await getConversationMessages(req.params.id)
  res.json({ status: 'success', data: { conversation_id: req.params.id, messages } })
})

router.get('/messages/with/:userId', authenticate, async (req, res) => {
  const messages = await getMessagesWithUser(req.userId, req.params.userId)
  res.json({ status: 'success', data: { messages } })
})

router.get('/messages', authenticate, async (req, res) => {
  const messages = await getUserMessages(req.userId)
  res.json({ status: 'success', data: messages })
})

router.get('/messages/unread', authenticate, async (req, res) => {
  const count = await getUnreadCount(req.userId)
  res.json({ status: 'success', data: { count } })
})

router.patch('/messages/:id/read', authenticate, async (req, res) => {
  await markMessageRead(req.params.id)
  res.json({ status: 'success', message: 'Mensaje marcado como leído' })
})

// Block / unblock
router.post('/messages/block/:userId', authenticate, async (req, res) => {
  if (req.userId === req.params.userId) {
    return res.status(400).json({ status: 'error', message: 'No puedes bloquearte a ti mismo' })
  }
  await blockUser(req.userId, req.params.userId)
  res.json({ status: 'success', message: 'Usuario bloqueado' })
})

router.post('/messages/unblock/:userId', authenticate, async (req, res) => {
  await unblockUser(req.userId, req.params.userId)
  res.json({ status: 'success', message: 'Usuario desbloqueado' })
})

router.get('/messages/block-status/:userId', authenticate, async (req, res) => {
  const blocked = await isBlocked(req.userId, req.params.userId)
  res.json({ status: 'success', data: { blocked } })
})

export default router
