import { PrismaClient } from '@prisma/client'
import crypto from 'crypto'

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error', 'warn'] : ['error', 'warn'],
  datasourceUrl: process.env.DATABASE_URL,

  // Configure query timeouts for production
  ...(process.env.NODE_ENV === 'production' && {
    transactionOptions: {
      maxWait: 5000,
      timeout: 15000,
    },
  }),
})

export { prisma }

async function withRetry(fn, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === retries || !isTransientError(err)) throw err
      await new Promise((r) => setTimeout(r, attempt * 100))
    }
  }
}

function isTransientError(err) {
  const msg = err?.message || ''
  return msg.includes('Connection pool') || msg.includes('timeout') || msg.includes('database system') || msg.includes('deadlock')
}

// Order ID generation
function generateOrderId(counter) {
  const year = new Date().getFullYear()
  const seq = String(counter).padStart(4, '0')
  return `ORD-${year}-${seq}`
}

function generateTransactionId() {
  return `TXN-${String(Math.floor(Math.random() * 900000) + 100000)}`
}

function pruneUser(user) {
  if (!user) return null
  const { password_hash, ...rest } = user
  return rest
}

export async function getUsers() {
  const users = await prisma.user.findMany()
  return users.map(pruneUser)
}

export async function getUserByEmail(email) {
  const user = await prisma.user.findUnique({ where: { email } })
  return pruneUser(user)
}

export async function getUserByEmailWithPassword(email) {
  return prisma.user.findUnique({ where: { email } })
}

export async function getUserById(id) {
  if (!id) return null
  const user = await prisma.user.findUnique({ where: { id } })
  return pruneUser(user)
}

export async function upsertUser(user) {
  const data = {
    email: user.email,
    is_internal: user.is_internal ?? false,
    is_admin: user.is_admin ?? false,
    is_seller: user.is_seller ?? false,
    onboarding_completed: user.onboarding_completed ?? false,
    role_status: user.role_status ?? 'VISITOR',
    profile: user.profile ?? null,
    seller_info: user.seller_info ?? null,
    permissions: user.permissions ?? null,
    password_hash: user.password_hash ?? undefined,
  }
  const result = await prisma.user.upsert({
    where: { email: user.email },
    update: data,
    create: { id: user.id || crypto.randomUUID(), ...data },
  })
  return pruneUser(result)
}

export async function getProducts() {
  return prisma.product.findMany()
}

export async function addProduct(product) {
  return prisma.product.create({
    data: {
      id: product.id || crypto.randomUUID(),
      title: product.title,
      description: product.description,
      price: product.price,
      category: product.category,
      condition: product.condition,
      stock: product.stock ?? 1,
      images: product.images ?? [],
      status: product.status ?? 'ACTIVO',
      owner_id: product.owner_id || product.owner?.id,
      seller_info: product.seller_info ?? null,
      created_at: product.created_at ? new Date(product.created_at) : new Date(),
    },
  })
}

export async function updateProduct(productId, updates) {
  const data = {}
  if (updates.title !== undefined) data.title = updates.title
  if (updates.description !== undefined) data.description = updates.description
  if (updates.price !== undefined) data.price = Number(updates.price)
  if (updates.category !== undefined) data.category = updates.category
  if (updates.condition !== undefined) data.condition = updates.condition
  if (updates.stock !== undefined) data.stock = Number(updates.stock)
  if (updates.images !== undefined) data.images = updates.images
  if (updates.status !== undefined) data.status = updates.status
  if (updates.seller_info !== undefined) data.seller_info = updates.seller_info

  try {
    return await prisma.product.update({ where: { id: productId }, data })
  } catch {
    return null
  }
}

export async function deleteProduct(productId) {
  try {
    await prisma.product.delete({ where: { id: productId } })
    return true
  } catch {
    return null
  }
}

export async function getProductsByOwner(ownerId) {
  return prisma.product.findMany({ where: { owner_id: ownerId } })
}

export async function getProductById(id) {
  if (!id) return null
  try {
    return await prisma.product.findUnique({ where: { id } })
  } catch {
    return null
  }
}

export async function searchProducts(params) {
  const where = { status: 'ACTIVO' }
  const conditions = []

  if (params.q) {
    const q = params.q.toLowerCase()
    conditions.push({
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ],
    })
  }
  if (params.category) conditions.push({ category: params.category })
  if (params.condition) conditions.push({ condition: params.condition })
  if (params.minPrice) conditions.push({ price: { gte: Number(params.minPrice) } })
  if (params.maxPrice) conditions.push({ price: { lte: Number(params.maxPrice) } })

  if (conditions.length > 0) where.AND = conditions

  const page = Number(params.page) || 1
  const perPage = 12
  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.product.count({ where }),
  ])

  const totalPages = Math.ceil(total / perPage)

  return {
    meta: { total_results: total, current_page: page, total_pages: totalPages || 1 },
    data: products.map((p) => ({
      id: p.id,
      title: p.title,
      price: p.price,
      category: p.category,
      condition: p.condition,
      thumbnail: Array.isArray(p.images) ? p.images[0] || null : null,
      created_at: p.created_at?.toISOString?.() || p.created_at,
      seller: {
        name: p.seller_info?.store_name || p.owner?.name || 'Vendedor',
        reputation: p.seller_info?.reputation?.score || 5.0,
      },
    })),
  }
}

export async function getCart(userId) {
  let cart = await prisma.cart.findUnique({
    where: { user_id: userId },
    include: { items: true },
  })
  if (!cart) {
    cart = await prisma.cart.create({
      data: { user_id: userId },
      include: { items: true },
    })
  }
  return { items: cart.items || [] }
}

export function formatCartResponse(userId, cart) {
  const items = (cart.items || []).map((item) => ({
    product_id: item.product_id,
    title: item.title,
    price: item.price,
    quantity: item.quantity,
    subtotal: item.price * item.quantity,
    category: item.category,
    image: item.image,
    seller_name: item.seller_name,
  }))
  const total_price = items.reduce((sum, item) => sum + item.subtotal, 0)
  return { cart_id: userId, items, total_price }
}

export async function addToCart(userId, productId, quantity = 1) {
  const product = await getProductById(productId)
  if (!product) return null

  let cart = await prisma.cart.findUnique({ where: { user_id: userId } })
  if (!cart) {
    cart = await prisma.cart.create({ data: { user_id: userId } })
  }

  const existing = await prisma.cartItem.findFirst({
    where: { cart_id: cart.id, product_id: productId },
  })

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantity },
    })
  } else {
    await prisma.cartItem.create({
      data: {
        cart_id: cart.id,
        product_id: productId,
        title: product.title,
        price: product.price,
        category: product.category,
        condition: product.condition,
        stock: product.stock,
        image: Array.isArray(product.images) ? product.images[0] || null : null,
        seller_name: product.seller_info?.store_name || 'Vendedor',
        quantity,
      },
    })
  }

  return getCart(userId)
}

export async function updateCartItem(userId, productId, quantity) {
  const cart = await prisma.cart.findUnique({ where: { user_id: userId } })
  if (!cart) return null

  const item = await prisma.cartItem.findFirst({
    where: { cart_id: cart.id, product_id: productId },
  })
  if (!item) return null

  if (quantity <= 0) {
    await prisma.cartItem.delete({ where: { id: item.id } })
  } else {
    await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } })
  }

  return getCart(userId)
}

export async function removeCartItem(userId, productId) {
  const cart = await prisma.cart.findUnique({ where: { user_id: userId } })
  if (!cart) return null

  await prisma.cartItem.deleteMany({
    where: { cart_id: cart.id, product_id: productId },
  })

  return getCart(userId)
}

export async function clearCart(userId) {
  const cart = await prisma.cart.findUnique({ where: { user_id: userId } })
  if (cart) {
    await prisma.cartItem.deleteMany({ where: { cart_id: cart.id } })
  }
}

export async function getOrders(userId) {
  const orders = await prisma.order.findMany({
    where: { buyer_id: userId },
    orderBy: { created_at: 'desc' },
  })
  return orders.map(formatOrder)
}

export async function getAllOrders() {
  const orders = await prisma.order.findMany({ orderBy: { created_at: 'desc' } })
  return orders.map(formatOrder)
}

function formatOrder(o) {
  return {
    ...o,
    created_at: o.created_at?.toISOString?.() || o.created_at,
  }
}

export async function getSellerOrders(userId) {
  const products = await prisma.product.findMany({
    where: { owner_id: userId },
    select: { id: true },
  })
  const productIds = products.map((p) => p.id)
  if (productIds.length === 0) return []

  const orders = await prisma.order.findMany({
    where: {
      items: { path: '$[*].product_id', array_contains: productIds },
    },
    orderBy: { created_at: 'desc' },
  })
  return orders
    .filter((o) => {
      const items = Array.isArray(o.items) ? o.items : []
      return items.some((item) => productIds.includes(item.product_id))
    })
    .map(formatOrder)
}

async function getNextOrderCounter() {
  const meta = await prisma.meta.findUnique({ where: { id: 'singleton' } })
  if (!meta) {
    await prisma.meta.create({ data: { id: 'singleton', order_counter: 1 } })
    return 1
  }
  const next = meta.order_counter + 1
  await prisma.meta.update({
    where: { id: 'singleton' },
    data: { order_counter: next },
  })
  return next
}

export async function createOrder(userId, items, total) {
  const counter = await getNextOrderCounter()
  const year = new Date().getFullYear()
  const seq = String(counter).padStart(4, '0')
  const orderId = `ORD-${year}-${seq}`

  const user = await getUserById(userId)

  const order = await prisma.order.create({
    data: {
      id: orderId,
      buyer_id: userId,
      buyer_email: user?.email || 'unknown',
      buyer_name: user?.profile?.full_name || user?.email || 'unknown',
      items,
      total,
      status: 'CONFIRMADA',
    },
  })
  return formatOrder(order)
}

export async function checkoutOrder(userId, items, total, paymentMethod, bankName, shippingAddress) {
  return prisma.$transaction(async (tx) => {
    // Decrement stock for each item (with optimistic concurrency check)
    for (const item of items) {
      const product = await tx.product.findUnique({ where: { id: item.product_id } })
      if (!product || product.stock < item.quantity) {
        throw new Error(`Stock insuficiente para ${item.title}`)
      }
      await tx.product.update({
        where: { id: item.product_id },
        data: { stock: product.stock - item.quantity },
      })
    }

    // Get next order counter atomically
    const meta = await tx.meta.findUnique({ where: { id: 'singleton' } })
    let counter = 1
    if (!meta) {
      await tx.meta.create({ data: { id: 'singleton', order_counter: 1 } })
    } else {
      counter = meta.order_counter + 1
      await tx.meta.update({
        where: { id: 'singleton' },
        data: { order_counter: counter },
      })
    }

    const orderId = generateOrderId(counter)
    const transactionId = generateTransactionId()

    const user = await tx.user.findUnique({ where: { id: userId } })

    const order = await tx.order.create({
      data: {
        id: orderId,
        transaction_id: transactionId,
        buyer_id: userId,
        buyer_email: user?.email || 'unknown',
        buyer_name: user?.profile?.full_name || user?.email || 'unknown',
        items,
        total,
        payment_method: paymentMethod,
        bank_name: bankName,
        shipping_address: shippingAddress,
        status: 'PAID',
      },
    })

    // Clear cart atomically
    const cart = await tx.cart.findUnique({ where: { user_id: userId } })
    if (cart) {
      await tx.cartItem.deleteMany({ where: { cart_id: cart.id } })
    }

    return formatOrder(order)
  })
}

export async function updateOrderStatus(orderId, status) {
  try {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status },
    })
    return formatOrder(order)
  } catch {
    return null
  }
}

export async function updateProductStatus(productId, status) {
  try {
    return await prisma.product.update({
      where: { id: productId },
      data: { status },
    })
  } catch {
    return null
  }
}

export async function createReview(userId, userName, productId, orderId, rating, comment) {
  const product = await getProductById(productId)
  if (!product) return null

  const review = await prisma.review.create({
    data: {
      user_id: userId,
      user_name: userName || 'Anónimo',
      product_id: productId,
      order_id: orderId || null,
      seller_id: product.owner_id,
      rating: Math.min(5, Math.max(1, Math.round(rating))),
      comment: comment || '',
    },
  })

  const sellerReviews = await prisma.review.findMany({ where: { seller_id: product.owner_id } })
  const avgScore = sellerReviews.reduce((s, r) => s + r.rating, 0) / sellerReviews.length
  const totalRev = sellerReviews.length

  const sellerUser = await prisma.user.findUnique({ where: { id: product.owner_id } })
  if (sellerUser) {
    await prisma.user.update({
      where: { id: product.owner_id },
      data: {
        seller_info: {
          ...(sellerUser.seller_info || {}),
          reputation: {
            score: +avgScore.toFixed(1),
            total_reviews: totalRev,
            status: totalRev >= 5 ? 'VERIFICADO' : totalRev >= 1 ? 'NUEVO_VENDEDOR' : 'NUEVO_VENDEDOR',
          },
        },
      },
    })
  }

  return {
    review_id: review.id,
    new_seller_average: +avgScore.toFixed(1),
    total_reviews: totalRev,
    status: totalRev >= 5 ? 'VERIFICADO' : totalRev >= 1 ? 'NUEVO_VENDEDOR' : 'NUEVO_VENDEDOR',
  }
}

export async function getProductReviews(productId) {
  return prisma.review.findMany({ where: { product_id: productId }, orderBy: { created_at: 'desc' } })
}

export async function getSellerReviews(sellerId) {
  return prisma.review.findMany({ where: { seller_id: sellerId }, orderBy: { created_at: 'desc' } })
}

function buildConversationId(userA, userB, productId) {
  const sorted = [userA, userB].sort()
  return `conv-${sorted[0].slice(0, 8)}-${sorted[1].slice(0, 8)}-${(productId || 'general').slice(0, 8)}`
}

export async function sendMessage(fromUserId, fromName, toUserId, productId, message) {
  const convId = buildConversationId(fromUserId, toUserId, productId)

  const product = productId ? await getProductById(productId) : null

  await prisma.conversation.upsert({
    where: { id: convId },
    update: {
      last_message: message,
      last_sender: fromName,
      last_message_at: new Date(),
    },
    create: {
      id: convId,
      product_id: productId || null,
      product_title: product?.title || null,
      last_message: message,
      last_sender: fromName,
      last_message_at: new Date(),
    },
  })

  for (const uid of [fromUserId, toUserId]) {
    await prisma.conversationParticipant.upsert({
      where: { conversation_id_user_id: { conversation_id: convId, user_id: uid } },
      update: {},
      create: { conversation_id: convId, user_id: uid },
    })
  }

  const msg = await prisma.message.create({
    data: {
      conversation_id: convId,
      sender_id: fromUserId,
      receiver_id: toUserId,
      product_id: productId || null,
      product_title: product?.title || null,
      text: message,
    },
  })

  return {
    id: msg.id,
    conversation_id: msg.conversation_id,
    sender_id: msg.sender_id,
    sender_name: fromName,
    receiver_id: msg.receiver_id,
    product_id: msg.product_id,
    text: msg.text,
    read: msg.read,
    created_at: msg.created_at?.toISOString?.() || msg.created_at,
  }
}

export async function getUserConversations(userId) {
  const participations = await prisma.conversationParticipant.findMany({
    where: { user_id: userId },
    include: { conversation: true },
  })

  const convs = participations
    .map((p) => p.conversation)
    .filter(Boolean)
    .sort((a, b) => {
      const da = a.last_message_at ? new Date(a.last_message_at).getTime() : 0
      const db = b.last_message_at ? new Date(b.last_message_at).getTime() : 0
      return db - da
    })

  const result = []
  for (const c of convs) {
    const otherId = (await prisma.conversationParticipant.findMany({ where: { conversation_id: c.id } }))
      .find((p) => p.user_id !== userId)?.user_id
    const otherUser = otherId ? await getUserById(otherId) : null
    result.push({
      conversation_id: c.id,
      product_title: c.product_title,
      last_message: c.last_message,
      last_sender: c.last_sender,
      last_message_at: c.last_message_at?.toISOString?.() || c.last_message_at,
      other_user: {
        id: otherId,
        name: otherUser?.profile?.full_name || otherUser?.email || 'Usuario',
      },
    })
  }
  return result
}

export async function getConversationMessages(convId) {
  const messages = await prisma.message.findMany({
    where: { conversation_id: convId },
    orderBy: { created_at: 'asc' },
  })
  return messages.map((m) => ({
    id: m.id,
    sender_id: m.sender_id,
    text: m.text,
    timestamp: m.created_at?.toISOString?.() || m.created_at,
  }))
}

export async function getUserMessages(userId) {
  const messages = await prisma.message.findMany({
    where: { OR: [{ sender_id: userId }, { receiver_id: userId }] },
    orderBy: { created_at: 'desc' },
  })
  return messages.map((m) => ({
    ...m,
    created_at: m.created_at?.toISOString?.() || m.created_at,
  }))
}

export async function markMessageRead(messageId) {
  try {
    await prisma.message.update({ where: { id: messageId }, data: { read: true } })
  } catch {}
}

export async function getUnreadCount(userId) {
  try {
    const count = await prisma.message.count({
      where: { receiver_id: userId, read: false },
    })
    return count
  } catch {
    return 0
  }
}

export async function getMessagesWithUser(myId, otherUserId) {
  const messages = await prisma.message.findMany({
    where: {
      OR: [
        { sender_id: myId, receiver_id: otherUserId },
        { sender_id: otherUserId, receiver_id: myId },
      ],
    },
    orderBy: { created_at: 'asc' },
  })
  return messages.map((m) => ({
    id: m.id,
    conversation_id: m.conversation_id,
    sender_id: m.sender_id,
    text: m.text,
    product_title: m.product_title,
    product_id: m.product_id,
    timestamp: m.created_at?.toISOString?.() || m.created_at,
  }))
}

export async function blockUser(blockerId, blockedId) {
  await prisma.block.upsert({
    where: { blocker_id_blocked_id: { blocker_id: blockerId, blocked_id: blockedId } },
    update: {},
    create: { blocker_id: blockerId, blocked_id: blockedId },
  })
}

export async function unblockUser(blockerId, blockedId) {
  try {
    await prisma.block.delete({
      where: { blocker_id_blocked_id: { blocker_id: blockerId, blocked_id: blockedId } },
    })
  } catch {}
}

export async function isBlocked(userId, otherUserId) {
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blocker_id: userId, blocked_id: otherUserId },
        { blocker_id: otherUserId, blocked_id: userId },
      ],
    },
  })
  return !!block
}

export async function getWishlist(userId) {
  const items = await prisma.wishlistItem.findMany({
    where: { user_id: userId },
    include: { product: true },
  })
  return items.map((i) => i.product)
}

export async function toggleWishlist(userId, productId) {
  const existing = await prisma.wishlistItem.findUnique({
    where: { user_id_product_id: { user_id: userId, product_id: productId } },
  })

  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } })
    const remaining = await prisma.wishlistItem.findMany({
      where: { user_id: userId },
      select: { product_id: true },
    })
    return { added: false, wishlist: remaining.map((r) => r.product_id) }
  } else {
    await prisma.wishlistItem.create({ data: { user_id: userId, product_id: productId } })
    const all = await prisma.wishlistItem.findMany({
      where: { user_id: userId },
      select: { product_id: true },
    })
    return { added: true, wishlist: all.map((r) => r.product_id) }
  }
}

export async function isInWishlist(userId, productId) {
  const count = await prisma.wishlistItem.count({
    where: { user_id: userId, product_id: productId },
  })
  return count > 0
}

export async function createNotification(userId, type, title, message, link) {
  const notif = await prisma.notification.create({
    data: {
      user_id: userId,
      type: type || null,
      title,
      message,
      link: link || null,
    },
  })

  const user = await getUserById(userId)
  if (user?.email) {
    console.log(`[EMAIL SIMULADO] Para: ${user.email} | Asunto: ${title} | Mensaje: ${message}`)
  }

  return {
    ...notif,
    created_at: notif.created_at?.toISOString?.() || notif.created_at,
  }
}

export async function getUserNotifications(userId) {
  const notifs = await prisma.notification.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
  })
  return notifs.map((n) => ({
    ...n,
    created_at: n.created_at?.toISOString?.() || n.created_at,
  }))
}

export async function markNotificationRead(notifId) {
  try {
    await prisma.notification.update({ where: { id: notifId }, data: { is_read: true } })
  } catch {}
}

export async function getUnreadNotificationCount(userId) {
  return prisma.notification.count({
    where: { user_id: userId, is_read: false },
  })
}

export async function updateUserRole(userId, updates) {
  try {
    const data = {}
    if (updates.is_admin !== undefined) data.is_admin = updates.is_admin
    if (updates.is_seller !== undefined) data.is_seller = updates.is_seller
    if (updates.onboarding_completed !== undefined) data.onboarding_completed = updates.onboarding_completed
    if (updates.role_status !== undefined) data.role_status = updates.role_status
    const user = await prisma.user.update({ where: { id: userId }, data })
    return pruneUser(user)
  } catch {
    return null
  }
}

export async function getProductDetail(id) {
  const product = await getProductById(id)
  if (!product) return null

  const ownerUser = await getUserById(product.owner_id)
  const profile = ownerUser?.profile?.academic_info
    ? { career: ownerUser.profile.academic_info.career, faculty: ownerUser.profile.academic_info.faculty }
    : { career: 'Miembro de la comunidad', faculty: 'Universidad de La Sabana' }

  const related = await prisma.product.findMany({
    where: { id: { not: id }, category: product.category, status: 'ACTIVO' },
    take: 4,
    orderBy: { created_at: 'desc' },
  })

  return {
    product: {
      id: product.id,
      title: product.title,
      description: product.description,
      price: product.price,
      currency: 'COP',
      condition: product.condition,
      stock: product.stock,
      images: Array.isArray(product.images) ? product.images : [],
      category: product.category,
    },
    seller: {
      id: product.owner_id,
      name: ownerUser?.profile?.full_name || ownerUser?.email || 'Vendedor',
      career: profile.career,
      faculty: profile.faculty,
      reputation_score: product.seller_info?.reputation?.score || 5.0,
      total_reviews: product.seller_info?.reputation?.total_reviews || 0,
      is_verified_student: ownerUser?.email?.endsWith?.('@unisabana.edu.co') || false,
    },
    related_products: related.map((p) => ({
      id: p.id,
      title: p.title,
      price: p.price,
      category: p.category,
      thumbnail: Array.isArray(p.images) ? p.images[0] || null : null,
    })),
  }
}

export async function createReport(reportedById, productId, reason) {
  const product = await getProductById(productId)
  if (!product) return null

  const reporter = await getUserById(reportedById)

  const report = await prisma.report.create({
    data: {
      product_id: productId,
      reason,
      reported_by: reporter?.email || 'desconocido',
      reported_by_id: reportedById,
      product_title: product.title,
      seller_name: product.seller_info?.store_name || 'Desconocido',
      status: 'PENDING',
    },
  })
  return report
}

export async function getPendingReports() {
  return prisma.report.findMany({ where: { status: 'PENDING' }, orderBy: { created_at: 'desc' } })
}

export async function getAllReports() {
  return prisma.report.findMany({ orderBy: { created_at: 'desc' } })
}

export async function moderateProduct(productId, action, reason) {
  const product = await prisma.product.findUnique({ where: { id: productId } })
  if (!product) return null

  const newStatus = action === 'SUSPEND' ? 'SUSPENDIDO' : 'ACTIVO'
  await prisma.product.update({ where: { id: productId }, data: { status: newStatus } })

  await prisma.report.updateMany({
    where: { product_id: productId, status: 'PENDING' },
    data: {
      status: action === 'SUSPEND' ? 'RESOLVED_SUSPENDED' : 'RESOLVED_ACTIVATED',
      resolution_reason: reason,
      resolved_at: new Date(),
    },
  })

  return { product_id: productId, status: newStatus }
}

export async function getAnalytics() {
  const [users, products, orders, allOrders] = await Promise.all([
    prisma.user.findMany({ orderBy: { created_at: 'asc' } }),
    prisma.product.findMany(),
    prisma.order.findMany({ orderBy: { created_at: 'asc' } }),
    getAllOrders(),
  ])

  // Registros por mes (últimos 12)
  const now = new Date()
  const registrations = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = d.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })
    const count = users.filter((u) => {
      const c = new Date(u.created_at)
      return c.getMonth() === d.getMonth() && c.getFullYear() === d.getFullYear()
    }).length
    registrations.push({ month: label, usuarios: count })
  }

  // Ingresos por mes (últimos 12)
  const revenue = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = d.toLocaleDateString('es-CO', { month: 'short', year: 'numeric' })
    const monthOrders = allOrders.filter((o) => {
      const c = new Date(o.created_at)
      return c.getMonth() === d.getMonth() && c.getFullYear() === d.getFullYear()
    })
    const total = monthOrders.reduce((sum, o) => sum + (o.total || 0), 0)
    const count = monthOrders.length
    revenue.push({ month: label, ingresos: total, ordenes: count })
  }

  return { registrations, revenue }
}
