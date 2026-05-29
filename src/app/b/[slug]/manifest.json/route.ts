import { prisma } from "@/lib/prisma"
import { getTenantBySlug } from "@/lib/tenant"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  let tenant
  try {
    tenant = await getTenantBySlug(slug)
  } catch {
    return new Response("Not found", { status: 404 })
  }

  const accent = tenant.primaryColor ?? "#f59e0b"
  const shortName = tenant.name.split(" ").slice(0, 2).join(" ")

  const icons = tenant.logoUrl
    ? [
        { src: tenant.logoUrl, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: tenant.logoUrl, sizes: "512x512", type: "image/png", purpose: "any maskable" },
      ]
    : [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
      ]

  const manifest = {
    name: tenant.name,
    short_name: shortName,
    description: `Agende seu horário na ${tenant.name}`,
    start_url: `/b/${slug}`,
    scope: `/b/${slug}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#0a0a0a",
    theme_color: accent,
    lang: "pt-BR",
    icons,
    shortcuts: [
      {
        name: "Agendar agora",
        url: `/b/${slug}/agendar`,
        icons: [{ src: tenant.logoUrl ?? "/icons/icon-96.png", sizes: "96x96" }],
      },
    ],
  }

  return new Response(JSON.stringify(manifest, null, 2), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600",
    },
  })
}
