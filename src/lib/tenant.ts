import { prisma } from "@/lib/prisma"
import { Tenant } from "@prisma/client"
import {
  getSubscription,
  canAcceptBookings as subCanAcceptBookings,
  type SubscriptionDTO,
} from "@/lib/billing-client"

export type TenantWithSubscription = Tenant & {
  subscription: SubscriptionDTO | null
}

export class TenantNotFoundError extends Error {
  constructor() {
    super("Tenant not found or inactive")
    this.name = "TenantNotFoundError"
  }
}

export async function getTenantBySlug(slug: string): Promise<TenantWithSubscription> {
  const tenant = await prisma.tenant.findUnique({ where: { slug } })
  if (!tenant || !tenant.isActive) throw new TenantNotFoundError()

  const subscription = await getSubscription(tenant.id)
  return { ...tenant, subscription }
}

export async function getTenantById(id: string): Promise<TenantWithSubscription> {
  const tenant = await prisma.tenant.findUnique({ where: { id } })
  if (!tenant || !tenant.isActive) throw new TenantNotFoundError()

  const subscription = await getSubscription(id)
  return { ...tenant, subscription }
}

export function canAcceptBookings(tenant: TenantWithSubscription): boolean {
  return subCanAcceptBookings(tenant.subscription)
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
