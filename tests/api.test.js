import { describe, it, expect, beforeAll } from 'vitest'
import supertest from 'supertest'
import express from 'express'
import cors from 'cors'
import { PrismaClient } from '@prisma/client'
import { generateToken } from '../middleware/auth.js'
import authRoutes from '../routes/auth.js'
import productRoutes from '../routes/products.js'
import adminRoutes from '../routes/admin.js'

const prisma = new PrismaClient()
const TEST_UID = 'integration-test-user-id'

function createApp() {
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '10mb' }))
  app.use('/api', authRoutes)
  app.use('/api', productRoutes)
  app.use('/api', adminRoutes)
  app.get('/api/health', (req, res) => res.json({ status: 'ok' }))
  return app
}

let testUser
let testAdmin
let testProduct
let userToken
let adminToken

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'

  testAdmin = await prisma.user.upsert({
    where: { email: 'admin.integration@unisabana.edu.co' },
    update: {},
    create: {
      id: 'admin-integration-id',
      email: 'admin.integration@unisabana.edu.co',
      password_hash: 'x',
      is_internal: true,
      is_admin: true,
      onboarding_completed: true,
      profile: { full_name: 'Admin Integration' },
      role_status: 'ADMIN',
      permissions: { can_buy: true, can_sell: true },
    },
  })
  adminToken = generateToken(testAdmin)

  testUser = await prisma.user.upsert({
    where: { email: 'user.integration@unisabana.edu.co' },
    update: {},
    create: {
      id: 'user-integration-id',
      email: 'user.integration@unisabana.edu.co',
      password_hash: 'x',
      is_internal: true,
      is_admin: false,
      onboarding_completed: true,
      profile: { full_name: 'User Integration' },
      role_status: 'INSTITUTIONAL_BUYER',
      permissions: { can_buy: true, can_sell: true },
    },
  })
  userToken = generateToken(testUser)

  testProduct = await prisma.product.create({
    data: {
      title: 'Producto de prueba integración',
      description: 'Descripción para pruebas de integración del API',
      price: 25000,
      category: 'Libros',
      condition: 'nuevo',
      status: 'ACTIVO',
      images: [],
      owner_id: testUser.id,
    },
  })
})

describe('API Integration Tests', () => {
  const app = createApp()

  describe('GET /api/health', () => {
    it('returns ok status', async () => {
      const res = await supertest(app).get('/api/health')
      expect(res.status).toBe(200)
      expect(res.body.status).toBe('ok')
    })
  })

  describe('POST /api/auth/login (email)', () => {
    it('creates user on first login', async () => {
      const uniqueEmail = `new-${Date.now()}@unisabana.edu.co`
      const res = await supertest(app)
        .post('/api/auth/login')
        .send({ email: uniqueEmail })
      expect(res.status).toBe(200)
      expect(res.body.data.token).toBeTruthy()
      expect(res.body.data.user.email).toBe(uniqueEmail)
    }, 20000)

    it('logs in existing user', async () => {
      const res = await supertest(app)
        .post('/api/auth/login')
        .send({ email: 'user.integration@unisabana.edu.co' })
      expect(res.status).toBe(200)
      expect(res.body.data.user.email).toBe('user.integration@unisabana.edu.co')
    }, 20000)

    it('rejects missing email', async () => {
      const res = await supertest(app)
        .post('/api/auth/login')
        .send({})
      expect(res.status).toBe(400)
    })

    it('promotes institutional emails to internal', async () => {
      const uniqueEmail = `student-${Date.now()}@unisabana.edu.co`
      const res = await supertest(app)
        .post('/api/auth/login')
        .send({ email: uniqueEmail })
      expect(res.status).toBe(200)
      expect(res.body.data.user.is_internal).toBe(true)
    }, 20000)
  })

  describe('GET /api/products/search', () => {
    it('returns products with search query', async () => {
      const res = await supertest(app)
        .get('/api/products/search')
        .query({ q: 'prueba' })
      expect(res.status).toBe(200)
      expect(res.body.status).toBe('success')
      expect(Array.isArray(res.body.data)).toBe(true)
    })

    it('returns all products without query', async () => {
      const res = await supertest(app).get('/api/products/search')
      expect(res.status).toBe(200)
      expect(res.body.status).toBe('success')
    })

    it('filters by category', async () => {
      const res = await supertest(app)
        .get('/api/products/search')
        .query({ category: 'Libros' })
      expect(res.status).toBe(200)
      expect(Array.isArray(res.body.data)).toBe(true)
    })
  })

  describe('GET /api/products/:id', () => {
    it('returns product by id', async () => {
      const res = await supertest(app)
        .get(`/api/products/${testProduct.id}`)
      expect(res.status).toBe(200)
      expect(res.body.data.product.title).toBe('Producto de prueba integración')
    })

    it('returns 404 for non-existent product', async () => {
      const res = await supertest(app)
        .get('/api/products/non-existent-id')
      expect(res.status).toBe(404)
    })
  })

  describe('Admin endpoints', () => {
    it('GET /api/admin/stats rejects non-admin', async () => {
      const res = await supertest(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${userToken}`)
      expect(res.status).toBe(403)
    })

    it('GET /api/admin/stats returns stats for admin', async () => {
      const res = await supertest(app)
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('total_users')
      expect(res.body.data).toHaveProperty('total_products')
      expect(res.body.data).toHaveProperty('total_orders')
    })

    it('GET /api/admin/analytics returns analytics for admin', async () => {
      const res = await supertest(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('registrations')
      expect(res.body.data).toHaveProperty('revenue')
    })

    it('GET /api/admin/reports returns pending reports for admin', async () => {
      const res = await supertest(app)
        .get('/api/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`)
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveProperty('pending_reports')
    })

    it('rejects unauthenticated admin requests', async () => {
      const res = await supertest(app).get('/api/admin/stats')
      expect(res.status).toBe(401)
    })
  })
})
