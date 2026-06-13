FROM node:22-alpine AS builder

WORKDIR /app

COPY services/billing-service/package.json ./services/billing-service/
COPY services/shared/ ./services/shared/

WORKDIR /app/services/billing-service
RUN npm ci

COPY services/billing-service/ .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/services/billing-service/dist ./dist
COPY --from=builder /app/services/billing-service/node_modules ./node_modules
COPY --from=builder /app/services/billing-service/prisma ./prisma
COPY --from=builder /app/services/billing-service/package.json ./

EXPOSE 3006

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3006/health || exit 1

CMD ["node", "dist/server.js"]
