import { NextResponse } from "next/server"
import { getTenantBySlug } from "@/lib/tenant"
import { getAvailableSlots } from "@/lib/availability"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const { searchParams } = new URL(req.url)
    const barberId = searchParams.get("barberId")
    const date = searchParams.get("date")
    const serviceIds = searchParams.getAll("serviceId")

    if (!barberId || !date || serviceIds.length === 0) {
      return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 })
    }

    const tenant = await getTenantBySlug(slug)

    // Calcular duração total dos serviços selecionados
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, tenantId: tenant.id, isActive: true },
      select: { durationMinutes: true },
    })

    if (services.length === 0) {
      return NextResponse.json({ error: "Serviços não encontrados" }, { status: 404 })
    }

    const totalDuration = services.reduce((sum: number, s: { durationMinutes: number }) => sum + s.durationMinutes, 0)
    const parsedDate = new Date(date)

    const slots = await getAvailableSlots({
      tenantId: tenant.id,
      barberId,
      date: parsedDate,
      serviceDurationMinutes: totalDuration,
    })

    return NextResponse.json({
      slots: slots.map((s) => ({
        startAt: s.startAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
      })),
    })
  } catch {
    return NextResponse.json({ error: "Erro ao buscar disponibilidade" }, { status: 500 })
  }
}
