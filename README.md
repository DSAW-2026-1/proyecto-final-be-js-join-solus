# Marketplace Sabana — Backend

![Marketplace Sabana](https://proyecto-final-fe-js-join-solus.vercel.app/logomarketplace.png)

**Plataforma de comercio electrónico para la comunidad de la Universidad de La Sabana.**  
Este repositorio contiene el backend de la aplicación, construido con Node.js, Express, Prisma y PostgreSQL.

## Enlace de la aplicación

[https://proyecto-final-fe-js-join-solus.vercel.app/](https://proyecto-final-fe-js-join-solus.vercel.app/)

## Resumen Ejecutivo

Marketplace Sabana es una plataforma que permite a estudiantes, egresados, docentes y administrativos de la Universidad de La Sabana publicar y comprar productos dentro de la comunidad universitaria. El backend expone una API RESTful que maneja autenticación, productos, órdenes, carrito de compras, mensajería interna, notificaciones, reseñas, wishlist, reportes y un panel de administración con auditoría.

### Arquitectura

- **Runtime:** Node.js con Express
- **Base de datos:** PostgreSQL en Neon (cloud) con Prisma ORM
- **Autenticación:** JWT con login por email (sin OAuth)
- **Mensajería:** Socket.IO para chat en tiempo real
- **Imágenes:** Almacenamiento local en desarrollo / Cloudinary en producción
- **Despliegue:** Vercel (serverless functions)
- **Rate limiting:** In-memory con express-rate-limit
- **Validación:** Zod schemas
- **Tests:** Vitest (43 tests)

### Funcionalidades principales

- Autenticación y perfiles de usuario (comprador/vendedor/admin)
- Publicación y gestión de productos con imágenes
- Carrito de compras y checkout con dirección de envío
- Órdenes con seguimiento de estado
- Chat en tiempo real con notificaciones
- Bloqueo de usuarios
- Reseñas y calificaciones de productos
- Wishlist
- Reportes de contenido
- Panel de administración con estadísticas y auditoría
- Notificaciones push y por correo electrónico
- Sanitización XSS, CORS, y limitación de tasa

### Tecnologías

Express, Prisma, PostgreSQL, Socket.IO, JWT, Zod, Cloudinary, Multer, Sentry, Pino, Nodemailer, Vitest
