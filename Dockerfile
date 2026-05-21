# ─── Etapa 1: dependencias de producción ─────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ─── Etapa 2: build completo ──────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Generar cliente Prisma (prisma-client-js)
RUN npx prisma generate

# Build de Next.js (output: standalone)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ─── Etapa 3: imagen de producción (mínima) ───────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Usuario sin privilegios
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Artefactos del build de Next.js (output: standalone)
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Schema y migraciones de Prisma (necesarios para migrate deploy en entrypoint)
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Cliente Prisma generado (node_modules/.prisma + app/generated)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/pg ./node_modules/pg
COPY --from=builder /app/node_modules/@prisma/adapter-pg ./node_modules/@prisma/adapter-pg
COPY --from=builder /app/app/generated ./app/generated

# prisma CLI para ejecutar migrate deploy en entrypoint
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Script de inicio
COPY --from=builder /app/scripts/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Directorio temporal para uploads
RUN mkdir -p /tmp/conductores-uploads \
    && chown nextjs:nodejs /tmp/conductores-uploads

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./entrypoint.sh"]
