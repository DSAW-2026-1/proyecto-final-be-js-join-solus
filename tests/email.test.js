import { describe, it, expect } from 'vitest'
import { sendWelcomeEmail } from '../email.js'

describe('Email Service', () => {
  it('sendWelcomeEmail generates correct structure', async () => {
    const result = await sendWelcomeEmail('test@test.com', 'Test User')
    expect(result).toBeDefined()
    // Without SENDGRID_API_KEY, it simulates
    expect(result.status).toBe('simulated')
  })

  it('sendEmail returns simulated when no API key', async () => {
    const { sendEmail } = await import('../email.js')
    const result = await sendEmail({ to: 'a@b.com', subject: 'Test', html: '<p>Hi</p>' })
    expect(result.status).toBe('simulated')
  })
})
