import crypto from 'crypto'
import { Router } from 'express'
import { addProduct, updateProduct, deleteProduct, getProductsByOwner, getUserById, getProductById, searchProducts, getProductDetail } from '../data.js'

const router = Router()

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

router.post('/products', authenticate, (req, res) => {
  const user = getUserById(req.userId)
  if (!user) return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' })
  if (!user.is_seller) {
    return res.status(403).json({ status: 'error', message: 'Debes activar tu cuenta de vendedor para publicar productos' })
  }

  const { title, description, price, category, condition, stock, images } = req.body
  if (!title || !description || !price || !category || !condition) {
    return res.status(400).json({ status: 'error', message: 'Todos los campos obligatorios deben estar diligenciados: título, descripción, precio, categoría, estado' })
  }

  const product = {
    id: crypto.randomUUID(),
    title: String(title).trim(),
    description: String(description).trim(),
    price: Number(price),
    category,
    condition,
    stock: Math.max(1, Number(stock) || 1),
    images: images || [],
    status: 'ACTIVO',
    created_at: new Date().toISOString(),
    owner: { id: user.id, name: user.profile?.full_name || user.email, email: user.email },
    seller_info: user.seller_info ? { store_name: user.seller_info.store_name, reputation: user.seller_info.reputation } : null,
  }

  if (Number.isNaN(product.price) || product.price <= 0) {
    return res.status(400).json({ status: 'error', message: 'El precio debe ser un número positivo' })
  }

  addProduct(product)

  res.status(201).json({
    status: 'success',
    message: 'Producto publicado exitosamente',
    data: {
      product_id: product.id,
      created_at: product.created_at,
      status: product.status,
      owner: product.owner,
    },
  })
})

router.get('/products/search', (req, res) => {
  const result = searchProducts(req.query)
  res.json({ status: 'success', ...result })
})

router.get('/products/my', authenticate, (req, res) => {
  const products = getProductsByOwner(req.userId)
  res.json({ status: 'success', data: products })
})

router.patch('/products/:id', authenticate, (req, res) => {
  const user = getUserById(req.userId)
  if (!user) return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' })

  const product = getProductById(req.params.id)
  if (!product) return res.status(404).json({ status: 'error', message: 'Producto no encontrado' })
  if (product.owner.id !== req.userId) {
    return res.status(403).json({ status: 'error', message: 'No tienes permiso para editar este producto' })
  }

  const { title, description, price, category, condition, stock, images, status } = req.body
  const updates = {}
  if (title !== undefined) updates.title = title
  if (description !== undefined) updates.description = description
  if (price !== undefined) updates.price = Number(price)
  if (category !== undefined) updates.category = category
  if (condition !== undefined) updates.condition = condition
  if (stock !== undefined) updates.stock = Number(stock)
  if (images !== undefined) updates.images = images
  if (status !== undefined) updates.status = status

  const updated = updateProduct(req.params.id, updates)
  res.json({ status: 'success', message: 'Producto actualizado exitosamente', data: updated })
})

router.delete('/products/:id', authenticate, (req, res) => {
  const user = getUserById(req.userId)
  if (!user) return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' })

  const product = getProductById(req.params.id)
  if (!product) return res.status(404).json({ status: 'error', message: 'Producto no encontrado' })
  if (product.owner.id !== req.userId) {
    return res.status(403).json({ status: 'error', message: 'No tienes permiso para eliminar este producto' })
  }

  deleteProduct(req.params.id)
  res.json({ status: 'success', message: 'Producto eliminado exitosamente' })
})

router.get('/products/:id', (req, res) => {
  const detail = getProductDetail(req.params.id)
  if (!detail) {
    return res.status(404).json({ status: 'error', message: 'Producto no encontrado' })
  }
  res.json({ status: 'success', data: detail })
})

export default router
