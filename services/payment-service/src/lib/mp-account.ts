import { prisma } from "./prisma"
import { encrypt, decrypt } from "./crypto"
import {
  refreshAccessToken,
  MpTokens,
  exchangeCodeForToken,
  getAccountInfo,
} from "./mercadopago"

export class MpNotConnectedError extends Error {
  constructor(tenantId: string) {
    super(`Tenant ${tenantId} não tem Mercado Pago conectado`)
    this.name = "MpNotConnectedError"
  }
}

export async function saveConnection(
  tenantId: string,
  tokens: MpTokens,
  nickname: string | null
): Promise<void> {
  await prisma.mercadoPagoConnection.upsert({
    where: { tenantId },
    create: {
      tenantId,
      mpUserId: tokens.mpUserId,
      mpNickname: nickname,
      accessToken: encrypt(tokens.accessToken),
      refreshToken: encrypt(tokens.refreshToken),
      publicKey: tokens.publicKey ?? null,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope ?? null,
    },
    update: {
      mpUserId: tokens.mpUserId,
      mpNickname: nickname ?? undefined,
      accessToken: encrypt(tokens.accessToken),
      refreshToken: encrypt(tokens.refreshToken),
      publicKey: tokens.publicKey ?? null,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope ?? null,
      updatedAt: new Date(),
    },
  })
}

export async function saveConnectionFromCode(
  tenantId: string,
  code: string
): Promise<{ nickname: string | null }> {
  const tokens = await exchangeCodeForToken(code)
  let nickname: string | null = null
  try {
    nickname = (await getAccountInfo(tokens.accessToken)).nickname
  } catch {
    // cosmético, segue sem
  }
  await saveConnection(tenantId, tokens, nickname)
  return { nickname }
}

// Retorna o access_token descriptografado, fazendo refresh se expirar em <24h.
export async function getTenantMpToken(tenantId: string): Promise<string> {
  const conn = await prisma.mercadoPagoConnection.findUnique({
    where: { tenantId },
  })
  if (!conn) throw new MpNotConnectedError(tenantId)

  const hoursLeft = (conn.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60)
  if (hoursLeft >= 24) {
    return decrypt(conn.accessToken)
  }

  // Token perto de expirar — faz refresh
  const refreshToken = decrypt(conn.refreshToken)
  const fresh = await refreshAccessToken(refreshToken)
  await saveConnection(tenantId, fresh, conn.mpNickname)
  return fresh.accessToken
}

export async function isTenantConnected(tenantId: string): Promise<boolean> {
  const conn = await prisma.mercadoPagoConnection.findUnique({
    where: { tenantId },
    select: { id: true },
  })
  return !!conn
}

export async function getConnectionInfo(tenantId: string) {
  const conn = await prisma.mercadoPagoConnection.findUnique({
    where: { tenantId },
    select: {
      mpUserId: true,
      mpNickname: true,
      expiresAt: true,
      connectedAt: true,
      scope: true,
    },
  })
  if (!conn) return null
  return {
    connected: true,
    mpUserId: conn.mpUserId,
    nickname: conn.mpNickname,
    expiresAt: conn.expiresAt,
    connectedAt: conn.connectedAt,
    scope: conn.scope,
  }
}

export async function disconnect(tenantId: string): Promise<void> {
  await prisma.mercadoPagoConnection.deleteMany({ where: { tenantId } })
}
