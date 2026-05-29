import { getTenantBySlug } from "@/lib/tenant"
import { notFound } from "next/navigation"
import type { Metadata, Viewport } from "next"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  try {
    const tenant = await getTenantBySlug(slug)
    return {
      title: `${tenant.name} — Agendar`,
      description: `Agende seu horário na ${tenant.name}`,
      manifest: `/b/${slug}/manifest.json`,
      appleWebApp: {
        capable: true,
        statusBarStyle: "black-translucent",
        title: tenant.name,
      },
      icons: {
        apple: tenant.logoUrl ?? "/icons/icon-192.png",
      },
    }
  } catch {
    return { title: "Agendar" }
  }
}

export async function generateViewport({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Viewport> {
  const { slug } = await params
  try {
    const tenant = await getTenantBySlug(slug)
    return {
      themeColor: tenant.primaryColor ?? "#f59e0b",
      width: "device-width",
      initialScale: 1,
      maximumScale: 1,
      userScalable: false,
    }
  } catch {
    return { themeColor: "#f59e0b" }
  }
}

export default async function BookingLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  let tenant
  try {
    tenant = await getTenantBySlug(slug)
  } catch {
    notFound()
  }

  const accent = tenant.primaryColor ?? "#f59e0b"

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Meta tags para PWA por barbearia */}
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content={tenant.name} />
      <meta name="theme-color" content={accent} />
      {tenant.logoUrl && (
        <link rel="apple-touch-icon" href={tenant.logoUrl} />
      )}
      {children}
    </div>
  )
}
