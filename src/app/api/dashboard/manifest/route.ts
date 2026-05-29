import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()

  if (!session?.user?.tenantId) {
    return new Response("Unauthorized", { status: 401 })
  }

  const isBarber = session.user.role === "BARBER"

  const [tenant, barber] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: session.user.tenantId },
      select: { name: true, logoUrl: true, primaryColor: true, slug: true },
    }),
    isBarber
      ? prisma.barber.findUnique({
          where: { userId: session.user.id },
          select: { user: { select: { name: true } } },
        })
      : Promise.resolve(null),
  ])

  if (!tenant) return new Response("Not found", { status: 404 })

  const accent = tenant.primaryColor ?? "#f59e0b"

  const icons = tenant.logoUrl
    ? [
        { src: tenant.logoUrl, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: tenant.logoUrl, sizes: "512x512", type: "image/png", purpose: "any maskable" },
      ]
    : [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
      ]

  const barberName = (barber as { user: { name: string | null } } | null)?.user?.name

  const appName = isBarber
    ? `${barberName ?? "Barbeiro"} — ${tenant.name}`
    : tenant.name

  const shortName = isBarber
    ? (barberName?.split(" ")[0] ?? "Barbeiro")
    : tenant.name.split(" ").slice(0, 2).join(" ")

  const shortcuts = isBarber
    ? [
        { name: "Minha Agenda", url: "/agenda", icons: [{ src: tenant.logoUrl ?? "/icons/icon-96.png", sizes: "96x96" }] },
      ]
    : [
        { name: "Dashboard", url: "/dashboard", icons: [{ src: tenant.logoUrl ?? "/icons/icon-96.png", sizes: "96x96" }] },
        { name: "Agenda", url: "/agenda", icons: [{ src: tenant.logoUrl ?? "/icons/icon-96.png", sizes: "96x96" }] },
        { name: "Link do Salão", url: `/b/${tenant.slug}`, icons: [{ src: tenant.logoUrl ?? "/icons/icon-96.png", sizes: "96x96" }] },
      ]

  const manifest = {
    name: appName,
    short_name: shortName,
    description: isBarber
      ? `Gerencie sua agenda na ${tenant.name}`
      : `Gerencie sua barbearia — ${tenant.name}`,
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: accent,
    lang: "pt-BR",
    icons,
    shortcuts,
  }

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "private, max-age=3600",
    },
  })
}
