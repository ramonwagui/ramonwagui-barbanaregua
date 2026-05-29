import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { uploadFile } from "@/lib/storage"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"]
const MAX_SIZE_BYTES = 2 * 1024 * 1024
const MAX_BANNERS = 6

export async function GET() {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const banners = await prisma.banner.findMany({
    where: { tenantId: session.user.tenantId },
    orderBy: { sortOrder: "asc" },
  })

  return NextResponse.json({ banners })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  if (session.user.role === "BARBER") {
    return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 })
  }

  const tenantId = session.user.tenantId

  const count = await prisma.banner.count({ where: { tenantId } })
  if (count >= MAX_BANNERS) {
    return NextResponse.json({ error: `Limite de ${MAX_BANNERS} banners atingido` }, { status: 422 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const clickUrl = (formData.get("clickUrl") as string | null)?.trim() || null
  const position = (formData.get("position") as string | null) ?? "BOTH"

  if (!file) return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Formato inválido. Use JPG, PNG ou WEBP." }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande. Máximo 2 MB." }, { status: 400 })
  }
  if (!["LEFT", "RIGHT", "BOTH"].includes(position)) {
    return NextResponse.json({ error: "Posição inválida" }, { status: 400 })
  }

  const ext = file.type.split("/")[1].replace("jpeg", "jpg")
  const uid = Date.now().toString(36)
  const key = `banners/banner-${tenantId}-${uid}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const imageUrl = await uploadFile(key, buffer, file.type)

  const banner = await prisma.banner.create({
    data: {
      tenantId,
      imageUrl,
      clickUrl,
      position: position as "LEFT" | "RIGHT" | "BOTH",
      sortOrder: count,
    },
  })

  return NextResponse.json({ banner }, { status: 201 })
}
