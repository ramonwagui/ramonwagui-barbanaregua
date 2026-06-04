export const dynamic = "force-dynamic"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import PacotesClient from "./pacotes-client"

export default async function PacotesPage() {
  const session = await auth()
  if (!session?.user?.tenantId) redirect("/onboarding")
  if (session.user.role === "BARBER") redirect("/dashboard")

  const [packages, services] = await Promise.all([
    prisma.servicePackage.findMany({
      where: { tenantId: session.user.tenantId },
      orderBy: { createdAt: "desc" },
      include: { service: { select: { name: true } } },
    }),
    prisma.service.findMany({
      where: { tenantId: session.user.tenantId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ])

  return (
    <PacotesClient
      packages={packages.map((p) => ({
        id: p.id,
        name: p.name,
        serviceId: p.serviceId,
        serviceName: p.service.name,
        credits: p.credits,
        price: Number(p.price),
        validityDays: p.validityDays,
        isActive: p.isActive,
      }))}
      services={services}
    />
  )
}
