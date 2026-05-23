import express from 'express'
import cors from 'cors'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import productRoutes from './routes/products.js'
import cartRoutes from './routes/cart.js'
import orderRoutes from './routes/orders.js'
import adminRoutes from './routes/admin.js'
import reviewRoutes from './routes/reviews.js'
import messageRoutes from './routes/messages.js'
import wishlistRoutes from './routes/wishlist.js'
import notificationRoutes from './routes/notifications.js'
import uploadRoutes from './routes/upload.js'

import http from 'http'
import { Server } from 'socket.io'
import { getUserById, sendMessage, getConversationMessages, createNotification } from './data.js'

const app = express()
const PORT = process.env.PORT || 8080

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
  : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000']

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

const uploadsDir = join(__dirname, 'uploads')
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true })
app.use('/uploads', express.static(uploadsDir))

app.use('/api', authRoutes)
app.use('/api', userRoutes)
app.use('/api', productRoutes)
app.use('/api', cartRoutes)
app.use('/api', orderRoutes)
app.use('/api', adminRoutes)
app.use('/api', reviewRoutes)
app.use('/api', messageRoutes)
app.use('/api', wishlistRoutes)
app.use('/api', notificationRoutes)
app.use('/api', uploadRoutes)

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use((err, req, res, next) => {
  console.error('Error:', err.message)
  res.status(500).json({ status: 'error', message: 'Error interno del servidor' })
})

if (!process.env.VERCEL) {
  try {
    const server = http.createServer(app)
    const io = new Server(server, {
      cors: { origin: corsOrigins, methods: ['GET', 'POST'] },
    })
    app.set('io', io)

    io.on('connection', (socket) => {
      try {
        const userId = socket.handshake.query.userId
        if (userId) socket.join(userId)

        socket.on('sendMessage', (data, ack) => {
          try {
            const { receiver_id, product_id, content } = data
            if (!receiver_id || !content || !userId) {
              if (ack) ack({ status: 'error', message: 'receiver_id y content son requeridos' })
              return
            }
            const user = getUserById(userId)
            const fromName = user?.profile?.full_name || user?.email || 'Anónimo'
            const msg = sendMessage(userId, fromName, receiver_id, product_id || null, content)
            io.to(receiver_id).emit('new_message', {
              conversation_id: msg.conversation_id, sender_id: msg.sender_id, sender_name: msg.sender_name, text: msg.text, timestamp: msg.created_at,
            })
            createNotification(receiver_id, 'message', 'Nuevo mensaje', `${fromName} te ha enviado un mensaje`, '/messages')
            const chatMessages = getConversationMessages(msg.conversation_id)
            if (ack) ack({ status: 'success', data: { conversation_id: msg.conversation_id, messages: chatMessages } })
          } catch (err) {
            if (ack) ack({ status: 'error', message: 'Error interno al enviar mensaje' })
          }
        })

        socket.on('disconnect', () => {})
        socket.on('error', () => {})
      } catch {}
    })

    server.listen(PORT, () => {
      console.log(`Marketplace API en http://localhost:${PORT}`)
    })
  } catch (err) {
    console.error('Error al iniciar Socket.io:', err.message)
  }
}

export default app
