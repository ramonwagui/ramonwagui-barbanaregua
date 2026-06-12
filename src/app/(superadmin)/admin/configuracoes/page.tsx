export const dynamic = 'force-dynamic'

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import AdminConfigClient from "./configuracoes-client"

export default async function AdminConfigPage() {
  const session = await auth()
  if (session?.user?.role !== "SUPER_ADMIN") redirect("/login")

  const [config, admin] = await Promise.all([
    prisma.globalConfig.findUnique({ where: { id: "singleton" } }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    }),
  ])

  const planPrices = {
    basic:   config?.planPriceBasic   ?? 9900,
    pro:     config?.planPricePro     ?? 19900,
    premium: config?.planPricePremium ?? 39900,
  }
  const stripePriceIds = {
    basic:   config?.stripePriceBasic   ?? "",
    pro:     config?.stripePricePro     ?? "",
    premium: config?.stripePricePremium ?? "",
  }

  return (
    <div className="space-y-8">
      <div>
        <h1
          className="text-white leading-tight"
          style={{ fontFamily: "var(--font-cormorant)", fontSize: "2rem", fontWeight: 700 }}
        >
          Configurações da Plataforma
        </h1>
        <p className="text-zinc-600 text-sm mt-1">Gerencie a identidade e o acesso do super admin</p>
      </div>

      <AdminConfigClient
        platformLogoUrl={config?.platformLogoUrl ?? null}
        adminName={admin?.name ?? ""}
        adminEmail={admin?.email ?? ""}
        adminId={session.user.id}
        planPrices={planPrices}
        stripePriceIds={stripePriceIds}
      />
    </div>
  )
}
