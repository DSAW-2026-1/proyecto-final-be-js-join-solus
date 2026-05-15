import crypto from 'crypto'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, 'db.json')

const SELLER_PROFILES = {
  'camilomonva@unisabana.edu.co': { career: 'Ingeniería de Sistemas', faculty: 'Facultad de Ingeniería' },
  'mariagarcia@unisabana.edu.co': { career: 'Administración de Empresas', faculty: 'Facultad de Ciencias Económicas y Empresariales' },
  'andresperez@unisabana.edu.co': { career: 'Ingeniería Civil', faculty: 'Facultad de Ingeniería' },
  'laurarinc@unisabana.edu.co': { career: 'Ingeniería de Sistemas', faculty: 'Facultad de Ingeniería' },
  'ce@unisabana.edu.co': { career: 'Centro de Estudiantes', faculty: 'Bienestar Universitario' },
  'deportes@unisabana.edu.co': { career: 'Administración Deportiva', faculty: 'Facultad de Ingeniería' },
  'carlosvega@unisabana.edu.co': { career: 'Música', faculty: 'Facultad de Comunicación' },
  'juanortiz@unisabana.edu.co': { career: 'Arquitectura', faculty: 'Facultad de Arquitectura y Diseño' },
  'anatorres@unisabana.edu.co': { career: 'Diseño de Productos', faculty: 'Facultad de Arquitectura y Diseño' },
  'juegos@unisabana.edu.co': { career: 'Centro de Recreación', faculty: 'Bienestar Universitario' },
  'tech@unisabana.edu.co': { career: 'Ingeniería de Sistemas', faculty: 'Facultad de Ingeniería' },
}

const DEMO_PRODUCTS = [
  { title: 'Hamburguesa Especial', description: 'Doble carne, queso cheddar y tocineta. Incluye papas.', price: 18000, category: 'comidas', condition: 'nuevo', stock: 120, ownerName: 'Camilo Moncada', ownerEmail: 'camilomonva@unisabana.edu.co' },
  { title: 'Salchipapa King Size', description: 'Salchicha americana con papas a la francesa y salsas.', price: 11800, category: 'comidas', condition: 'nuevo', stock: 80, ownerName: 'María García', ownerEmail: 'mariagarcia@unisabana.edu.co' },
  { title: 'Cálculo Diferencial - Stewart', description: 'Libro de cálculo en excelente estado. 7ma edición.', price: 85000, category: 'libros', condition: 'como_nuevo', stock: 1, ownerName: 'Andrés Pérez', ownerEmail: 'andresperez@unisabana.edu.co' },
  { title: 'Teclado Mecánico Redragon', description: 'Teclado mecánico RGB, switches rojos.', price: 145000, category: 'tecnologia', condition: 'bueno', stock: 1, ownerName: 'Laura Rincón', ownerEmail: 'laurarinc@unisabana.edu.co' },
  { title: 'Camiseta Universidad de La Sabana', description: 'Camiseta oficial del centro de estudiantes.', price: 45000, category: 'ropa', condition: 'nuevo', stock: 30, ownerName: 'Centro Estudiantes', ownerEmail: 'ce@unisabana.edu.co' },
  { title: 'Balón de Fútbol #5', description: 'Balón profesional microfibra. Ideal para la cancha de la universidad.', price: 62000, category: 'deportes', condition: 'nuevo', stock: 15, ownerName: 'Tienda Deportiva US', ownerEmail: 'deportes@unisabana.edu.co' },
  { title: 'Guitarra Acústica Yamaha', description: 'Guitarra en buen estado, incluye funda.', price: 320000, category: 'musica', condition: 'bueno', stock: 1, ownerName: 'Carlos Vega', ownerEmail: 'carlosvega@unisabana.edu.co' },
  { title: 'Escritorio en L', description: 'Escritorio de madera con espacio para monitor.', price: 180000, category: 'muebles', condition: 'aceptable', stock: 1, ownerName: 'Juan Ortiz', ownerEmail: 'juanortiz@unisabana.edu.co' },
  { title: 'Clases de Programación Web', description: 'Ofrezco tutorías de React, Node.js y bases de datos.', price: 25000, category: 'servicios', condition: 'nuevo', stock: 50, ownerName: 'Profe Camilo', ownerEmail: 'camilomonva@unisabana.edu.co' },
  { title: 'Kit de Acuarelas 24 colores', description: 'Set profesional de acuarelas. Ideal para clase de arte.', price: 38000, category: 'arte', condition: 'nuevo', stock: 10, ownerName: 'Ana Torres', ownerEmail: 'anatorres@unisabana.edu.co' },
  { title: 'Juego de Mesa - Catan', description: 'Clásico juego de estrategia. Completo.', price: 95000, category: 'juegos', condition: 'como_nuevo', stock: 1, ownerName: 'Juego y Aprende US', ownerEmail: 'juegos@unisabana.edu.co' },
  { title: 'Audífonos Sony WH-1000XM5', description: 'Cancelación de ruido activa, excelente sonido.', price: 650000, category: 'tecnologia', condition: 'nuevo', stock: 3, ownerName: 'TechStore US', ownerEmail: 'tech@unisabana.edu.co' },
]

function getDefaultDb() {
  return {
    users: [],
    products: DEMO_PRODUCTS.map((d, i) => ({
      id: crypto.randomUUID(),
      title: d.title,
      description: d.description,
      price: d.price,
      category: d.category,
      condition: d.condition,
      stock: d.stock,
      images: [],
      status: 'ACTIVO',
      created_at: new Date(Date.now() - i * 3600000).toISOString(),
      owner: { id: crypto.randomUUID(), name: d.ownerName, email: d.ownerEmail },
      seller_info: {
        store_name: `${d.ownerName.split(' ')[0]} Store`,
        reputation: { score: +(4 + Math.random()).toFixed(1), total_reviews: Math.floor(Math.random() * 20), status: 'VERIFICADO' },
      },
    })),
  }
}

function readDb() {
  try {
    if (existsSync(DB_PATH)) {
      return JSON.parse(readFileSync(DB_PATH, 'utf-8'))
    }
  } catch {}
  const db = getDefaultDb()
  writeDb(db)
  return db
}

function writeDb(db) {
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
}

export function getUsers() {
  return readDb().users
}

export function getUserByEmail(email) {
  return getUsers().find((u) => u.email === email) || null
}

export function getUserById(id) {
  return getUsers().find((u) => u.id === id) || null
}

export function upsertUser(user) {
  const db = readDb()
  const idx = db.users.findIndex((u) => u.id === user.id)
  if (idx >= 0) {
    db.users[idx] = user
  } else {
    db.users.unshift(user)
  }
  writeDb(db)
  return user
}

export function getProducts() {
  return readDb().products
}

export function addProduct(product) {
  const db = readDb()
  db.products.unshift(product)
  writeDb(db)
  return product
}

export function updateProduct(productId, updates) {
  const db = readDb()
  const idx = db.products.findIndex((p) => p.id === productId)
  if (idx < 0) return null
  db.products[idx] = { ...db.products[idx], ...updates, id: productId }
  writeDb(db)
  return db.products[idx]
}

export function deleteProduct(productId) {
  const db = readDb()
  const idx = db.products.findIndex((p) => p.id === productId)
  if (idx < 0) return null
  const removed = db.products.splice(idx, 1)[0]
  writeDb(db)
  return removed
}

export function getProductsByOwner(ownerId) {
  return getProducts().filter((p) => p.owner.id === ownerId)
}

export function getProductById(id) {
  return getProducts().find((p) => p.id === id) || null
}

export function searchProducts(params) {
  let products = getProducts().filter((p) => p.status === 'ACTIVO')

  if (params.q) {
    const q = params.q.toLowerCase()
    products = products.filter((p) => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
  }
  if (params.category) products = products.filter((p) => p.category === params.category)
  if (params.condition) products = products.filter((p) => p.condition === params.condition)
  if (params.minPrice) products = products.filter((p) => p.price >= Number(params.minPrice))
  if (params.maxPrice) products = products.filter((p) => p.price <= Number(params.maxPrice))

  const page = Number(params.page) || 1
  const perPage = 12
  const totalPages = Math.ceil(products.length / perPage)
  const start = (page - 1) * perPage
  const paged = products.slice(start, start + perPage)

  return {
    meta: { total_results: products.length, current_page: page, total_pages: totalPages || 1 },
    data: paged.map((p) => ({
      id: p.id,
      title: p.title,
      price: p.price,
      category: p.category,
      condition: p.condition,
      thumbnail: p.images?.[0] || null,
      created_at: p.created_at,
      seller: { name: p.owner.name, reputation: p.seller_info?.reputation?.score || 5.0 },
    })),
  }
}
export function getCart(userId) {
  const db = readDb()
  if (!db.carts) db.carts = {}
  return db.carts[userId] || { items: [] }
}

export function addToCart(userId, productId, quantity = 1) {
  const db = readDb()
  if (!db.carts) db.carts = {}

  const product = getProductById(productId)
  if (!product) return null

  if (!db.carts[userId]) db.carts[userId] = { items: [] }

  const cart = db.carts[userId]
  const existing = cart.items.find((i) => i.product_id === productId)

  if (existing) {
    existing.quantity += quantity
  } else {
    cart.items.push({
      product_id: productId,
      title: product.title,
      price: product.price,
      category: product.category,
      condition: product.condition,
      stock: product.stock,
      image: product.images?.[0] || null,
      seller_name: product.owner.name,
      quantity,
    })
  }

  writeDb(db)
  return cart
}

export function updateCartItem(userId, productId, quantity) {
  const db = readDb()
  if (!db.carts?.[userId]) return null

  const cart = db.carts[userId]
  const item = cart.items.find((i) => i.product_id === productId)
  if (!item) return null

  if (quantity <= 0) {
    cart.items = cart.items.filter((i) => i.product_id !== productId)
  } else {
    item.quantity = quantity
  }

  writeDb(db)
  return cart
}

export function removeCartItem(userId, productId) {
  const db = readDb()
  if (!db.carts?.[userId]) return null

  db.carts[userId].items = db.carts[userId].items.filter((i) => i.product_id !== productId)
  writeDb(db)
  return db.carts[userId]
}

export function clearCart(userId) {
  const db = readDb()
  if (db.carts) db.carts[userId] = { items: [] }
  writeDb(db)
}

export function getOrders(userId) {
  const db = readDb()
  if (!db.orders) db.orders = []
  return db.orders.filter((o) => o.buyer_id === userId)
}

export function getAllOrders() {
  const db = readDb()
  return db.orders || []
}

export function createOrder(userId, items, total) {
  const db = readDb()
  if (!db.orders) db.orders = []

  const user = getUserById(userId)

  const order = {
    id: crypto.randomUUID(),
    buyer_id: userId,
    buyer_email: user?.email || 'unknown',
    buyer_name: user?.profile?.full_name || user?.email || 'unknown',
    items: items.map((i) => ({
      product_id: i.product_id,
      title: i.title,
      price: i.price,
      quantity: i.quantity,
      seller_name: i.seller_name,
    })),
    total,
    status: 'CONFIRMADA',
    created_at: new Date().toISOString(),
  }

  db.orders.unshift(order)
  writeDb(db)
  return order
}

export function updateProductStatus(productId, status) {
  const db = readDb()
  const product = db.products.find((p) => p.id === productId)
  if (!product) return null
  product.status = status
  writeDb(db)
  return product
}

export function createReview(userId, userName, productId, rating, comment) {
  const db = readDb()
  if (!db.reviews) db.reviews = []

  const product = getProductById(productId)
  if (!product) return null

  const review = {
    id: crypto.randomUUID(),
    user_id: userId,
    user_name: userName,
    product_id: productId,
    seller_id: product.owner.id,
    rating: Math.min(5, Math.max(1, Math.round(rating))),
    comment: comment || '',
    created_at: new Date().toISOString(),
  }

  db.reviews.push(review)

  const sellerReviews = db.reviews.filter((r) => r.seller_id === product.owner.id)
  const avgScore = sellerReviews.reduce((s, r) => s + r.rating, 0) / sellerReviews.length

  const sellerIdx = db.users.findIndex((u) => u.id === product.owner.id)
  if (sellerIdx >= 0 && db.users[sellerIdx].seller_info) {
    db.users[sellerIdx].seller_info.reputation = {
      score: +avgScore.toFixed(1),
      total_reviews: sellerReviews.length,
      status: sellerReviews.length >= 5 ? 'VERIFICADO' : sellerReviews.length >= 1 ? 'NUEVO_VENDEDOR' : 'NUEVO_VENDEDOR',
    }
  }

  writeDb(db)
  return review
}

export function getProductReviews(productId) {
  const db = readDb()
  return (db.reviews || []).filter((r) => r.product_id === productId)
}

export function getSellerReviews(sellerId) {
  const db = readDb()
  return (db.reviews || []).filter((r) => r.seller_id === sellerId)
}

export function sendMessage(fromUserId, fromName, toUserId, productId, message) {
  const db = readDb()
  if (!db.messages) db.messages = []

  const product = productId ? db.products.find((p) => p.id === productId) : null

  const msg = {
    id: crypto.randomUUID(),
    from_user_id: fromUserId,
    from_name: fromName,
    to_user_id: toUserId,
    product_id: productId,
    product_title: product?.title || null,
    message,
    read: false,
    created_at: new Date().toISOString(),
  }

  db.messages.push(msg)
  writeDb(db)
  return msg
}

export function getUserMessages(userId) {
  const db = readDb()
  return (db.messages || [])
    .filter((m) => m.from_user_id === userId || m.to_user_id === userId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

export function markMessageRead(messageId) {
  const db = readDb()
  const msg = (db.messages || []).find((m) => m.id === messageId)
  if (msg) msg.read = true
  writeDb(db)
}

export function getUnreadCount(userId) {
  const db = readDb()
  return (db.messages || []).filter((m) => m.to_user_id === userId && !m.read).length
}

export function getWishlist(userId) {
  const db = readDb()
  if (!db.wishlists) db.wishlists = {}
  return db.wishlists[userId] || []
}

export function toggleWishlist(userId, productId) {
  const db = readDb()
  if (!db.wishlists) db.wishlists = {}
  if (!db.wishlists[userId]) db.wishlists[userId] = []

  const idx = db.wishlists[userId].indexOf(productId)
  if (idx >= 0) {
    db.wishlists[userId].splice(idx, 1)
    writeDb(db)
    return { added: false, wishlist: db.wishlists[userId] }
  } else {
    db.wishlists[userId].push(productId)
    writeDb(db)
    return { added: true, wishlist: db.wishlists[userId] }
  }
}

export function isInWishlist(userId, productId) {
  const wishlist = getWishlist(userId)
  return wishlist.includes(productId)
}

export function createNotification(userId, type, title, message, link) {
  const db = readDb()
  if (!db.notifications) db.notifications = []

  const notif = {
    id: crypto.randomUUID(),
    user_id: userId,
    type,
    title,
    message,
    link: link || null,
    read: false,
    created_at: new Date().toISOString(),
  }

  db.notifications.push(notif)
  writeDb(db)
  return notif
}

export function getUserNotifications(userId) {
  const db = readDb()
  return (db.notifications || [])
    .filter((n) => n.user_id === userId)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

export function markNotificationRead(notifId) {
  const db = readDb()
  const notif = (db.notifications || []).find((n) => n.id === notifId)
  if (notif) notif.read = true
  writeDb(db)
}

export function getUnreadNotificationCount(userId) {
  const db = readDb()
  return (db.notifications || []).filter((n) => n.user_id === userId && !n.read).length
}

export function updateUserRole(userId, updates) {
  const db = readDb()
  const idx = db.users.findIndex((u) => u.id === userId)
  if (idx < 0) return null
  db.users[idx] = { ...db.users[idx], ...updates }
  writeDb(db)
  return db.users[idx]
}

export function getProductDetail(id) {
  const product = getProductById(id)
  if (!product) return null

  const ownerUser = getUserById(product.owner.id)
  const academicInfo = ownerUser?.profile?.academic_info
  const profile = academicInfo
    ? { career: academicInfo.career, faculty: academicInfo.faculty }
    : (SELLER_PROFILES[product.owner.email] || { career: 'Miembro de la comunidad', faculty: 'Universidad de La Sabana' })

  const related = getProducts()
    .filter((p) => p.id !== id && p.category === product.category && p.status === 'ACTIVO')
    .slice(0, 4)
    .map((p) => ({ id: p.id, title: p.title, price: p.price, thumbnail: p.images?.[0] || null }))

  return {
    product: {
      id: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
      currency: 'COP',
      condition: product.condition,
      stock: product.stock,
      images: product.images || [],
      category: product.category,
    },
    seller: {
      id: product.owner.id,
      name: product.owner.name,
      career: profile.career,
      faculty: profile.faculty,
      reputation_score: product.seller_info?.reputation?.score || 5.0,
      total_reviews: product.seller_info?.reputation?.total_reviews || 0,
      is_verified_student: product.owner.email.endsWith('@unisabana.edu.co'),
    },
    related_products: related,
  }
}
