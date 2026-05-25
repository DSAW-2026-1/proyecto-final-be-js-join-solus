import crypto from 'crypto'
import { Router } from 'express'
import { v2 as cloudinary } from 'cloudinary'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { authenticate } from '../middleware/auth.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const UPLOADS_DIR = join(__dirname, '..', 'uploads')

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

try {
  if (!existsSync(UPLOADS_DIR)) {
    mkdirSync(UPLOADS_DIR, { recursive: true })
  }
} catch {}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const MAX_IMAGES_PER_REQUEST = 10
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp']

async function withTimeout(promise, ms, label) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
  })
  return Promise.race([promise.finally(() => clearTimeout(timer)), timeout])
}

const router = Router()

router.post('/upload', authenticate, async (req, res) => {
  const { images } = req.body
  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ status: 'error', message: 'Se requiere un array de imágenes en base64' })
  }
  if (images.length > MAX_IMAGES_PER_REQUEST) {
    return res.status(400).json({ status: 'error', message: `Máximo ${MAX_IMAGES_PER_REQUEST} imágenes por solicitud` })
  }

  const urls = []

  for (const dataUrl of images) {
    try {
      if (process.env.CLOUDINARY_CLOUD_NAME) {
        const result = await withTimeout(cloudinary.uploader.upload(dataUrl, {
          folder: 'marketplace-unisabana',
          resource_type: 'image',
          transformation: [{ width: 800, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
        }), 15000, 'Cloudinary upload')
        urls.push(result.secure_url)
      } else {
        if (process.env.VERCEL) {
          return res.status(400).json({ status: 'error', message: 'Subida de imágenes no disponible en producción. Configura CLOUDINARY_CLOUD_NAME' })
        }
        const matches = dataUrl.match(/^data:(image\/(\w+));base64,(.+)$/)
        if (!matches) continue
        const ext = matches[2] === 'jpeg' ? 'jpg' : matches[2]
        if (!ALLOWED_EXTENSIONS.includes(ext)) continue
        const base64Data = matches[3]
        if ((base64Data.length * 3) / 4 > MAX_IMAGE_SIZE) continue
        const filename = `${crypto.randomUUID()}.${ext}`
        const filepath = join(UPLOADS_DIR, filename)
        writeFileSync(filepath, Buffer.from(base64Data, 'base64'))
        urls.push(`/uploads/${filename}`)
      }
    } catch {}
  }

  if (urls.length === 0) {
    return res.status(400).json({ status: 'error', message: 'No se pudieron procesar las imágenes' })
  }

  res.json({ status: 'success', data: { urls } })
})

export default router
