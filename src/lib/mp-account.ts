import { prisma } from "@/lib/prisma"
import { encrypt, decrypt } from "@/lib/crypto"
import { refreshAccessToken, type OAuthTokens } from "@/lib/mercadopago"

/**
 * Conexão Mercado Pago por salão (OAuth). Centraliza a leitura/escrita dos
 * tokens (sempre CRIPTOGRAFADOS) e a resolução de um access_token válido,
 * renovando-o automaticamente quando estiver perto de expirar.
 */

// Renova o token se faltar menos que isto para expirar.
const REFRESH_THRESHOLD_MS = 24 * 60 * 60 * 1000 // 24h

export class MpNotConnectedError extends Error {
  constructor() {
    super("Salão não conectou o Mercado Pago")
    this.name = "MpNotConnectedError"
  }
}

/** Persiste (cria/atualiza) a conexão do salão a partir dos tokens do OAuth. */
export async function saveConnection(
  tenantId: string,
  tokens: OAuthTokens,
  mpNickname?: string | null
): Promise<void> {
  const data = {
    mpUserId: tokens.userId,
    accessToken: encrypt(tokens.accessToken),
    refreshToken: encrypt(tokens.refreshToken),
    publicKey: tokens.publicKey,
    expiresAt: tokens.expiresAt,
    scope: tokens.scope,
    ...(mpNickname !== undefined ? { mpNickname } : {}),
  }
  await prisma.mercadoPagoConnection.upsert({
    where: { tenantId },
    update: data,
    create: { tenantId, ...data },
  })
}

/**
 * Retorna um access_token válido do salão, renovando-o se necessário.
 * Lança MpNotConnectedError se o salão não tiver conexão.
 */
export async function getTenantMpToken(tenantId: string): Promise<string> {
  const conn = await prisma.mercadoPagoConnection.findUnique({
    where: { tenantId },
  })
  if (!conn) throw new MpNotConnectedError()

  const expiringSoon =
    conn.expiresAt.getTime() - Date.now() < REFRESH_THRESHOLD_MS

  if (!expiringSoon) {
    return decrypt(conn.accessToken)
  }

  // Renova e persiste o novo par (refresh_token é rotativo).
  const refreshed = await refreshAccessToken(decrypt(conn.refreshToken))
  await prisma.mercadoPagoConnection.update({
    where: { tenantId },
    data: {
      accessToken: encrypt(refreshed.accessToken),
      refreshToken: encrypt(refreshed.refreshToken),
      publicKey: refreshed.publicKey,
      expiresAt: refreshed.expiresAt,
      scope: refreshed.scope,
    },
  })
  return refreshed.accessToken
}

export async function isTenantConnected(tenantId: string): Promise<boolean> {
  const count = await prisma.mercadoPagoConnection.count({ where: { tenantId } })
  return count > 0
}

export interface MpConnectionInfo {
  connected: boolean
  nickname: string | null
  mpUserId: string | null
  connectedAt: Date | null
}

/** Info leve para a UI de configurações (não retorna tokens). */
export async function getTenantConnectionInfo(
  tenantId: string
): Promise<MpConnectionInfo> {
  const conn = await prisma.mercadoPagoConnection.findUnique({
    where: { tenantId },
    select: { mpNickname: true, mpUserId: true, connectedAt: true },
  })
  return {
    connected: !!conn,
    nickname: conn?.mpNickname ?? null,
    mpUserId: conn?.mpUserId ?? null,
    connectedAt: conn?.connectedAt ?? null,
  }
}

export async function disconnect(tenantId: string): Promise<void> {
  await prisma.mercadoPagoConnection.deleteMany({ where: { tenantId } })
}
