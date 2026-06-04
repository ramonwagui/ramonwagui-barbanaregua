import { randomUUID } from "crypto"

/**
 * Integração com o Mercado Pago via REST (sem SDK), seguindo o padrão do
 * projeto (Z-API e Upstash também falam REST puro). Usada para cobrar o
 * "sinal" (depósito) do agendamento via PIX.
 *
 * MARKETPLACE / OAUTH: cada salão conecta a própria conta do Mercado Pago.
 * As operações de pagamento recebem o `accessToken` DO SALÃO por parâmetro
 * (resolvido em src/lib/mp-account.ts), de modo que o dinheiro caia direto na
 * conta do salão. As funções de OAuth abaixo usam as credenciais da PLATAFORMA
 * (MERCADOPAGO_CLIENT_ID / MERCADOPAGO_CLIENT_SECRET).
 */

const MP_API = "https://api.mercadopago.com"
const MP_AUTH = "https://auth.mercadopago.com.br/authorization"

export class MercadoPagoNotConfiguredError extends Error {
  constructor() {
    super("Mercado Pago não configurado na plataforma (CLIENT_ID/SECRET)")
    this.name = "MercadoPagoNotConfiguredError"
  }
}

export class MercadoPagoError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "MercadoPagoError"
    this.status = status
  }
}

/** A plataforma está apta a fazer OAuth (tem app marketplace configurado)? */
export function isMercadoPagoConfigured(): boolean {
  return (
    !!process.env.MERCADOPAGO_CLIENT_ID &&
    !!process.env.MERCADOPAGO_CLIENT_SECRET
  )
}

function getClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.MERCADOPAGO_CLIENT_ID
  const clientSecret = process.env.MERCADOPAGO_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new MercadoPagoNotConfiguredError()
  return { clientId, clientSecret }
}

/** URI de retorno do OAuth, derivada da URL pública do app. */
export function getRedirectUri(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    ""
  )
  return `${base}/api/mp/callback`
}

async function mpFetch(
  path: string,
  init: RequestInit & { accessToken: string; idempotencyKey?: string }
): Promise<unknown> {
  const { idempotencyKey, accessToken, ...rest } = init
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> | undefined),
  }
  if (idempotencyKey) headers["X-Idempotency-Key"] = idempotencyKey

  const res = await fetch(`${MP_API}${path}`, { ...rest, headers })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null

  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : undefined) ?? `Mercado Pago retornou ${res.status}`
    throw new MercadoPagoError(message, res.status)
  }
  return data
}

// ─────────────────────────────────────────────
// OAUTH (credenciais da PLATAFORMA)
// ─────────────────────────────────────────────

/** Monta a URL de autorização para o dono do salão conectar a conta dele. */
export function getAuthorizationUrl(state: string): string {
  const { clientId } = getClientCredentials()
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    platform_id: "mp",
    state,
    redirect_uri: getRedirectUri(),
  })
  return `${MP_AUTH}?${params.toString()}`
}

export interface OAuthTokens {
  accessToken: string
  refreshToken: string
  userId: string
  publicKey: string | null
  scope: string | null
  /** Expiração absoluta calculada a partir de expires_in. */
  expiresAt: Date
}

function parseTokenResponse(data: {
  access_token: string
  refresh_token: string
  user_id: number | string
  public_key?: string
  scope?: string
  expires_in: number
}): OAuthTokens {
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    userId: String(data.user_id),
    publicKey: data.public_key ?? null,
    scope: data.scope ?? null,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  }
}

async function oauthToken(body: Record<string, string>): Promise<OAuthTokens> {
  const res = await fetch(`${MP_API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "message" in data
        ? String((data as { message: unknown }).message)
        : undefined) ?? `Mercado Pago OAuth retornou ${res.status}`
    throw new MercadoPagoError(message, res.status)
  }
  return parseTokenResponse(data)
}

/** Troca o `code` do callback por tokens do salão. */
export async function exchangeCodeForToken(code: string): Promise<OAuthTokens> {
  const { clientId, clientSecret } = getClientCredentials()
  return oauthToken({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
  })
}

/** Renova o access_token usando o refresh_token (que é rotativo no MP). */
export async function refreshAccessToken(
  refreshToken: string
): Promise<OAuthTokens> {
  const { clientId, clientSecret } = getClientCredentials()
  return oauthToken({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  })
}

// ─────────────────────────────────────────────
// PAGAMENTOS (access_token DO SALÃO)
// ─────────────────────────────────────────────

export type MpPaymentStatus =
  | "pending"
  | "approved"
  | "authorized"
  | "in_process"
  | "in_mediation"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back"

export interface PixPaymentResult {
  id: string
  status: MpPaymentStatus
  /** Código copia-e-cola do PIX */
  qrCode: string
  /** Imagem do QR Code em base64 (sem o prefixo data:) */
  qrCodeBase64: string
  ticketUrl?: string
}

export interface CreatePixPaymentInput {
  /** Valor em reais (ex.: 25.5) */
  amount: number
  description: string
  payerEmail: string
  /** Referência externa — usamos o id do Payment para reconciliar no webhook */
  externalReference: string
  /** Quando o PIX expira (define date_of_expiration) */
  expiresAt: Date
  /** URL pública para o Mercado Pago notificar (webhook) */
  notificationUrl?: string
}

export async function createPixPayment(
  input: CreatePixPaymentInput,
  accessToken: string
): Promise<PixPaymentResult> {
  const body = {
    transaction_amount: Number(input.amount.toFixed(2)),
    description: input.description,
    payment_method_id: "pix",
    external_reference: input.externalReference,
    date_of_expiration: input.expiresAt.toISOString(),
    notification_url: input.notificationUrl,
    payer: { email: input.payerEmail },
  }

  const data = (await mpFetch("/v1/payments", {
    method: "POST",
    body: JSON.stringify(body),
    idempotencyKey: input.externalReference,
    accessToken,
  })) as {
    id: number
    status: MpPaymentStatus
    point_of_interaction?: {
      transaction_data?: {
        qr_code?: string
        qr_code_base64?: string
        ticket_url?: string
      }
    }
  }

  const tx = data.point_of_interaction?.transaction_data
  return {
    id: String(data.id),
    status: data.status,
    qrCode: tx?.qr_code ?? "",
    qrCodeBase64: tx?.qr_code_base64 ?? "",
    ticketUrl: tx?.ticket_url,
  }
}

export interface MpPayment {
  id: string
  status: MpPaymentStatus
  externalReference: string | null
  amount: number
}

export async function getPayment(
  id: string,
  accessToken: string
): Promise<MpPayment> {
  const data = (await mpFetch(`/v1/payments/${id}`, {
    method: "GET",
    accessToken,
  })) as {
    id: number
    status: MpPaymentStatus
    external_reference: string | null
    transaction_amount: number
  }
  return {
    id: String(data.id),
    status: data.status,
    externalReference: data.external_reference,
    amount: data.transaction_amount,
  }
}

export interface MpAccountInfo {
  id: string
  nickname: string | null
  email: string | null
}

/** Dados da conta dona do access_token (usado p/ exibir "Conectado como ..."). */
export async function getAccountInfo(
  accessToken: string
): Promise<MpAccountInfo> {
  const data = (await mpFetch("/users/me", {
    method: "GET",
    accessToken,
  })) as { id: number; nickname?: string; email?: string }
  return {
    id: String(data.id),
    nickname: data.nickname ?? null,
    email: data.email ?? null,
  }
}

/**
 * Estorna um pagamento. Sem amount → estorno total.
 */
export async function refundPayment(
  id: string,
  accessToken: string,
  amount?: number
): Promise<void> {
  await mpFetch(`/v1/payments/${id}/refunds`, {
    method: "POST",
    body: amount ? JSON.stringify({ amount: Number(amount.toFixed(2)) }) : "{}",
    idempotencyKey: randomUUID(),
    accessToken,
  })
}
