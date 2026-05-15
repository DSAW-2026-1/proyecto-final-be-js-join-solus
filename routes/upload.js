import crypto from 'crypto'
import { Router } from 'express'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = join(__dirname, '..', 'uploads')

if (!existsSync(UPLOADS_DIR)) {
  mkdirSync(UPLOADS_DIR, { recursive: true })
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024

function authenticate(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'Token requerido' })
  }
  try {
    const payload = JSON.parse(atob(auth.split('.')[1]))
    req.userId = payload.sub
    next()
  } catch {
    return res.status(401).json({ status: 'error', message: 'Token inválido' })
  }
}

const router = Router()

router.post('/upload', authenticate, (req, res) => {
  const { images } = req.body
  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ status: 'error', message: 'Se requiere un array de imágenes en base64' })
  }

  const urls = images.map((dataUrl) => {
    const matches = dataUrl.match(/^data:(image\/(\w+));base64,(.+)$/)
    if (!matches) return null

    const ext = matches[2] === 'jpeg' ? 'jpg' : matches[2]
    if (ext === 'svg+xml' || ext === 'svg') return null

    const base64Data = matches[3]
    if ((base64Data.length * 3) / 4 > MAX_IMAGE_SIZE) return null

    const filename = `${crypto.randomUUID()}.${ext}`
    const filepath = join(UPLOADS_DIR, filename)

    writeFileSync(filepath, Buffer.from(base64Data, 'base64'))
    return `/uploads/${filename}`
  }).filter(Boolean)

  if (urls.length === 0) {
    return res.status(400).json({ status: 'error', message: 'No se pudieron procesar las imágenes' })
  }

  res.json({ status: 'success', data: { urls } })
})

export default router
