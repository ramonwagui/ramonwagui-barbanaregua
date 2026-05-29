import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { deleteFile, keyFromUrl } from "@/lib/storage"

async function getBannerOrFail(bannerId: string, tenantId: string) {
  const banner = await prisma.banner.findUnique({ where: { id: bannerId } })
  if (!banner || banner.tenantId !== tenantId) return null
  return banner
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ bannerId: string }> }
) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { bannerId } = await params
  const banner = await getBannerOrFail(bannerId, session.user.tenantId)
  if (!banner) return NextResponse.json({ error: "Banner não encontrado" }, { status: 404 })

  const body = await req.json()
  const { isActive, clickUrl, position } = body

  const updated = await prisma.banner.update({
    where: { id: bannerId },
    data: {
      ...(isActive !== undefined ? { isActive } : {}),
      ...(clickUrl !== undefined ? { clickUrl: clickUrl || null } : {}),
      ...(position !== undefined ? { position } : {}),
    },
  })

  return NextResponse.json({ banner: updated })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ bannerId: string }> }
) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const { bannerId } = await params
  const banner = await getBannerOrFail(bannerId, session.user.tenantId)
  if (!banner) return NextResponse.json({ error: "Banner não encontrado" }, { status: 404 })

  await deleteFile(keyFromUrl(banner.imageUrl)).catch(() => {})
  await prisma.banner.delete({ where: { id: bannerId } })

  return NextResponse.json({ success: true })
}
