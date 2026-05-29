import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getTenantBySlug } from "@/lib/tenant"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params

    const tenant = await getTenantBySlug(slug)

    const barbers = await prisma.barber.findMany({
      where: { tenantId: tenant.id, isActive: true },
      select: {
        id: true,
        bio: true,
        avatarUrl: true,
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({ barbers })
  } catch {
    return NextResponse.json({ error: "Barbearia não encontrada" }, { status: 404 })
  }
}
