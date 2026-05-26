import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET

export function authenticate(req, res, next) {
  if (!JWT_SECRET) {
    return res.status(500).json({ status: 'error', message: 'JWT_SECRET no configurado' })
  }

  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'Token requerido' })
  }

  const token = auth.split(' ')[1]

  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.userId = decoded.sub
    req.userEmail = decoded.email
    req.isAdmin = decoded.is_admin === true
    next()
  } catch {
    return res.status(401).json({ status: 'error', message: 'Token inválido o expirado' })
  }
}

export function adminAuth(req, res, next) {
  authenticate(req, res, () => {
    if (!req.isAdmin) {
      return res.status(403).json({ status: 'error', message: 'Acceso denegado. Se requieren permisos de administrador' })
    }
    next()
  })
}

export function generateToken(user) {
  const payload = {
    sub: user.id,
    email: user.email,
    is_internal: user.is_internal,
    is_admin: user.is_admin,
  }
  return jwt.sign(payload, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })
}
