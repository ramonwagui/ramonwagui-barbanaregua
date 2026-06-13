/**
 * Cliente HTTP para o Billing Service.
 *
 * Fornece ao monolito os dados de assinatura sem precisar acessar o banco do
 * Billing Service diretamente. As respostas são cacheadas no Upstash Redis
 * (TTL 60s) para não adicionar latência a cada request de agendamento público.
 *
 * Degradação graceful: se o Billing Service estiver offline, retorna null e
 * a lógica de gating pode usar fallback seguro (bloquear agendamentos).
 */

import { Redis } from "@upstash/redis"

// ─────────────────────────────────────────────
// Tipos (espelham o modelo Subscription do Billing Service)
// ─────────────────────────────────────────────

export interface SubscriptionDTO {
  id: string
  tenantId: string
  plan: "BASIC" | "PRO" | "PREMIUM"
  status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "UNPAID"
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  trialEndsAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PlanLimitsDTO {
  maxBarbers: number | null
  maxAppointmentsPerMonth: number | null
  whatsappNotifications: boolean
  smsNotifications: boolean
  onlinePayments: boolean
  customDomain: boolean
  analyticsHistoryDays: number | null
  loyaltyProgram: boolean
  apiAccess: boolean
}

// ─────────────────────────────────────────────
// Configuração
// ─────────────────────────────────────────────

const BILLING_URL = (process.env.BILLING_SERVICE_URL ?? "http://localhost:3006").replace(/\/$/, "")
const INTERNAL_KEY = process.env.INTERNAL_API_KEY ?? ""
const CACHE_TTL_SECONDS = 60

let redis: Redis | null = null

function getRedis(): Redis | null {
  if (redis) return redis
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  redis = new Redis({ url, token })
  return redis
}

function cacheKey(tenantId: string) {
  return `billing:sub:${tenantId}`
}

// ─────────────────────────────────────────────
// Client
// ─────────────────────────────────────────────

async function billingFetch<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${BILLING_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-internal-key": INTERNAL_KEY,
        ...(init?.headers ?? {}),
      },
    })
    if (!res.ok) {
      if (res.status === 404) return null
      console.error(`[billing-client] ${init?.method ?? "GET"} ${path} → ${res.status}`)
      return null
    }
    return res.json() as Promise<T>
  } catch (err) {
    console.error("[billing-client] offline:", (err as Error).message)
    return null
  }
}

/**
 * Retorna a assinatura do tenant. Usa cache Redis (60s).
 * Retorna null se o Billing Service estiver offline.
 */
export async function getSubscription(tenantId: string): Promise<SubscriptionDTO | null> {
  const r = getRedis()

  // Tentar cache primeiro
  if (r) {
    try {
      const cached = await r.get<SubscriptionDTO>(cacheKey(tenantId))
      if (cached) return cached
    } catch {
      // cache miss, segue em frente
    }
  }

  const sub = await billingFetch<SubscriptionDTO>(`/subscriptions/${tenantId}`)

  // Salvar no cache
  if (sub && r) {
    r.set(cacheKey(tenantId), sub, { ex: CACHE_TTL_SECONDS }).catch(() => {})
  }

  return sub
}

/** Invalida o cache de subscription de um tenant (chamar após mudanças). */
export async function invalidateSubscriptionCache(tenantId: string): Promise<void> {
  const r = getRedis()
  if (!r) return
  try {
    await r.del(cacheKey(tenantId))
  } catch {
    // ignore
  }
}

/** Cria subscription de trial para um novo tenant. */
export async function createTrialSubscription(tenantId: string, email?: string): Promise<SubscriptionDTO | null> {
  const sub = await billingFetch<SubscriptionDTO>("/subscriptions", {
    method: "POST",
    body: JSON.stringify({ tenantId, email }),
  })
  return sub
}

/** Override manual de assinatura (super admin). */
export async function overrideSubscription(
  tenantId: string,
  data: {
    plan: "BASIC" | "PRO" | "PREMIUM"
    status: "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED"
    currentPeriodEnd: string
    trialEndsAt?: string | null
  }
): Promise<SubscriptionDTO | null> {
  const sub = await billingFetch<SubscriptionDTO>(`/subscriptions/${tenantId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
  if (sub) await invalidateSubscriptionCache(tenantId)
  return sub
}

/** Cria sessão de Stripe Checkout. */
export async function createCheckoutSession(opts: {
  tenantId: string
  plan: string
  email: string
  priceIdOverride?: string | null
}): Promise<{ url: string } | null> {
  return billingFetch<{ url: string }>("/checkout", {
    method: "POST",
    headers: { "x-tenant-id": opts.tenantId },
    body: JSON.stringify({ plan: opts.plan, email: opts.email, priceIdOverride: opts.priceIdOverride }),
  })
}

/** Cria sessão do Stripe Customer Portal. */
export async function createPortalSession(tenantId: string): Promise<{ url: string } | null> {
  return billingFetch<{ url: string }>("/portal", {
    method: "POST",
    headers: { "x-tenant-id": tenantId },
    body: JSON.stringify({}),
  })
}

// ─────────────────────────────────────────────
// Helpers de lógica (antes em billing.ts / plans.ts)
// ─────────────────────────────────────────────

export function hasActiveSubscription(sub: SubscriptionDTO | null | undefined): boolean {
  if (!sub) return false
  if (sub.status === "ACTIVE") return true
  if (sub.status === "TRIALING") {
    return !sub.trialEndsAt || new Date(sub.trialEndsAt).getTime() > Date.now()
  }
  return false
}

export function canAcceptBookings(sub: SubscriptionDTO | null | undefined): boolean {
  if (!sub) return false
  if (sub.status === "CANCELLED" || sub.status === "UNPAID") return false
  if (sub.status === "TRIALING" && sub.trialEndsAt) {
    if (new Date(sub.trialEndsAt).getTime() < Date.now()) return false
  }
  return true
}
