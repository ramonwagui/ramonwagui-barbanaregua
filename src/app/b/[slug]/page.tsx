import { prisma } from "@/lib/prisma"
import { getTenantBySlug } from "@/lib/tenant"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Clock, MapPin, Scissors } from "lucide-react"
import BannerAd from "@/components/banner-ad"
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  try {
    const tenant = await getTenantBySlug(slug)
    return {
      title: `${tenant.name} — Agendar`,
      description: `Agende seu horário na ${tenant.name}`,
    }
  } catch {
    return { title: "Barbearia" }
  }
}

function getBannersForSide(
  banners: { id: string; imageUrl: string; clickUrl: string | null; position: string }[],
  side: "LEFT" | "RIGHT"
) {
  return banners.filter((b) => b.position === side || b.position === "BOTH")
}

export default async function BookingHomePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  let tenant
  try {
    tenant = await getTenantBySlug(slug)
  } catch {
    notFound()
  }

  const [services, barbers, activeBanners] = await Promise.all([
    prisma.service.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.barber.findMany({
      where: { tenantId: tenant.id, isActive: true },
      include: { user: { select: { name: true } } },
    }),
    prisma.banner.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
  ])

  const leftBanners = getBannersForSide(activeBanners, "LEFT")
  const rightBanners = getBannersForSide(activeBanners, "RIGHT")
  const accent = tenant.primaryColor ?? "#f59e0b"

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Layout: 3 colunas em desktop, coluna única em mobile */}
      <div className="lg:grid lg:grid-cols-[1fr_672px_1fr] lg:items-start lg:min-h-screen">

        {/* Banners esquerdos — desktop only */}
        <div className="hidden lg:flex lg:flex-col lg:items-end lg:gap-4 lg:pr-6 lg:pt-20 lg:sticky lg:top-20">
          {leftBanners.map((b) => (
            <BannerAd key={b.id} imageUrl={b.imageUrl} clickUrl={b.clickUrl} />
          ))}
        </div>

        {/* Conteúdo principal */}
        <div>
          {/* Hero header */}
          <div className="relative overflow-hidden" style={{ background: "#0a0a0a" }}>
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                background: `radial-gradient(ellipse at top, ${accent} 0%, transparent 65%)`,
              }}
            />
            <div className="relative px-5 pt-14 pb-12 text-center">
              {tenant.logoUrl ? (
                <img
                  src={tenant.logoUrl}
                  alt={tenant.name}
                  className="w-20 h-20 rounded-full mx-auto mb-6 object-cover ring-2 ring-white/10"
                />
              ) : (
                <div
                  className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center ring-2 ring-white/10"
                  style={{ backgroundColor: `${accent}18` }}
                >
                  <Scissors className="w-8 h-8" style={{ color: accent }} />
                </div>
              )}

              <h1
                className="text-white mb-2"
                style={{
                  fontFamily: "var(--font-cormorant)",
                  fontSize: "clamp(2rem, 6vw, 3.2rem)",
                  fontWeight: 700,
                  lineHeight: 1.1,
                }}
              >
                {tenant.name}
              </h1>

              {(tenant.address || tenant.city) && (
                <p className="text-zinc-500 text-sm flex items-center justify-center gap-1.5 mt-2">
                  <MapPin className="w-3.5 h-3.5" />
                  {[tenant.address, tenant.city].filter(Boolean).join(", ")}
                </p>
              )}

              <div className="flex items-center justify-center gap-3 mt-5">
                <span className="text-xs text-zinc-500 bg-zinc-800/60 px-3 py-1 rounded-full">
                  {barbers.length} barbeiro{barbers.length !== 1 ? "s" : ""}
                </span>
                <span className="text-xs text-zinc-500 bg-zinc-800/60 px-3 py-1 rounded-full">
                  {services.length} serviço{services.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>

          <div className="px-5 py-8">
            {/* Services */}
            <div className="mb-8">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-5">
                Serviços
              </p>
              <div className="space-y-2">
                {services.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 hover:border-zinc-700 transition-colors"
                  >
                    <div>
                      <p className="text-white font-medium text-sm">{service.name}</p>
                      {service.description && (
                        <p className="text-zinc-500 text-xs mt-0.5">{service.description}</p>
                      )}
                      <p className="text-zinc-600 text-xs mt-1.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {service.durationMinutes} min
                      </p>
                    </div>
                    <p className="text-white font-bold text-base ml-4 shrink-0">
                      R$ {Number(service.price).toFixed(2).replace(".", ",")}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <Link
              href={`/b/${slug}/agendar`}
              className="flex items-center justify-center w-full h-14 text-black font-bold text-base rounded-xl transition-all duration-200 hover:opacity-90 hover:-translate-y-0.5 hover:shadow-lg"
              style={{ backgroundColor: accent }}
            >
              Agendar agora →
            </Link>

            <p className="text-center text-zinc-700 text-xs mt-5">
              Powered by{" "}
              <span className="font-semibold text-zinc-600" style={{ fontFamily: "var(--font-cormorant)" }}>
                Barbanaregua
              </span>
            </p>
          </div>
        </div>

        {/* Banners direitos — desktop only */}
        <div className="hidden lg:flex lg:flex-col lg:items-start lg:gap-4 lg:pl-6 lg:pt-20 lg:sticky lg:top-20">
          {rightBanners.map((b) => (
            <BannerAd key={b.id} imageUrl={b.imageUrl} clickUrl={b.clickUrl} />
          ))}
        </div>

      </div>
    </div>
  )
}
