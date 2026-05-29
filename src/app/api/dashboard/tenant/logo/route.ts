import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { writeFile, mkdir, unlink } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_SIZE_BYTES = 2 * 1024 * 1024 // 2 MB

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  if (session.user.role === "BARBER") {
    return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get("file") as File | null

  if (!file) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Formato inválido. Use JPG, PNG, WEBP ou GIF." }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande. Máximo 2 MB." }, { status: 400 })
  }

  const ext = file.type.split("/")[1].replace("jpeg", "jpg")
  const filename = `logo-${session.user.tenantId}.${ext}`
  const uploadsDir = path.join(process.cwd(), "public", "uploads")

  if (!existsSync(uploadsDir)) {
    await mkdir(uploadsDir, { recursive: true })
  }

  // Remover logo anterior com qualquer extensão
  for (const oldExt of ["jpg", "png", "webp", "gif"]) {
    const oldPath = path.join(uploadsDir, `logo-${session.user.tenantId}.${oldExt}`)
    if (existsSync(oldPath)) {
      await unlink(oldPath).catch(() => {})
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(path.join(uploadsDir, filename), buffer)

  const logoUrl = `/uploads/${filename}`

  await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data: { logoUrl },
  })

  return NextResponse.json({ logoUrl })
}

export async function DELETE(req: Request) {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }
  if (session.user.role === "BARBER") {
    return NextResponse.json({ error: "Permissão insuficiente" }, { status: 403 })
  }

  const uploadsDir = path.join(process.cwd(), "public", "uploads")
  for (const ext of ["jpg", "png", "webp", "gif"]) {
    const filePath = path.join(uploadsDir, `logo-${session.user.tenantId}.${ext}`)
    if (existsSync(filePath)) {
      await unlink(filePath).catch(() => {})
    }
  }

  await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data: { logoUrl: null },
  })

  return NextResponse.json({ success: true })
}
