/**
 * Gerenciamento seguro do super admin.
 *
 * Uso (precisa de DATABASE_URL no ambiente — lido do .env):
 *
 *   # Listar super admins existentes (email, status):
 *   npx tsx scripts/admin-password.ts list
 *
 *   # Redefinir a senha de um super admin:
 *   npx tsx scripts/admin-password.ts reset <email> <novaSenha>
 *
 * A senha nova é gravada apenas como hash bcrypt. Nunca é exibida.
 */
import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import bcrypt from "bcryptjs"
import { randomBytes } from "node:crypto"

/** Gera uma senha aleatória forte (URL-safe, sem caracteres ambíguos). */
function generatePassword(length = 20): string {
  const alphabet =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%*-_"
  const bytes = randomBytes(length)
  let out = ""
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length]
  return out
}

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error("❌ DATABASE_URL não definida no ambiente (.env).")
  process.exit(1)
}

const pool = new Pool({ connectionString })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function list() {
  const admins = await prisma.user.findMany({
    where: { role: "SUPER_ADMIN" },
    select: { id: true, name: true, email: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  if (admins.length === 0) {
    console.log("ℹ️  Nenhum super admin encontrado no banco.")
    return
  }

  console.log(`\n🔑 Super admin(s) encontrado(s): ${admins.length}\n`)
  for (const a of admins) {
    console.log(`   • ${a.email}`)
    console.log(`     nome: ${a.name ?? "—"} | ativo: ${a.isActive} | criado: ${a.createdAt.toISOString()}`)
  }
  console.log()
}

async function reset(email: string, providedPassword?: string) {
  if (!email) {
    console.error("❌ Uso: npx tsx scripts/admin-password.ts reset <email> [novaSenha]")
    console.error("   (sem a senha, uma aleatória forte é gerada e exibida uma vez)")
    process.exit(1)
  }

  // Sem senha informada (ou "--random") → gera uma aleatória forte.
  const generated = !providedPassword || providedPassword === "--random"
  const newPassword = generated ? generatePassword() : providedPassword!

  if (!generated && newPassword.length < 8) {
    console.error("❌ A nova senha deve ter pelo menos 8 caracteres.")
    process.exit(1)
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (!user || user.role !== "SUPER_ADMIN") {
    console.error(`❌ Nenhum super admin com o email "${email}".`)
    process.exit(1)
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  })

  console.log(`✅ Senha do super admin "${user.email}" redefinida com sucesso.`)
  if (generated) {
    console.log(`\n🔐 Senha gerada (anote agora, não será exibida de novo):\n`)
    console.log(`   ${newPassword}\n`)
  }
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2)

  switch (cmd) {
    case "list":
    case undefined:
      await list()
      break
    case "reset":
      await reset(args[0], args[1])
      break
    default:
      console.error(`❌ Comando desconhecido: "${cmd}". Use "list" ou "reset".`)
      process.exit(1)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
