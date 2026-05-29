import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

// Endpoint de setup único — cria o super admin se não existir
// Protegido por SETUP_SECRET. Desabilite após o primeiro uso removendo a env var.
export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get("secret")
  const setupSecret = process.env.SETUP_SECRET

  if (!setupSecret) {
    return NextResponse.json({ error: "SETUP_SECRET não configurado" }, { status: 403 })
  }
  if (secret !== setupSecret) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 })
  }

  // Checar se já existe um super admin
  const existing = await prisma.user.findFirst({ where: { role: "SUPER_ADMIN" } })
  if (existing) {
    return NextResponse.json({
      message: "Super admin já existe",
      email: existing.email,
    })
  }

  const passwordHash = await bcrypt.hash("Admin@123", 12)

  const admin = await prisma.user.create({
    data: {
      name: "Super Admin",
      email: "admin@barbanaregua.com",
      passwordHash,
      role: "SUPER_ADMIN",
      isActive: true,
    },
  })

  return NextResponse.json({
    success: true,
    message: "Super admin criado com sucesso!",
    email: admin.email,
    senha: "Admin@123",
    aviso: "Troque a senha após o primeiro login e remova SETUP_SECRET das variáveis.",
  })
}
