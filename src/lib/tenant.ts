import { prisma } from "@/lib/prisma"
import { Tenant, Subscription } from "@prisma/client"

export type TenantWithSubscription = Tenant & {
  subscription: Subscription | null
}

export class TenantNotFoundError extends Error {
  constructor() {
    super("Tenant not found or inactive")
    this.name = "TenantNotFoundError"
  }
}

export async function getTenantBySlug(
  slug: string
): Promise<TenantWithSubscription> {
  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    include: { subscription: true },
  })

  if (!tenant || !tenant.isActive) throw new TenantNotFoundError()
  return tenant
}

export async function getTenantById(
  id: string
): Promise<TenantWithSubscription> {
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: { subscription: true },
  })

  if (!tenant || !tenant.isActive) throw new TenantNotFoundError()
  return tenant
}

/**
 * Regra de negócio: a barbearia só aceita agendamentos públicos se a
 * assinatura estiver vigente. Bloqueia assinaturas canceladas/não pagas e
 * trials já expirados (independente de webhook ter atualizado o status).
 * PAST_DUE é tolerado como período de carência.
 */
export function canAcceptBookings(tenant: TenantWithSubscription): boolean {
  const sub = tenant.subscription
  if (!sub) return false
  if (sub.status === "CANCELLED" || sub.status === "UNPAID") return false
  if (
    sub.status === "TRIALING" &&
    sub.trialEndsAt &&
    sub.trialEndsAt.getTime() < Date.now()
  ) {
    return false
  }
  return true
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
}
