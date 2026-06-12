"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, CalendarDays, Users, Scissors,
  UserCog, DollarSign, Settings, LogOut, Menu, X, Package, BarChart3,
} from "lucide-react"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Visão Geral", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/servicos", label: "Serviços", icon: Scissors },
  { href: "/pacotes", label: "Pacotes", icon: Package, ownerOnly: true },
  { href: "/barbeiros", label: "Barbeiros", icon: UserCog },
  { href: "/financeiro", label: "Financeiro", icon: DollarSign, ownerOnly: true },
  { href: "/relatorios", label: "Relatórios", icon: BarChart3, ownerOnly: true },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
]

type Props = {
  isBarber: boolean
  userInitials: string
  userEmail: string
  logoUrl: string | null
  tenantName: string
  accent: string
}

export default function DashboardNav({
  isBarber,
  userInitials,
  userEmail,
  logoUrl,
  tenantName,
  accent,
}: Props) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  const navItems = NAV_ITEMS.filter((item) => !(item.ownerOnly && isBarber))

  function isActive(href: string) {
    return pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
  }

  return (
    <>
      {/* ── MOBILE HEADER (hidden on lg+) ─────────────────────────── */}
      <header
        className="lg:hidden fixed top-0 inset-x-0 z-30 flex items-center gap-3 px-4 border-b border-zinc-800/60"
        style={{ backgroundColor: "#0a0a0a", height: 60 }}
      >
        {/* Logo */}
        <Link href="/dashboard" className="shrink-0" onClick={() => setOpen(false)}>
          {logoUrl ? (
            <img src={logoUrl} alt={tenantName} className="w-10 h-10 rounded-lg object-contain" style={{ backgroundColor: "#18181b" }} />
          ) : (
            <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold" style={{ backgroundColor: `${accent}20`, color: accent }}>
              {tenantName[0]?.toUpperCase()}
            </div>
          )}
        </Link>

        {/* Tenant name */}
        <p className="flex-1 text-white text-sm font-semibold truncate" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1rem" }}>
          {tenantName}
        </p>

        {/* Avatar */}
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}25` }}>
          <span className="text-xs font-bold" style={{ color: accent }}>{userInitials}</span>
        </div>

        {/* Hamburger */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-9 h-9 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all shrink-0"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* ── MOBILE DRAWER ────────────────────────────────────────────── */}
      {open && (
        <div
          className="lg:hidden fixed inset-0 z-20 flex flex-col"
          style={{ backgroundColor: "#0a0a0a", paddingTop: 60 }}
        >
          {/* Nav items */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-medium transition-all"
                  style={{
                    backgroundColor: active ? `${accent}15` : "transparent",
                    color: active ? accent : "#71717a",
                    border: active ? `1px solid ${accent}30` : "1px solid transparent",
                  }}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          {/* User + Logout */}
          <div className="px-4 py-5 border-t border-zinc-800/60 space-y-2">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-900/60">
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}25` }}>
                <span className="text-sm font-bold" style={{ color: accent }}>{userInitials}</span>
              </div>
              <p className="text-xs text-zinc-400 truncate flex-1">{userEmail}</p>
            </div>
            <Link
              href="/api/auth/signout"
              className="flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-medium text-zinc-500 hover:text-red-400 hover:bg-red-950/30 transition-all"
            >
              <LogOut className="w-5 h-5 shrink-0" />
              Sair
            </Link>
          </div>
        </div>
      )}

      {/* ── DESKTOP SIDEBAR (hidden on mobile) ───────────────────────── */}
      <aside
        className="hidden lg:flex w-60 flex-col fixed inset-y-0 z-20 border-r border-zinc-800/60"
        style={{ backgroundColor: "#0a0a0a" }}
      >
        {/* Logo */}
        <div className="px-4 py-3 border-b border-zinc-800/60">
          {logoUrl ? (
            <Link href="/dashboard" className="block w-full">
              <div className="relative w-full" style={{ paddingBottom: "100%" }}>
                <img src={logoUrl} alt={tenantName} className="absolute inset-0 w-full h-full object-contain" />
              </div>
            </Link>
          ) : (
            <Link href="/dashboard" className="block w-full">
              <div className="relative w-full" style={{ paddingBottom: "100%" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Barba na Régua" className="absolute inset-0 w-full h-full object-contain" />
              </div>
            </Link>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  color: active ? "#fff" : "#71717a",
                  backgroundColor: active ? "#27272a" : "transparent",
                }}
              >
                <item.icon
                  className="w-4 h-4 shrink-0 transition-colors"
                  style={{ color: active ? accent : undefined }}
                />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-zinc-800/60">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1">
            <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${accent}25` }}>
              <span className="text-xs font-bold" style={{ color: accent }}>{userInitials}</span>
            </div>
            <p className="text-xs text-zinc-500 font-medium truncate flex-1">{userEmail}</p>
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
    </>
  )
}
