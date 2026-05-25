import crypto from 'crypto'
import { Router } from 'express'
import { v2 as cloudinary } from 'cloudinary'
import { CloudinaryStorage } from 'multer-storage-cloudinary'
import multer from 'multer'
import { addProduct, updateProduct, deleteProduct, getProductsByOwner, getUserById, getProductById, searchProducts, getProductDetail } from '../db.js'
import { authenticate } from '../middleware/auth.js'
import { productSchema, productUpdateSchema, validate } from '../validators/index.js'

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

let upload
if (process.env.CLOUDINARY_CLOUD_NAME) {
  const storage = new CloudinaryStorage({
    cloudinary,
    params: { folder: 'marketplace-unisabana', allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'], max_file_size: 5 * 1024 * 1024 },
  })
  upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } })
} else {
  const { join, dirname } = await import('path')
  const { fileURLToPath } = await import('url')
  const { mkdirSync, existsSync } = await import('fs')
  const __dirname = dirname(fileURLToPath(import.meta.url))
  const UPLOADS_DIR = join(__dirname, '..', 'uploads')
  if (!existsSync(UPLOADS_DIR)) mkdirSync(UPLOADS_DIR, { recursive: true })

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = file.originalname.split('.').pop()
      cb(null, `${crypto.randomUUID()}.${ext}`)
    },
  })
  upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Solo imágenes son permitidas'), false)
  }})
}

const router = Router()

router.post('/products', authenticate, validate(productSchema), upload.array('images', 6), async (req, res) => {
  const user = await getUserById(req.userId)
  if (!user) return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' })
  if (!user.is_seller) {
    return res.status(403).json({ status: 'error', message: 'Debes activar tu cuenta de vendedor para publicar productos' })
  }

  const { title, description, price, category, condition, stock } = req.body
  if (!title || !description || !price || !category || !condition) {
    return res.status(400).json({ status: 'error', message: 'Todos los campos obligatorios deben estar diligenciados: título, descripción, precio, categoría, estado' })
  }

  let images = []
  if (req.body.existing_images) {
    try { images = JSON.parse(req.body.existing_images) } catch { images = [] }
  }
  const newImages = (req.files || []).map((f) => f.path || `/uploads/${f.filename}`)
  images = [...images, ...newImages]

  const product = {
    id: crypto.randomUUID(),
    title: String(title).trim(),
    description: String(description).trim(),
    price: Number(price),
    category,
    condition,
    stock: Math.max(1, Number(stock) || 1),
    images,
    status: 'ACTIVO',
    created_at: new Date().toISOString(),
    owner_id: user.id,
    owner: { id: user.id, name: user.profile?.full_name || user.email, email: user.email },
    seller_info: user.seller_info ? { store_name: user.seller_info.store_name, reputation: user.seller_info.reputation } : null,
  }

  if (Number.isNaN(product.price) || product.price <= 0) {
    return res.status(400).json({ status: 'error', message: 'El precio debe ser un número positivo' })
  }

  await addProduct(product)

  res.status(201).json({
    status: 'success',
    message: 'Producto publicado exitosamente',
    data: {
      product_id: product.id,
      created_at: product.created_at,
      status: product.status,
      images: product.images,
      owner: product.owner,
    },
  })
})

router.get('/products/search', async (req, res) => {
  const result = await searchProducts(req.query)
  res.json({ status: 'success', ...result })
})

router.get('/products/my', authenticate, async (req, res) => {
  const products = await getProductsByOwner(req.userId)
  res.json({ status: 'success', data: products })
})

router.patch('/products/:id', authenticate, validate(productUpdateSchema), async (req, res) => {
  const isMultipart = (req.headers['content-type'] || '').includes('multipart/form-data')
  if (isMultipart) {
    upload.array('images', 6)(req, res, () => handlePatch(req, res))
  } else {
    handlePatch(req, res)
  }
})

async function handlePatch(req, res) {
  const user = await getUserById(req.userId)
  if (!user) return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' })

  const product = await getProductById(req.params.id)
  if (!product) return res.status(404).json({ status: 'error', message: 'Producto no encontrado' })
  if (product.owner_id !== req.userId) {
    return res.status(403).json({ status: 'error', message: 'No tienes permiso para editar este producto' })
  }

  const { title, description, price, category, condition, stock, images, existing_images, status } = req.body
  let allImages = images !== undefined ? images : undefined

  if (existing_images) {
    try { allImages = JSON.parse(existing_images) } catch { allImages = [] }
  }

  const newImages = (req.files || []).map((f) => f.path || `/uploads/${f.filename}`)
  if (newImages.length > 0) {
    allImages = [...(allImages || []), ...newImages]
  }

  const updates = {}
  if (title !== undefined) updates.title = title
  if (description !== undefined) updates.description = description
  if (price !== undefined) updates.price = Number(price)
  if (category !== undefined) updates.category = category
  if (condition !== undefined) updates.condition = condition
  if (stock !== undefined) updates.stock = Number(stock)
  if (allImages !== undefined) updates.images = allImages
  if (status !== undefined) updates.status = status

  const updated = await updateProduct(req.params.id, updates)
  res.json({ status: 'success', message: 'Producto actualizado exitosamente', data: updated })
}

router.delete('/products/:id', authenticate, async (req, res) => {
  const user = await getUserById(req.userId)
  if (!user) return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' })

  const product = await getProductById(req.params.id)
  if (!product) return res.status(404).json({ status: 'error', message: 'Producto no encontrado' })
  if (product.owner_id !== req.userId) {
    return res.status(403).json({ status: 'error', message: 'No tienes permiso para eliminar este producto' })
  }

  await deleteProduct(req.params.id)
  res.json({ status: 'success', message: 'Producto eliminado exitosamente' })
})

router.get('/products/:id', async (req, res) => {
  const detail = await getProductDetail(req.params.id)
  if (!detail) {
    return res.status(404).json({ status: 'error', message: 'Producto no encontrado' })
  }
  res.json({ status: 'success', data: detail })
})

export default router
