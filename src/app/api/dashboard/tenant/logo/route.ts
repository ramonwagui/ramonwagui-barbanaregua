import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { uploadFile, deleteFile, keyFromUrl } from "@/lib/storage"
import { revalidatePath } from "next/cache"

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_SIZE_BYTES = 2 * 1024 * 1024

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

  if (!file) return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Formato inválido. Use JPG, PNG, WEBP ou GIF." }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande. Máximo 2 MB." }, { status: 400 })
  }

  const ext = file.type.split("/")[1].replace("jpeg", "jpg")
  // Key único por upload — evita cache do CDN servindo arquivo antigo
  const key = `logos/logo-${session.user.tenantId}-${Date.now()}.${ext}`

  // Remover logo anterior do R2
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { logoUrl: true },
  })
  if (tenant?.logoUrl) {
    await deleteFile(keyFromUrl(tenant.logoUrl)).catch(() => {})
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const logoUrl = await uploadFile(key, buffer, file.type)

  await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data: { logoUrl },
  })

  revalidatePath("/configuracoes")
  revalidatePath(`/b`)

  return NextResponse.json({ logoUrl })
}

export async function DELETE() {
  const session = await auth()
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { logoUrl: true },
  })

  if (tenant?.logoUrl) {
    await deleteFile(keyFromUrl(tenant.logoUrl)).catch(() => {})
  }

  await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data: { logoUrl: null },
  })

  return NextResponse.json({ success: true })
}
