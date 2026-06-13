/**
 * Estende o trial dos salões existentes para não travarem durante a ativação do Stripe.
 *
 * Uso (precisa de DATABASE_URL no ambiente — lido do .env):
 *
 *   # Listar todos os salões e status do trial atual:
 *   npx tsx scripts/extend-trials.ts list
 *
 *   # Estender todos os trials TRIALING para N dias a partir de hoje (padrão: 30):
 *   npx tsx scripts/extend-trials.ts extend [dias]
 *
 *   # Estender o trial de um salão específico (pelo slug):
 *   npx tsx scripts/extend-trials.ts extend-one <slug> [dias]
 */
import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { addDays } from "date-fns"

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error("❌ DATABASE_URL não definida no ambiente (.env).")
  process.exit(1)
}

const pool = new Pool({ connectionString })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function list() {
  const subs = await prisma.subscription.findMany({
    include: { tenant: { select: { name: true, slug: true } } },
    orderBy: { createdAt: "asc" },
  })

  if (subs.length === 0) {
    console.log("ℹ️  Nenhum salão encontrado no banco.")
    return
  }

  const now = new Date()
  console.log(`\n💈 Salões encontrados: ${subs.length}\n`)
  for (const s of subs) {
    const daysLeft = s.trialEndsAt
      ? Math.ceil((s.trialEndsAt.getTime() - now.getTime()) / 86_400_000)
      : null
    const trialInfo =
      s.status === "TRIALING"
        ? s.trialEndsAt
          ? daysLeft! > 0
            ? `⏳ trial expira em ${daysLeft}d (${s.trialEndsAt.toLocaleDateString("pt-BR")})`
            : `🔴 trial expirado há ${Math.abs(daysLeft!)}d`
          : "⚠️  sem trialEndsAt"
        : `✅ status: ${s.status}`
    console.log(`   • [${s.tenant.slug}] ${s.tenant.name}`)
    console.log(`     ${trialInfo}`)
  }
  console.log()
}

async function extendAll(days = 30) {
  const newDate = addDays(new Date(), days)

  const subs = await prisma.subscription.findMany({
    where: { status: "TRIALING" },
    include: { tenant: { select: { name: true, slug: true } } },
  })

  if (subs.length === 0) {
    console.log("ℹ️  Nenhum salão em TRIALING encontrado.")
    return
  }

  console.log(`\n🔧 Estendendo trial de ${subs.length} salão(s) para ${newDate.toLocaleDateString("pt-BR")} (+${days}d)...\n`)

  for (const s of subs) {
    await prisma.subscription.update({
      where: { id: s.id },
      data: { trialEndsAt: newDate },
    })
    console.log(`   ✅ [${s.tenant.slug}] ${s.tenant.name}`)
  }

  console.log(`\n🎉 Concluído. ${subs.length} trial(s) atualizado(s).\n`)
}

async function extendOne(slug: string, days = 30) {
  if (!slug) {
    console.error("❌ Uso: npx tsx scripts/extend-trials.ts extend-one <slug> [dias]")
    process.exit(1)
  }

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    include: { subscription: true },
  })

  if (!tenant) {
    console.error(`❌ Salão com slug "${slug}" não encontrado.`)
    process.exit(1)
  }
  if (!tenant.subscription) {
    console.error(`❌ Salão "${slug}" não possui subscription.`)
    process.exit(1)
  }

  const newDate = addDays(new Date(), days)
  await prisma.subscription.update({
    where: { id: tenant.subscription.id },
    data: { trialEndsAt: newDate },
  })

  console.log(`\n✅ Trial de [${slug}] ${tenant.name} estendido até ${newDate.toLocaleDateString("pt-BR")} (+${days}d).\n`)
}

async function main() {
  const [cmd, ...args] = process.argv.slice(2)

  switch (cmd) {
    case "list":
    case undefined:
      await list()
      break
    case "extend": {
      const days = args[0] ? parseInt(args[0], 10) : 30
      if (isNaN(days) || days <= 0) {
        console.error("❌ Número de dias inválido.")
        process.exit(1)
      }
      await extendAll(days)
      break
    }
    case "extend-one": {
      const days = args[1] ? parseInt(args[1], 10) : 30
      if (isNaN(days) || days <= 0) {
        console.error("❌ Número de dias inválido.")
        process.exit(1)
      }
      await extendOne(args[0], days)
      break
    }
    default:
      console.error(`❌ Comando desconhecido: "${cmd}". Use "list", "extend [dias]" ou "extend-one <slug> [dias]".`)
      process.exit(1)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
