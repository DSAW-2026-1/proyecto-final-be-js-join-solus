import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const DEFAULT_PASSWORD = 'password123'

const DEMO_OWNERS = [
  { id: crypto.randomUUID(), email: 'camilomonva@unisabana.edu.co', name: 'Camilo Moncada', career: 'Ingeniería de Sistemas', faculty: 'Facultad de Ingeniería' },
  { id: crypto.randomUUID(), email: 'mariagarcia@unisabana.edu.co', name: 'María García', career: 'Administración de Empresas', faculty: 'Facultad de Ciencias Económicas' },
  { id: crypto.randomUUID(), email: 'andresperez@unisabana.edu.co', name: 'Andrés Pérez', career: 'Ingeniería Civil', faculty: 'Facultad de Ingeniería' },
  { id: crypto.randomUUID(), email: 'laurarinc@unisabana.edu.co', name: 'Laura Rincón', career: 'Ingeniería de Sistemas', faculty: 'Facultad de Ingeniería' },
  { id: crypto.randomUUID(), email: 'ce@unisabana.edu.co', name: 'Centro Estudiantes', career: 'Centro de Estudiantes', faculty: 'Bienestar Universitario' },
  { id: crypto.randomUUID(), email: 'deportes@unisabana.edu.co', name: 'Tienda Deportiva US', career: 'Administración Deportiva', faculty: 'Facultad de Ingeniería' },
  { id: crypto.randomUUID(), email: 'carlosvega@unisabana.edu.co', name: 'Carlos Vega', career: 'Música', faculty: 'Facultad de Comunicación' },
  { id: crypto.randomUUID(), email: 'juanortiz@unisabana.edu.co', name: 'Juan Ortiz', career: 'Arquitectura', faculty: 'Facultad de Arquitectura' },
  { id: crypto.randomUUID(), email: 'anatorres@unisabana.edu.co', name: 'Ana Torres', career: 'Diseño de Productos', faculty: 'Facultad de Arquitectura' },
  { id: crypto.randomUUID(), email: 'juegos@unisabana.edu.co', name: 'Juego y Aprende US', career: 'Centro de Recreación', faculty: 'Bienestar Universitario' },
  { id: crypto.randomUUID(), email: 'tech@unisabana.edu.co', name: 'TechStore US', career: 'Ingeniería de Sistemas', faculty: 'Facultad de Ingeniería' },
  { id: crypto.randomUUID(), email: 'camilomova@unisabana.edu.co', name: 'Profe Camilo', career: 'Ingeniería Informática', faculty: 'Facultad de Ingeniería' },
]

const DEMO_PRODUCTS_DATA = [
  { title: 'Hamburguesa Especial', description: 'Doble carne, queso cheddar y tocineta. Incluye papas.', price: 18000, category: 'comidas', condition: 'nuevo', stock: 120, ownerIdx: 0 },
  { title: 'Salchipapa King Size', description: 'Salchicha americana con papas a la francesa y salsas.', price: 11800, category: 'comidas', condition: 'nuevo', stock: 80, ownerIdx: 1 },
  { title: 'Cálculo Diferencial - Stewart', description: 'Libro de cálculo en excelente estado. 7ma edición.', price: 85000, category: 'libros', condition: 'como_nuevo', stock: 1, ownerIdx: 2 },
  { title: 'Teclado Mecánico Redragon', description: 'Teclado mecánico RGB, switches rojos.', price: 145000, category: 'tecnologia', condition: 'bueno', stock: 1, ownerIdx: 3 },
  { title: 'Camiseta Universidad de La Sabana', description: 'Camiseta oficial del centro de estudiantes.', price: 45000, category: 'ropa', condition: 'nuevo', stock: 30, ownerIdx: 4 },
  { title: 'Balón de Fútbol #5', description: 'Balón profesional microfibra. Ideal para la cancha de la universidad.', price: 62000, category: 'deportes', condition: 'nuevo', stock: 15, ownerIdx: 5 },
  { title: 'Guitarra Acústica Yamaha', description: 'Guitarra en buen estado, incluye funda.', price: 320000, category: 'musica', condition: 'bueno', stock: 1, ownerIdx: 6 },
  { title: 'Escritorio en L', description: 'Escritorio de madera con espacio para monitor.', price: 180000, category: 'muebles', condition: 'aceptable', stock: 1, ownerIdx: 7 },
  { title: 'Clases de Programación Web', description: 'Ofrezco tutorías de React, Node.js y bases de datos.', price: 25000, category: 'servicios', condition: 'nuevo', stock: 50, ownerIdx: 11 },
  { title: 'Kit de Acuarelas 24 colores', description: 'Set profesional de acuarelas. Ideal para clase de arte.', price: 38000, category: 'arte', condition: 'nuevo', stock: 10, ownerIdx: 8 },
  { title: 'Juego de Mesa - Catan', description: 'Clásico juego de estrategia. Completo.', price: 95000, category: 'juegos', condition: 'como_nuevo', stock: 1, ownerIdx: 9 },
  { title: 'Audífonos Sony WH-1000XM5', description: 'Cancelación de ruido activa, excelente sonido.', price: 650000, category: 'tecnologia', condition: 'nuevo', stock: 3, ownerIdx: 10 },
]

async function main() {
  const password_hash = await bcrypt.hash(DEFAULT_PASSWORD, 12)

  const existingUsers = await prisma.user.count()
  if (existingUsers > 0) {
    const usersWithoutHash = await prisma.user.findMany({ where: { password_hash: null } })
    for (const u of usersWithoutHash) {
      await prisma.user.update({ where: { id: u.id }, data: { password_hash } })
    }
    if (usersWithoutHash.length > 0) {
      console.log(`Password hash added to ${usersWithoutHash.length} existing users`)
    } else {
      console.log('Database already has data and all users have password_hash, skipping seed.')
    }
    return
  }

  for (const owner of DEMO_OWNERS) {
    await prisma.user.create({
      data: {
        id: owner.id,
        email: owner.email,
        password_hash,
        is_internal: true,
        is_seller: true,
        onboarding_completed: true,
        role_status: 'VENDEDOR',
        profile: { full_name: owner.name, profile_picture: 'blue', bio: '', academic_info: { is_student: true, career: owner.career, faculty: owner.faculty } },
        seller_info: {
          store_name: `${owner.name.split(' ')[0]} Store`,
          reputation: { score: +(4 + Math.random()).toFixed(1), total_reviews: Math.floor(Math.random() * 20), status: 'VERIFICADO' },
        },
        permissions: { can_buy: true, can_sell: true },
      },
    })
  }

  const adminUser = {
    id: crypto.randomUUID(),
    email: 'camilomova@unisabana.edu.co',
    password_hash,
    is_internal: true,
    is_admin: true,
    is_seller: true,
    onboarding_completed: true,
    role_status: 'ADMIN',
    profile: { full_name: 'Camilo Moncada', profile_picture: 'purple', bio: 'Administrador de la plataforma', academic_info: { is_student: true, career: 'Ingeniería Informática', faculty: 'Facultad de Ingeniería' } },
    seller_info: { store_name: 'Camilo Store', reputation: { score: 5.0, total_reviews: 0, status: 'VERIFICADO' } },
    permissions: { can_buy: true, can_sell: true },
  }
  await prisma.user.upsert({
    where: { email: 'camilomova@unisabana.edu.co' },
    update: {},
    create: adminUser,
  })

  for (let i = 0; i < DEMO_PRODUCTS_DATA.length; i++) {
    const d = DEMO_PRODUCTS_DATA[i]
    const owner = DEMO_OWNERS[d.ownerIdx]
    const score = +(4 + Math.random()).toFixed(1)
    await prisma.product.create({
      data: {
        title: d.title,
        description: d.description,
        price: d.price,
        category: d.category,
        condition: d.condition,
        stock: d.stock,
        images: [],
        status: 'ACTIVO',
        owner_id: owner.id,
        seller_info: {
          store_name: `${owner.name.split(' ')[0]} Store`,
          reputation: { score, total_reviews: Math.floor(Math.random() * 20), status: 'VERIFICADO' },
        },
        created_at: new Date(Date.now() - i * 3600000),
      },
    })
  }

  console.log('Seed completed: 12 users + 12 products created')
}

main()
  .catch((e) => { console.error('Seed error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
