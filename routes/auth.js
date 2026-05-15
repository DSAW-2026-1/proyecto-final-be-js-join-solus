import crypto from 'crypto'
import { Router } from 'express'
import { upsertUser, getUserByEmail } from '../data.js'

const router = Router()

const ADMIN_EMAILS = ['admin@unisabana.edu.co']

router.post('/auth/login-provider', (req, res) => {
  const { id_token, provider, client_type } = req.body
  if (!id_token || !provider) {
    return res.status(400).json({ status: 'error', message: 'id_token y provider son requeridos' })
  }

  const payload = JSON.parse(atob(id_token.split('.')[1]))
  const email = payload.email || `${payload.sub}@mock.com`
  const isInternal = email.endsWith('@unisabana.edu.co')
  const isAdmin = ADMIN_EMAILS.includes(email)

  let user = getUserByEmail(email)
  if (!user) {
    user = {
      id: crypto.randomUUID(),
      email,
      is_internal: isInternal,
      is_admin: isAdmin,
      onboarding_completed: false,
      is_seller: false,
      seller_info: null,
      profile: null,
      role_status: isAdmin ? 'ADMIN' : isInternal ? 'INSTITUTIONAL_BUYER' : 'VISITOR',
      permissions: { can_buy: true, can_sell: isInternal },
    }
  } else if (isAdmin) {
    user.is_admin = true
    user.role_status = 'ADMIN'
    user.onboarding_completed = true
    if (!user.profile) {
      user.profile = { full_name: 'Administrador', profile_picture: 'purple', bio: '', academic_info: null }
    }
    upsertUser(user)
  }

  upsertUser(user)

  const token = `mock.${btoa(JSON.stringify({ sub: user.id, email, is_internal: isInternal, is_admin: isAdmin }))}.sig`

  res.json({
    status: 'success',
    data: {
      user: {
        id: user.id,
        email: user.email,
        is_internal: user.is_internal,
        is_admin: user.is_admin || isAdmin,
        permissions: user.permissions,
      },
      token,
    },
  })
})

export default router
