import { Router } from 'express'
import crypto from 'crypto'
import { upsertUser, getUserByEmail } from '../db.js'
import { generateToken } from '../middleware/auth.js'

const router = Router()

const ADMIN_EMAILS = ['camilomova@unisabana.edu.co']

router.post('/auth/login', async (req, res) => {
  const { email } = req.body
  if (!email) {
    return res.status(400).json({ status: 'error', message: 'Email es requerido' })
  }

  const isInternal = email.endsWith('@unisabana.edu.co')
  const isAdmin = ADMIN_EMAILS.includes(email)

  let user = await getUserByEmail(email)
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
  }

  await upsertUser(user)
  const freshUser = await getUserByEmail(email)

  const token = generateToken(freshUser)

  res.json({
    status: 'success',
    data: {
      user: {
        id: freshUser.id,
        email: freshUser.email,
        is_internal: freshUser.is_internal,
        is_admin: freshUser.is_admin || isAdmin,
        onboarding_completed: freshUser.onboarding_completed ?? false,
        profile: freshUser.profile || null,
        is_seller: freshUser.is_seller ?? false,
        seller_info: freshUser.seller_info || null,
        role_status: freshUser.role_status || (isAdmin ? 'ADMIN' : isInternal ? 'INSTITUTIONAL_BUYER' : 'VISITOR'),
        permissions: freshUser.permissions,
      },
      token,
    },
  })
})

export default router
