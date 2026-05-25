import { PrismaClient } from '@prisma/client'
import { randomBytes } from 'crypto'
import { beforeAll, afterAll } from 'vitest'
import jwt from 'jsonwebtoken'

const prisma = new PrismaClient()
const TEST_ADMIN_EMAIL = 'admin.test@unisabana.edu.co'

export function generateTestToken(userId, role = 'admin') {
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '1h' })
}

beforeAll(async () => {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret'
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://canilomoncada@localhost:5432/marketplace_unisabana'

  // Ensure admin user exists for tests
  const existing = await prisma.user.findUnique({ where: { email: TEST_ADMIN_EMAIL } })
  if (!existing) {
    await prisma.user.create({
      data: {
        email: TEST_ADMIN_EMAIL,
        password_hash: randomBytes(32).toString('hex'),
        is_internal: true,
        is_admin: true,
        is_seller: false,
        onboarding_completed: true,
        profile: { full_name: 'Admin Test' },
        role_status: 'ADMIN',
      },
    })
  }
})

afterAll(async () => {
  await prisma.$disconnect()
})
