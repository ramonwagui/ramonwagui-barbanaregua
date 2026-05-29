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

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
}
