import express from 'express'
import cors from 'cors'
import compression from 'compression'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import xss from 'xss'
import crypto from 'crypto'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, mkdirSync } from 'fs'
import * as Sentry from '@sentry/node'
import pino from 'pino'
import jwt from 'jsonwebtoken'
import { getProducts } from './db.js'
import { auditLog, LOG_ACTIONS, setLogger } from './services/audit.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
})
setLogger(logger)
const startTime = Date.now()

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
import { getUserById, sendMessage, getConversationMessages, createNotification } from './db.js'

const app = express()
const PORT = process.env.PORT || 8080
const isProduction = process.env.NODE_ENV === 'production'

// --- Validate required env vars ---
const REQUIRED_ENV = ['JWT_SECRET', 'DATABASE_URL']
if (isProduction) {
  REQUIRED_ENV.push('GOOGLE_CLIENT_ID', 'CORS_ORIGINS')
}
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    logger.error({ key }, 'Missing required environment variable')
    process.exit(1)
  }
}

// --- Env validation complete ---

// --- Graceful shutdown ---
let server
function shutdown(signal) {
  logger.info({ signal }, 'Shutting down gracefully...')
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed')
      import('./db.js').then(({ prisma }) => {
        prisma.$disconnect()
        logger.info('Database connections closed')
        process.exit(0)
      }).catch(() => process.exit(0))
    })
    setTimeout(() => {
      logger.error('Forced shutdown after timeout')
      process.exit(1)
    }, 10000).unref()
  } else {
    process.exit(0)
  }
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('uncaughtException', (err) => {
  logger.error({ err: err.message, stack: err.stack }, 'Uncaught exception')
  process.exit(1)
})
process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled rejection')
})

// --- Sentry (error tracking) ---
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  })
}

// --- Correlation ID ---
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID()
  res.setHeader('x-request-id', req.id)
  next()
})

// --- Compression ---
app.use(compression({ threshold: 1024 }))

// --- Security headers (Helmet) ---
app.use(helmet({
  crossOriginResourcePolicy: { policy: isProduction ? 'same-origin' : 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  crossOriginEmbedderPolicy: isProduction ? true : false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://apis.google.com'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
      connectSrc: ["'self'", 'https://res.cloudinary.com'],
      fontSrc: ["'self'"],
      frameSrc: ["'self'", 'https://accounts.google.com'],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: isProduction ? [] : null,
      reportUri: '/api/csp-violation',
    },
  },
  hsts: isProduction
    ? { maxAge: 63072000, includeSubDomains: true, preload: true }
    : false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  permissionsPolicy: {
    directives: {
      camera: ['()'],
      microphone: ['()'],
      geolocation: ['()'],
      payment: ['()'],
      usb: ['()'],
    },
  },
}))

// --- CORS ---
const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'https://proyecto-final-fe-js-join-solus.vercel.app',
]
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
  : DEFAULT_ORIGINS

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// --- Body parsing ---
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

// --- XSS Sanitization ---
app.use((req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    sanitizeObject(req.body)
  }
  next()
})

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'string') {
      obj[key] = xss(obj[key].trim(), {
        whiteList: {},
        stripIgnoreTag: true,
        stripIgnoreTagBody: ['script', 'style'],
      })
    } else if (typeof obj[key] === 'object') {
      sanitizeObject(obj[key])
    }
  }
}

// --- Rate limiting ---
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Demasiadas solicitudes. Intenta de nuevo en 15 minutos.' },
})
app.use('/api', limiter)

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.' },
})
app.use('/api/auth', authLimiter)

// Per-user rate limit for authenticated endpoints
const userRateLimit = new Map()
app.use('/api', (req, res, next) => {
  if (req.userId) {
    const key = `user:${req.userId}`
    const now = Date.now()
    const windowMs = 60 * 1000
    const maxRequests = 60
    const record = userRateLimit.get(key)
    if (record && now - record.start < windowMs) {
      record.count++
      if (record.count > maxRequests) {
        return res.status(429).json({ status: 'error', message: 'Demasiadas solicitudes. Intenta de nuevo en 1 minuto.' })
      }
    } else {
      userRateLimit.set(key, { start: now, count: 1 })
    }
  }
  next()
})

// Clean up stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of userRateLimit) {
    if (now - record.start > 120 * 1000) userRateLimit.delete(key)
  }
}, 5 * 60 * 1000)

// --- Static files ---
if (!process.env.VERCEL && !process.env.CLOUDINARY_CLOUD_NAME) {
  const uploadsDir = join(__dirname, 'uploads')
  if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true })
  app.use('/uploads', express.static(uploadsDir))
}

// --- Routes ---
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

// CSP violation reporting endpoint
app.post('/api/csp-violation', express.json({ type: 'application/csp-report' }), (req, res) => {
  logger.warn({ cspReport: req.body }, 'CSP violation')
  res.status(204).end()
})

app.get('/api/health', async (req, res) => {
  const checks = { status: 'ok', uptime: Math.floor((Date.now() - startTime) / 1000), timestamp: new Date().toISOString() }
  try {
    await getProducts()
    checks.database = 'connected'
  } catch {
    checks.database = 'disconnected'
    checks.status = 'degraded'
  }
  const statusCode = checks.status === 'ok' ? 200 : 503
  res.status(statusCode).json(checks)
})

// --- Sentry error handler ---
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app)
}

// --- Global error handler ---
app.use((err, req, res, next) => {
  logger.error({ err: err.message, stack: err.stack }, 'Unhandled error')
  if (err.name === 'MulterError') {
    return res.status(400).json({ status: 'error', message: `Error de archivo: ${err.message}` })
  }
  res.status(500).json({ status: 'error', message: 'Error interno del servidor' })
})

// --- Socket.IO (solo local, no en Vercel) ---
if (!process.env.VERCEL) {
  try {
    server = http.createServer(app)
    const io = new Server(server, {
      cors: { origin: corsOrigins, methods: ['GET', 'POST'] },
      pingInterval: 25000,
      pingTimeout: 20000,
      maxHttpBufferSize: 1e6,
    })
    app.set('io', io)

    const onlineUsers = new Map()

    // Socket.IO — connection rate limiting + JWT auth
    const socketRateMap = new Map()
    io.use((socket, next) => {
      const ip = socket.handshake.address
      const now = Date.now()
      const windowMs = 60000
      const maxConnections = 10
      const record = socketRateMap.get(ip)
      if (record && now - record.start < windowMs) {
        record.count++
        if (record.count > maxConnections) {
          return next(new Error('Demasiadas conexiones. Intenta de nuevo en 1 minuto.'))
        }
      } else {
        socketRateMap.set(ip, { start: now, count: 1 })
      }

      // Verify JWT auth
      const token = socket.handshake.auth?.token
      if (!token) {
        return next(new Error('Token requerido'))
      }
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        socket.userId = decoded.sub
        socket.userEmail = decoded.email
        next()
      } catch {
        next(new Error('Token invalido o expirado'))
      }
    })

    io.on('connection', (socket) => {
      try {
        const userId = socket.userId
        if (!userId) {
          socket.disconnect()
          return
        }

        socket.join(userId)
        onlineUsers.set(userId, { socketId: socket.id, joinedAt: Date.now() })
        io.emit('online_users', Array.from(onlineUsers.keys()))

        // Event rate limiting
        const eventCounts = new Map()
        function checkEventLimit(eventName) {
          const now = Date.now()
          const windowMs = 10000
          const maxEvents = 20
          const key = `${eventName}:${socket.id}`
          const record = eventCounts.get(key)
          if (record && now - record.start < windowMs) {
            record.count++
            if (record.count > maxEvents) {
              socket.emit('error', { message: `Demasiados eventos ${eventName}. Intenta de nuevo.` })
              return false
            }
          } else {
            eventCounts.set(key, { start: now, count: 1 })
          }
          return true
        }

        // Heartbeat
        socket.on('ping', () => {
          socket.emit('pong')
        })

        // Enviar mensaje de chat
        socket.on('sendMessage', async (data, ack) => {
          if (!checkEventLimit('sendMessage')) return
          try {
            const { receiver_id, product_id, content } = data
            if (!receiver_id || !content) {
              if (ack) ack({ status: 'error', message: 'receiver_id y content son requeridos' })
              return
            }
            const user = await getUserById(userId)
            const fromName = user?.profile?.full_name || user?.email || 'Anónimo'
            const msg = await sendMessage(userId, fromName, receiver_id, product_id || null, content)

            // Emitir al receptor
            io.to(receiver_id).emit('new_message', {
              conversation_id: msg.conversation_id,
              sender_id: msg.sender_id,
              sender_name: msg.sender_name,
              text: msg.text,
              timestamp: msg.created_at,
            })

            // Emitir al remitente también (para confirmación)
            socket.emit('new_message', {
              conversation_id: msg.conversation_id,
              sender_id: msg.sender_id,
              sender_name: msg.sender_name,
              text: msg.text,
              timestamp: msg.created_at,
            })

            await createNotification(receiver_id, 'message', 'Nuevo mensaje', `${fromName} te ha enviado un mensaje`, '/messages')
            io.to(receiver_id).emit('notification_update', { unread: true })

            const chatMessages = await getConversationMessages(msg.conversation_id)
            if (ack) ack({ status: 'success', data: { conversation_id: msg.conversation_id, messages: chatMessages } })
          } catch (err) {
            if (ack) ack({ status: 'error', message: 'Error interno al enviar mensaje' })
          }
        })

        // Indicador de escritura
        socket.on('typing', (data) => {
          if (!checkEventLimit('typing')) return
          const { receiver_id, conversation_id } = data
          if (receiver_id) {
            io.to(receiver_id).emit('typing', {
              user_id: userId,
              conversation_id,
            })
          }
        })

        socket.on('stop_typing', (data) => {
          const { receiver_id, conversation_id } = data
          if (receiver_id) {
            io.to(receiver_id).emit('stop_typing', {
              user_id: userId,
              conversation_id,
            })
          }
        })

        // Marcar mensajes como leídos
        socket.on('mark_read', async (data) => {
          const { conversation_id } = data
          if (conversation_id) {
            io.to(userId).emit('messages_read', { conversation_id })
          }
        })

        // Únete a sala de orden para recibir actualizaciones
        socket.on('join_order', (orderId) => {
          if (orderId) socket.join(`order:${orderId}`)
        })

        // Salir de sala de orden
        socket.on('leave_order', (orderId) => {
          if (orderId) socket.leave(`order:${orderId}`)
        })

        socket.on('disconnect', () => {
          onlineUsers.delete(userId)
          io.emit('online_users', Array.from(onlineUsers.keys()))
        })

        socket.on('error', () => {
          onlineUsers.delete(userId)
          io.emit('online_users', Array.from(onlineUsers.keys()))
        })
      } catch {}
    })

    // Exponer para emitir eventos desde rutas
    app.set('onlineUsers', onlineUsers)

    server.listen(PORT, () => {
      logger.info({ port: PORT }, 'Marketplace API started')
    })
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to start Socket.IO')
  }
}

export default app
