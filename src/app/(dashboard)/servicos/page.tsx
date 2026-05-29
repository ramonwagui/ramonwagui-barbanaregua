import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import ServicosClient from "./servicos-client"

export default async function ServicosPage() {
  const session = await auth()
  if (!session?.user?.tenantId) redirect("/onboarding")

  const services = await prisma.service.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })

  return (
    <ServicosClient
      services={services.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description ?? "",
        durationMinutes: s.durationMinutes,
        price: Number(s.price),
        isActive: s.isActive,
      }))}
      isOwner={session.user.role !== "BARBER"}
    />
  )
}
