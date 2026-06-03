import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import bcrypt from "bcryptjs"
import { addDays } from "date-fns"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgresql://barbanaregua:barbanaregua123@localhost:5432/barbanaregua",
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

// Em produção exige senhas via env; em dev usa defaults óbvios de teste.
const IS_PROD = process.env.NODE_ENV === "production"

function seedPassword(envVar: string, devDefault: string): string {
  const fromEnv = process.env[envVar]
  if (fromEnv) return fromEnv
  if (IS_PROD) {
    throw new Error(
      `${envVar} é obrigatória para seed em produção (não há senha padrão).`
    )
  }
  return devDefault
}

async function main() {
  console.log("🌱 Seeding banco de dados...")

  const adminPassword = seedPassword("SEED_ADMIN_PASSWORD", "Admin@123")
  const ownerPassword = seedPassword("SEED_OWNER_PASSWORD", "Senha@123")
  const barberPassword = seedPassword("SEED_BARBER_PASSWORD", "Senha@123")

  const passwordHash = await bcrypt.hash(ownerPassword, 12)

  // Criar Super Admin
  await prisma.user.upsert({
    where: { email: "admin@barbanaregua.com" },
    update: {},
    create: {
      name: "Super Admin",
      email: "admin@barbanaregua.com",
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: "SUPER_ADMIN",
      isActive: true,
    },
  })

  // Criar usuário dono
  const owner = await prisma.user.upsert({
    where: { email: "dono@barbearia.com" },
    update: {},
    create: {
      name: "João Silva",
      email: "dono@barbearia.com",
      passwordHash,
      role: "TENANT_OWNER",
    },
  })

  // Criar tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: "barbearia-demo" },
    update: {},
    create: {
      name: "Barbearia Demo",
      slug: "barbearia-demo",
      ownerId: owner.id,
      phone: "11999990000",
      city: "São Paulo",
      state: "SP",
    },
  })

  // Vincular usuário ao tenant
  await prisma.user.update({
    where: { id: owner.id },
    data: { tenantId: tenant.id },
  })

  // Criar subscription (trial)
  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      plan: "PRO",
      status: "TRIALING",
      currentPeriodStart: new Date(),
      currentPeriodEnd: addDays(new Date(), 14),
      trialEndsAt: addDays(new Date(), 14),
    },
  })

  // Horários de funcionamento
  for (const day of [1, 2, 3, 4, 5, 6]) {
    await prisma.businessHour.upsert({
      where: { tenantId_dayOfWeek: { tenantId: tenant.id, dayOfWeek: day } },
      update: {},
      create: {
        tenantId: tenant.id,
        dayOfWeek: day,
        openTime: "09:00",
        closeTime: "19:00",
        isOpen: true,
      },
    })
  }
  await prisma.businessHour.upsert({
    where: { tenantId_dayOfWeek: { tenantId: tenant.id, dayOfWeek: 0 } },
    update: {},
    create: {
      tenantId: tenant.id,
      dayOfWeek: 0,
      openTime: "09:00",
      closeTime: "19:00",
      isOpen: false,
    },
  })

  // Criar barbeiro
  const barberUser = await prisma.user.upsert({
    where: { email: "barbeiro@barbearia.com" },
    update: {},
    create: {
      name: "Carlos Barbeiro",
      email: "barbeiro@barbearia.com",
      passwordHash: await bcrypt.hash(barberPassword, 12),
      role: "BARBER",
      tenantId: tenant.id,
    },
  })

  const barber = await prisma.barber.upsert({
    where: { userId: barberUser.id },
    update: {},
    create: {
      userId: barberUser.id,
      tenantId: tenant.id,
      bio: "Especialista em cortes modernos",
      isActive: true,
    },
  })

  // Horários do barbeiro (Seg-Sáb 09:00-18:00 com pausa 12-13h)
  for (const day of [1, 2, 3, 4, 5, 6]) {
    await prisma.barberSchedule.upsert({
      where: { barberId_dayOfWeek: { barberId: barber.id, dayOfWeek: day } },
      update: {},
      create: {
        barberId: barber.id,
        dayOfWeek: day,
        startTime: "09:00",
        endTime: "18:00",
        breakStart: "12:00",
        breakEnd: "13:00",
        isActive: true,
      },
    })
  }

  // Criar serviços
  const services = [
    { name: "Corte Masculino", durationMinutes: 30, price: 45 },
    { name: "Barba", durationMinutes: 20, price: 35 },
    { name: "Corte + Barba", durationMinutes: 50, price: 70 },
    { name: "Hidratação Capilar", durationMinutes: 40, price: 55 },
  ]

  for (const [i, svc] of services.entries()) {
    const service = await prisma.service.upsert({
      where: { id: `seed-service-${i}` },
      update: {},
      create: {
        id: `seed-service-${i}`,
        tenantId: tenant.id,
        name: svc.name,
        durationMinutes: svc.durationMinutes,
        price: svc.price,
        sortOrder: i,
        isActive: true,
      },
    })

    await prisma.barberService.upsert({
      where: { barberId_serviceId: { barberId: barber.id, serviceId: service.id } },
      update: {},
      create: { barberId: barber.id, serviceId: service.id },
    })
  }

  console.log("✅ Seed concluído!")
  console.log(`\n📋 Dados de acesso:`)
  console.log(`   Super Admin: admin@barbanaregua.com`)
  console.log(`   Dono: dono@barbearia.com`)
  console.log(`   Barbeiro: barbeiro@barbearia.com`)
  if (!IS_PROD) {
    console.log(
      `   (senhas dev: ${adminPassword} / ${ownerPassword} / ${barberPassword} — defina SEED_*_PASSWORD para sobrescrever)`
    )
  }
  console.log(`   Página de agendamento: http://localhost:3000/b/barbearia-demo`)
  console.log(`   Dashboard: http://localhost:3000/dashboard`)
  console.log(`   Admin: http://localhost:3000/admin`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
