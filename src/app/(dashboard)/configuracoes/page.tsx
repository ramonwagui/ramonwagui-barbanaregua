export const dynamic = 'force-dynamic'

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import ConfiguracoesClient from "./configuracoes-client"
import DepositoClient from "./deposito-client"
import MercadoPagoClient from "./mercadopago-client"
import CancelamentoClient from "./cancelamento-client"
import UpsellClient from "./upsell-client"
import FidelidadeClient from "./fidelidade-client"
import BookingLinkCard from "@/components/booking-link-card"
import AnunciosClient from "./anuncios-client"
import { getTenantConnectionInfo } from "@/lib/mp-account"

export default async function ConfiguracoesPage() {
  const session = await auth()
  if (!session?.user?.tenantId) redirect("/onboarding")

  const isOwner = session.user.role !== "BARBER"

  const [tenant, banners, mpInfo, activeServices] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      include: { businessHours: { orderBy: { dayOfWeek: "asc" } } },
    }),
    isOwner
      ? prisma.banner.findMany({
          where: { tenantId: session.user.tenantId },
          orderBy: { sortOrder: "asc" },
        })
      : Promise.resolve([]),
    isOwner
      ? getTenantConnectionInfo(session.user.tenantId)
      : Promise.resolve(null),
    isOwner
      ? prisma.service.findMany({
          where: { tenantId: session.user.tenantId, isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ])

  if (!tenant) redirect("/onboarding")

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-white font-bold"
          style={{ fontFamily: "var(--font-cormorant)", fontSize: "2rem" }}
        >
          Configurações
        </h1>
        <p className="text-zinc-500 text-sm mt-0.5">Gerencie os dados da sua barbearia</p>
      </div>

      {/* Shop settings form */}
      <ConfiguracoesClient
        tenant={{
          name: tenant.name,
          phone: tenant.phone ?? "",
          address: tenant.address ?? "",
          city: tenant.city ?? "",
          state: tenant.state ?? "",
          primaryColor: tenant.primaryColor,
          slug: tenant.slug,
          logoUrl: tenant.logoUrl ?? null,
        }}
        isOwner={isOwner}
      />

      {/* Recebimento Mercado Pago + Sinal / Depósito (apenas owner) */}
      {isOwner && (
        <>
          <MercadoPagoClient
            info={{
              connected: mpInfo?.connected ?? false,
              nickname: mpInfo?.nickname ?? null,
              connectedAt: mpInfo?.connectedAt
                ? mpInfo.connectedAt.toISOString()
                : null,
            }}
          />
          <DepositoClient
            initial={{
              requireDeposit: tenant.requireDeposit,
              depositPercent: tenant.depositPercent,
              depositExpiryMinutes: tenant.depositExpiryMinutes,
              cancelRefundHours: tenant.cancelRefundHours,
            }}
            connected={mpInfo?.connected ?? false}
          />
          <CancelamentoClient
            initial={tenant.allowClientCancellation}
            cancelRefundHours={tenant.cancelRefundHours}
          />
          <UpsellClient initial={tenant.upsellEnabled} />
          <FidelidadeClient
            initial={{
              enabled: tenant.loyaltyEnabled,
              threshold: tenant.loyaltyThreshold,
              rewardServiceId: tenant.loyaltyRewardServiceId,
            }}
            services={activeServices}
          />
        </>
      )}

      {/* Banners de anúncio (apenas owner) */}
      {isOwner && <AnunciosClient initialBanners={banners.map((b) => ({ ...b, clickUrl: b.clickUrl ?? null }))} />}

      {/* Business Hours (read-only for now) */}
      <div
        className="rounded-2xl border border-zinc-800/60 overflow-hidden"
        style={{ backgroundColor: "#111111" }}
      >
        <div className="px-5 py-4 border-b border-zinc-800/60">
          <h2
            className="text-white font-semibold"
            style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.1rem" }}
          >
            Horários de Funcionamento
          </h2>
        </div>
        <div className="divide-y divide-zinc-800/40">
          {(["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]).map((day, i) => {
            const bh = tenant.businessHours.find((h) => h.dayOfWeek === i)
            return (
              <div key={day} className="px-5 py-3 flex items-center justify-between">
                <p className="text-zinc-400 text-sm w-10">{day}</p>
                {bh?.isOpen ? (
                  <p className="text-white text-sm">{bh.openTime} – {bh.closeTime}</p>
                ) : (
                  <p className="text-zinc-600 text-sm">Fechado</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Public booking link + QR */}
      <BookingLinkCard slug={tenant.slug} />
    </div>
  )
}

