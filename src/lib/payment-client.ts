const PAYMENT_URL = (process.env.PAYMENT_SERVICE_URL ?? "http://localhost:3005").replace(/\/$/, "")
const INTERNAL_KEY = process.env.INTERNAL_API_KEY ?? ""

const internalHeaders = {
  "Content-Type": "application/json",
  "x-internal-key": INTERNAL_KEY,
}

export interface CreatePixResult {
  paymentId: string
  pixCode: string
  pixQrCode: string
}

async function createPix(opts: {
  tenantId: string
  appointmentId?: string
  packageId?: string
  amount: number
  payerEmail: string
  description: string
  expiresAt: Date
  notificationUrl: string
  kind: "appointment" | "package"
}): Promise<CreatePixResult> {
  const res = await fetch(`${PAYMENT_URL}/payments`, {
    method: "POST",
    headers: internalHeaders,
    body: JSON.stringify({ ...opts, expiresAt: opts.expiresAt.toISOString() }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Payment Service createPix HTTP ${res.status}: ${JSON.stringify(err)}`)
  }
  return res.json() as Promise<CreatePixResult>
}

export async function createDepositPix(opts: {
  tenantId: string
  appointmentId: string
  amount: number
  payerEmail: string
  description: string
  expiresAt: Date
  notificationUrl: string
}): Promise<CreatePixResult> {
  return createPix({ ...opts, kind: "appointment" })
}

export async function createPackagePix(opts: {
  tenantId: string
  packageId: string
  amount: number
  payerEmail: string
  description: string
  expiresAt: Date
  notificationUrl: string
}): Promise<CreatePixResult> {
  return createPix({ ...opts, kind: "package" })
}

export interface PaymentStatusResult {
  status: "PENDING" | "PAID" | "FAILED" | "NOT_FOUND"
  pixCode?: string | null
  pixQrCode?: string | null
  amount?: number | null
  kind?: "appointment" | "package"
}

export async function getPaymentStatus(paymentId: string): Promise<PaymentStatusResult> {
  const res = await fetch(`${PAYMENT_URL}/payments/${paymentId}/status`, {
    headers: internalHeaders,
  })
  if (res.status === 404) return { status: "NOT_FOUND" }
  if (!res.ok) return { status: "PENDING" }
  return res.json() as Promise<PaymentStatusResult>
}

export async function requestRefund(opts: {
  paymentId: string
  appointmentId: string
  scheduledAt: Date
  cancelRefundHours: number
}): Promise<"REFUNDED" | "KEPT" | "NONE"> {
  const res = await fetch(`${PAYMENT_URL}/payments/${opts.paymentId}/refund`, {
    method: "POST",
    headers: internalHeaders,
    body: JSON.stringify({
      appointmentId: opts.appointmentId,
      scheduledAt: opts.scheduledAt.toISOString(),
      cancelRefundHours: opts.cancelRefundHours,
    }),
  })
  if (!res.ok) return "NONE"
  const { result } = (await res.json()) as { result: string }
  return result as "REFUNDED" | "KEPT" | "NONE"
}

// Versão que não requer paymentId — Payment Service busca pelo appointmentId.
export async function refundDepositForCancellation(opts: {
  appointmentId: string
  scheduledAt: Date
  cancelRefundHours: number
}): Promise<"REFUNDED" | "KEPT" | "NONE"> {
  try {
    const res = await fetch(`${PAYMENT_URL}/appointments/${opts.appointmentId}/refund`, {
      method: "POST",
      headers: internalHeaders,
      body: JSON.stringify({
        scheduledAt: opts.scheduledAt.toISOString(),
        cancelRefundHours: opts.cancelRefundHours,
      }),
    })
    if (!res.ok) return "NONE"
    const { result } = (await res.json()) as { result: string }
    return result as "REFUNDED" | "KEPT" | "NONE"
  } catch {
    return "NONE"
  }
}

export async function saveMpConnection(tenantId: string, code: string): Promise<void> {
  const res = await fetch(`${PAYMENT_URL}/tenants/${tenantId}/mp/callback`, {
    method: "POST",
    headers: internalHeaders,
    body: JSON.stringify({ code }),
  })
  if (!res.ok) {
    throw new Error(`Payment Service saveMpConnection HTTP ${res.status}`)
  }
}

export async function getMpConnectionInfo(tenantId: string): Promise<{
  connected: boolean
  nickname?: string | null
  mpUserId?: string
  connectedAt?: string
} | null> {
  const res = await fetch(`${PAYMENT_URL}/tenants/${tenantId}/mp/connection`, {
    headers: internalHeaders,
  })
  if (res.status === 404) return { connected: false }
  if (!res.ok) return null
  return res.json()
}

export async function disconnectMp(tenantId: string): Promise<void> {
  await fetch(`${PAYMENT_URL}/tenants/${tenantId}/mp`, {
    method: "DELETE",
    headers: internalHeaders,
  })
}

// Verifica se um tenant tem MP conectado (sem expor token).
export async function isMpConnected(tenantId: string): Promise<boolean> {
  const info = await getMpConnectionInfo(tenantId)
  return info?.connected === true
}
