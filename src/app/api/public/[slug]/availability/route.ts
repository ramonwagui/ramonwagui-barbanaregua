import { NextResponse } from "next/server"
import { getTenantBySlug, TenantNotFoundError } from "@/lib/tenant"
import { getAvailableSlots } from "@/lib/availability"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { success } = await checkRateLimit("availability", getClientIp(req))
    if (!success) {
      return NextResponse.json(
        { error: "Muitas requisições. Aguarde um momento." },
        { status: 429 }
      )
    }

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
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: "Data inválida" }, { status: 400 })
    }

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
  } catch (error) {
    if (error instanceof TenantNotFoundError) {
      return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 })
    }
    console.error("[AVAILABILITY]", error)
    return NextResponse.json({ error: "Erro ao buscar disponibilidade" }, { status: 500 })
  }
}
