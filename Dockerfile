# Etapa 1: Instalacion de dependencias
FROM node:20-alpine AS deps

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm ci --only=production --ignore-scripts && npm cache clean --force

# Etapa 2: Build (generar Prisma Client + preparar migraciones)
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY prisma ./prisma
RUN npx prisma generate

# Etapa 3: Produccion
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl wget ca-certificates tzdata && \
    cp /usr/share/zoneinfo/America/Bogota /etc/localtime && \
    echo "America/Bogota" > /etc/timezone

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
COPY . .

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:8080/api/health | grep -q '"ok"' || exit 1

# Run migrations on startup, then start the app
CMD ["sh", "-c", "npx prisma migrate deploy && node -r dotenv/config index.js"]
