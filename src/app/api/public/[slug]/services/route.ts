import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getTenantBySlug } from "@/lib/tenant"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const tenant = await getTenantBySlug(slug)

    const services = await prisma.service.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        durationMinutes: true,
        price: true,
        imageUrl: true,
      },
    })

    return NextResponse.json({
      tenant: {
        name: tenant.name,
        slug: tenant.slug,
        primaryColor: tenant.primaryColor,
        logoUrl: tenant.logoUrl,
        requireDeposit: tenant.requireDeposit,
        depositPercent: tenant.depositPercent,
      },
      services,
    })
  } catch {
    return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 })
  }
}
