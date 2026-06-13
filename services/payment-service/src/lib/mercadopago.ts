// Cliente REST Mercado Pago (sem SDK oficial — controle total sobre headers).

const BASE = "https://api.mercadopago.com"

export function isMercadoPagoConfigured(): boolean {
  return !!(process.env.MERCADOPAGO_CLIENT_ID && process.env.MERCADOPAGO_CLIENT_SECRET)
}

export function getAuthorizationUrl(state: string): string {
  const clientId = process.env.MERCADOPAGO_CLIENT_ID ?? ""
  const redirectUri = encodeURIComponent(
    `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/api/mp/callback`
  )
  return `https://auth.mercadopago.com.br/authorization?client_id=${clientId}&response_type=code&platform_id=mp&state=${state}&redirect_uri=${redirectUri}`
}

export interface MpTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date
  mpUserId: string
  scope: string
  publicKey?: string
}

export async function exchangeCodeForToken(code: string): Promise<MpTokens> {
  const redirectUri = `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/api/mp/callback`
  const res = await fetch(`${BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.MERCADOPAGO_CLIENT_ID,
      client_secret: process.env.MERCADOPAGO_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`MP exchangeCode ${res.status}: ${JSON.stringify(err)}`)
  }
  return parseTokenResponse(await res.json())
}

export async function refreshAccessToken(refreshToken: string): Promise<MpTokens> {
  const res = await fetch(`${BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.MERCADOPAGO_CLIENT_ID,
      client_secret: process.env.MERCADOPAGO_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`MP refreshToken ${res.status}: ${JSON.stringify(err)}`)
  }
  return parseTokenResponse(await res.json())
}

function parseTokenResponse(data: Record<string, unknown>): MpTokens {
  const expiresIn = (data["expires_in"] as number) ?? 15552000
  return {
    accessToken: String(data["access_token"] ?? ""),
    refreshToken: String(data["refresh_token"] ?? ""),
    expiresAt: new Date(Date.now() + expiresIn * 1000),
    mpUserId: String(data["user_id"] ?? ""),
    scope: String(data["scope"] ?? ""),
    publicKey: data["public_key"] ? String(data["public_key"]) : undefined,
  }
}

export async function getAccountInfo(accessToken: string): Promise<{ nickname: string }> {
  const res = await fetch(`${BASE}/users/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`MP getAccountInfo ${res.status}`)
  const data = await res.json()
  return { nickname: String(data.nickname ?? "") }
}

export interface CreatePixParams {
  amount: number
  description: string
  payerEmail: string
  externalReference: string
  expiresAt: Date
  notificationUrl: string
}

export interface PixResult {
  id: string
  qrCode: string
  qrCodeBase64: string
}

export async function createPixPayment(
  params: CreatePixParams,
  accessToken: string
): Promise<PixResult> {
  const res = await fetch(`${BASE}/v1/payments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      "X-Idempotency-Key": params.externalReference,
    },
    body: JSON.stringify({
      transaction_amount: params.amount,
      description: params.description,
      payment_method_id: "pix",
      payer: { email: params.payerEmail },
      external_reference: params.externalReference,
      date_of_expiration: params.expiresAt.toISOString(),
      notification_url: params.notificationUrl,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`MP createPix ${res.status}: ${JSON.stringify(err)}`)
  }
  const data = await res.json()
  const pix = data.point_of_interaction?.transaction_data
  return {
    id: String(data.id),
    qrCode: String(pix?.qr_code ?? ""),
    qrCodeBase64: String(pix?.qr_code_base64 ?? ""),
  }
}

export interface MpPayment {
  id: string
  status: string
  statusDetail: string
  amount: number
}

export async function getPayment(
  providerPaymentId: string,
  accessToken: string
): Promise<MpPayment> {
  const res = await fetch(`${BASE}/v1/payments/${providerPaymentId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`MP getPayment ${res.status}`)
  const data = await res.json()
  return {
    id: String(data.id),
    status: String(data.status),
    statusDetail: String(data.status_detail ?? ""),
    amount: Number(data.transaction_amount ?? 0),
  }
}

export async function refundPayment(
  providerPaymentId: string,
  accessToken: string
): Promise<void> {
  const res = await fetch(`${BASE}/v1/payments/${providerPaymentId}/refunds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`MP refund ${res.status}: ${JSON.stringify(err)}`)
  }
}
