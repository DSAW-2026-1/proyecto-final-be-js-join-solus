import { Router } from 'express'
import { OAuth2Client } from 'google-auth-library'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { upsertUser, getUserByEmail } from '../db.js'
import { generateToken } from '../middleware/auth.js'

const router = Router()

const ADMIN_EMAILS = ['camilomova@unisabana.edu.co']
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID
const MICROSOFT_TENANT_ID = process.env.MICROSOFT_TENANT_ID || 'common'

let msJwksCache = { keys: null, fetchedAt: 0 }

async function getMicrosoftPublicKeys() {
  const cacheAge = Date.now() - msJwksCache.fetchedAt
  if (msJwksCache.keys && cacheAge < 3600000) return msJwksCache.keys

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const res = await fetch(`https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/discovery/v2.0/keys`, { signal: controller.signal })
    if (!res.ok) throw new Error('Error al obtener claves Microsoft')
    const data = await res.json()
    msJwksCache = { keys: data.keys, fetchedAt: Date.now() }
    return data.keys
  } finally {
    clearTimeout(timer)
  }
}

async function verifyGoogleToken(idToken) {
  if (GOOGLE_CLIENT_ID) {
    const client = new OAuth2Client(GOOGLE_CLIENT_ID)
    const ticket = await client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })
    const p = ticket.getPayload()
    return { sub: p.sub, email: p.email, name: p.name, picture: p.picture }
  }
  console.warn('[AUTH] GOOGLE_CLIENT_ID no configurado — verificacion omitida (solo dev)')
  const parts = idToken.split('.')
  if (parts.length !== 3) throw new Error('Token invalido')
  const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
  return { sub: p.sub, email: p.email, name: p.name, picture: p.picture }
}

async function verifyMicrosoftToken(idToken) {
  if (MICROSOFT_CLIENT_ID) {
    const keys = await getMicrosoftPublicKeys()
    const header = JSON.parse(Buffer.from(idToken.split('.')[0], 'base64url').toString())
    const key = keys.find(k => k.kid === header.kid)
    if (!key) throw new Error('No se encontro clave firma Microsoft')
    const publicKey = crypto.createPublicKey({ format: 'jwk', key })
    const p = jwt.verify(idToken, publicKey, {
      algorithms: ['RS256'],
      issuer: `https://login.microsoftonline.com/${MICROSOFT_TENANT_ID}/v2.0`,
      audience: MICROSOFT_CLIENT_ID,
    })
    return { sub: p.sub, email: p.email, name: p.name, picture: p.picture }
  }
  console.warn('[AUTH] MICROSOFT_CLIENT_ID no configurado — verificacion omitida (solo dev)')
  const parts = idToken.split('.')
  if (parts.length !== 3) throw new Error('Token invalido')
  const p = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
  return { sub: p.sub, email: p.email, name: p.name, picture: p.picture }
}

router.post('/auth/login-provider', async (req, res) => {
  const { id_token, provider } = req.body
  if (!id_token || !provider) {
    return res.status(400).json({ status: 'error', message: 'id_token y provider son requeridos' })
  }

  let payload
  try {
    if (provider === 'google') {
      payload = await verifyGoogleToken(id_token)
    } else if (provider === 'microsoft') {
      payload = await verifyMicrosoftToken(id_token)
    } else {
      return res.status(400).json({ status: 'error', message: `Proveedor no soportado: ${provider}` })
    }
  } catch {
    return res.status(401).json({ status: 'error', message: 'Token invalido o expirado' })
  }
  const email = payload.email
  const isInternal = email.endsWith('@unisabana.edu.co')
  const isAdmin = ADMIN_EMAILS.includes(email)

  let user = await getUserByEmail(email)
  if (!user) {
    user = {
      id: payload.sub,
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
