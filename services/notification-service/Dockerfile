FROM node:22-alpine AS builder

WORKDIR /app

# Copiar manifests de dependências
COPY services/notification-service/package.json ./services/notification-service/
COPY services/shared/ ./services/shared/

WORKDIR /app/services/notification-service
RUN npm ci

# Copiar código e gerar Prisma client
COPY services/notification-service/ .
RUN npx prisma generate
RUN npm run build

# ─────────────────────────────────────────────
# Runtime image (menor, sem devDependencies)
# ─────────────────────────────────────────────

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/services/notification-service/dist ./dist
COPY --from=builder /app/services/notification-service/node_modules ./node_modules
COPY --from=builder /app/services/notification-service/prisma ./prisma
COPY --from=builder /app/services/notification-service/package.json ./

EXPOSE 3007

# Saúde do container
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3007/health || exit 1

CMD ["node", "dist/server.js"]
