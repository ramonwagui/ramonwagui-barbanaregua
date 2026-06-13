FROM node:22-alpine AS builder
WORKDIR /app

# Instala dependências antes de copiar o código (camada cacheável)
COPY services/payment-service/package*.json ./
COPY services/payment-service/prisma ./prisma/

RUN npm ci

COPY services/payment-service/ .
# shared está fora do contexto do serviço — copia como módulo local
COPY services/shared/ ./shared/

RUN npx prisma generate
RUN npm run build

# ── Runtime ───────────────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/shared ./shared

EXPOSE 3005

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3005/health || exit 1

CMD ["node", "dist/server.js"]
