import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { LayoutDashboard, DollarSign, Settings, LogOut, ShieldCheck } from "lucide-react"

const NAV = [
  { href: "/admin", label: "Visão Geral", icon: LayoutDashboard },
  { href: "/admin/financeiro", label: "Financeiro", icon: DollarSign },
  { href: "/admin/configuracoes", label: "Configurações", icon: Settings },
]

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()

  if (!session?.user) redirect("/login")
  if (session.user.role !== "SUPER_ADMIN") redirect("/dashboard")

  const config = await prisma.globalConfig.findUnique({ where: { id: "singleton" } })

  const initials = (session.user.name ?? session.user.email ?? "A")
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0])
    .join("")
    .toUpperCase()

  return (
    <div className="flex min-h-screen bg-[#0d0d0d]">
      {/* Sidebar */}
      <aside
        className="w-60 flex flex-col fixed inset-y-0 z-20 border-r border-zinc-800/60"
        style={{ backgroundColor: "#0a0a0a" }}
      >
        {/* Logo + badge */}
        <div className="px-4 py-3 border-b border-zinc-800/60">
          {config?.platformLogoUrl ? (
            <Link href="/admin" className="block w-full">
              <div className="relative w-full" style={{ paddingBottom: "100%" }}>
                <img
                  src={config.platformLogoUrl}
                  alt="Logo"
                  className="absolute inset-0 w-full h-full object-contain"
                />
              </div>
            </Link>
          ) : (
            <Logo href="/admin" size="fill" />
          )}
          <div className="flex items-center gap-1.5 mt-2 px-1">
            <ShieldCheck className="w-3 h-3 text-amber-400" />
            <span className="text-amber-400 text-xs font-semibold tracking-widest uppercase">
              Super Admin
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800/60 transition-all text-sm font-medium"
            >
              <item.icon className="w-4 h-4 shrink-0 group-hover:text-amber-400 transition-colors" />
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-zinc-800/60">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1">
            <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
              <span className="text-amber-400 text-xs font-bold">{initials}</span>
            </div>
            <p className="text-xs text-zinc-500 font-medium truncate flex-1">
              {session.user.email}
            </p>
          </div>
          <Link
            href="/api/auth/signout"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-600 hover:text-white hover:bg-zinc-800/60 transition-all text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            Sair
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-60 flex-1 min-h-screen">
        <div className="px-8 py-8">{children}</div>
      </main>
    </div>
  )
}
