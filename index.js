import express from 'express'
import cors from 'cors'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

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

const app = express()
const PORT = process.env.PORT || 8080

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim())
  : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000']

app.use(cors({ origin: corsOrigins, credentials: true, methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
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
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

export default app
