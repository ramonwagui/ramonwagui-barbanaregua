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

    const banners = await prisma.banner.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, imageUrl: true, clickUrl: true, position: true },
    })

    return NextResponse.json({ banners })
  } catch {
    return NextResponse.json({ banners: [] })
  }
}
