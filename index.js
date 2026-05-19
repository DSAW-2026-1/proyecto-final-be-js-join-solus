import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth.js'
import userRoutes from './routes/users.js'
import productRoutes from './routes/products.js'
import cartRoutes from './routes/cart.js'
import orderRoutes from './routes/orders.js'
import adminRoutes from './routes/admin.js'
import reviewRoutes from './routes/reviews.js'
import testRoutes from './routes/message.js'

const app = express()
const corsOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map(s=>s.trim()) : ['http://localhost:3000','http://localhost:5173','http://127.0.0.1:3000']
app.use(cors({origin:corsOrigins,credentials:true,methods:['GET','POST','PATCH','PUT','DELETE','OPTIONS'],allowedHeaders:['Content-Type','Authorization']}))
app.use(express.json({limit:'10mb'}))
app.use(express.urlencoded({extended:true}))
app.use('/api', authRoutes)
app.use('/api', userRoutes)
app.use('/api', productRoutes)
app.use('/api', cartRoutes)
app.use('/api', orderRoutes)
app.use('/api', adminRoutes)
app.use('/api', reviewRoutes)
app.use('/api', testRoutes)
app.get('/api/health',(r,s)=>s.json({status:'ok'}))
export default app
