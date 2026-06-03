import { randomUUID } from "crypto"

/**
 * Integração com o Mercado Pago via REST (sem SDK), seguindo o padrão do
 * projeto (Z-API e Upstash também falam REST puro). Usada para cobrar o
 * "sinal" (depósito) do agendamento via PIX.
 *
 * Degrada graciosamente: se MERCADOPAGO_ACCESS_TOKEN não estiver configurado,
 * as funções lançam MercadoPagoNotConfiguredError para o chamador tratar.
 */

const MP_API = "https://api.mercadopago.com"

export class MercadoPagoNotConfiguredError extends Error {
  constructor() {
    super("MERCADOPAGO_ACCESS_TOKEN não configurado")
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

export function isMercadoPagoConfigured(): boolean {
  return !!process.env.MERCADOPAGO_ACCESS_TOKEN
}

function getToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) throw new MercadoPagoNotConfiguredError()
  return token
}

async function mpFetch(
  path: string,
  init: RequestInit & { idempotencyKey?: string }
): Promise<unknown> {
  const { idempotencyKey, ...rest } = init
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getToken()}`,
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
  input: CreatePixPaymentInput
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

export async function getPayment(id: string): Promise<MpPayment> {
  const data = (await mpFetch(`/v1/payments/${id}`, { method: "GET" })) as {
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

/**
 * Estorna um pagamento. Sem amount → estorno total.
 */
export async function refundPayment(
  id: string,
  amount?: number
): Promise<void> {
  await mpFetch(`/v1/payments/${id}/refunds`, {
    method: "POST",
    body: amount ? JSON.stringify({ amount: Number(amount.toFixed(2)) }) : "{}",
    idempotencyKey: randomUUID(),
  })
}
