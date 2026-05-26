import { describe, it, expect, vi, beforeAll } from 'vitest'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret'

function generateToken(payload, expiresIn = '1h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn })
}

describe('Auth middleware logic', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = JWT_SECRET
  })

  describe('Token generation', () => {
    it('generates a valid JWT with user id', () => {
      const token = generateToken({ id: 'user-123', role: 'user' })
      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')

      const decoded = jwt.verify(token, JWT_SECRET)
      expect(decoded.id).toBe('user-123')
      expect(decoded.role).toBe('user')
    })

    it('generates token with admin role', () => {
      const token = generateToken({ id: 'admin-1', role: 'admin' })
      const decoded = jwt.verify(token, JWT_SECRET)
      expect(decoded.role).toBe('admin')
    })

    it('token expires correctly', async () => {
      const token = generateToken({ id: 'user-1' }, '0s')
      expect(() => jwt.verify(token, JWT_SECRET)).toThrow('jwt expired')
    })
  })

  describe('Token verification', () => {
    it('verifies a valid token', () => {
      const token = generateToken({ id: 'user-1' })
      const decoded = jwt.verify(token, JWT_SECRET)
      expect(decoded.id).toBe('user-1')
    })

    it('rejects tampered token', () => {
      const token = generateToken({ id: 'user-1' })
      const tampered = token.slice(0, -5) + 'XXXXX'
      expect(() => jwt.verify(tampered, JWT_SECRET)).toThrow()
    })

    it('rejects token with wrong secret', () => {
      const token = jwt.sign({ id: 'user-1' }, 'wrong-secret')
      expect(() => jwt.verify(token, JWT_SECRET)).toThrow('invalid signature')
    })
  })
})
