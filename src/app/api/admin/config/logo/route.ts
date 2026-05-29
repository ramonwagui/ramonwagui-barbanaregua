import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { uploadFile, deleteFile, keyFromUrl } from "@/lib/storage"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_SIZE_BYTES = 2 * 1024 * 1024

export async function POST(req: Request) {
  const session = await auth()
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null

  if (!file) return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Formato inválido. Use JPG, PNG ou WEBP." }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande. Máximo 2 MB." }, { status: 400 })
  }

  // Remover logo anterior
  const config = await prisma.globalConfig.findUnique({ where: { id: "singleton" } })
  if (config?.platformLogoUrl) {
    await deleteFile(keyFromUrl(config.platformLogoUrl)).catch(() => {})
  }

  const ext = file.type.split("/")[1].replace("jpeg", "jpg")
  const key = `platform/logo.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())
  const platformLogoUrl = await uploadFile(key, buffer, file.type)

  await prisma.globalConfig.upsert({
    where: { id: "singleton" },
    update: { platformLogoUrl },
    create: { id: "singleton", platformLogoUrl },
  })

  return NextResponse.json({ platformLogoUrl })
}

export async function DELETE() {
  const session = await auth()
  if (session?.user?.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  }

  const config = await prisma.globalConfig.findUnique({ where: { id: "singleton" } })
  if (config?.platformLogoUrl) {
    await deleteFile(keyFromUrl(config.platformLogoUrl)).catch(() => {})
  }

  await prisma.globalConfig.upsert({
    where: { id: "singleton" },
    update: { platformLogoUrl: null },
    create: { id: "singleton" },
  })

  return NextResponse.json({ success: true })
}
