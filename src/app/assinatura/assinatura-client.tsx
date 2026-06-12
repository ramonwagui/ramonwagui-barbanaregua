"use client"

import { useState } from "react"
import { Check, Loader2 } from "lucide-react"

type PlanView = {
  tier: "BASIC" | "PRO" | "PREMIUM"
  label: string
  price: number
  features: string[]
}

export default function AssinaturaClient({
  plans,
  isOwner,
  currentPlan,
  isActive,
  hasCustomer,
}: {
  plans: PlanView[]
  isOwner: boolean
  currentPlan: string | null
  isActive: boolean
  hasCustomer: boolean
}) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function subscribe(plan: string) {
    setLoading(plan)
    setError(null)
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      if (res.ok && data.url) window.location.assign(data.url)
      else setError(data.error ?? "Não foi possível iniciar o pagamento.")
    } catch {
      setError("Falha de conexão.")
    } finally {
      setLoading(null)
    }
  }

  async function openPortal() {
    setLoading("portal")
    setError(null)
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" })
      const data = await res.json()
      if (res.ok && data.url) window.location.assign(data.url)
      else setError(data.error ?? "Não foi possível abrir o portal.")
    } catch {
      setError("Falha de conexão.")
    } finally {
      setLoading(null)
    }
  }

  if (!isOwner) {
    return (
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4">
        <p className="text-amber-300 text-sm">
          A assinatura está inativa. Peça ao dono da barbearia para regularizar o plano.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {error && (
        <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/50 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <div className="grid md:grid-cols-3 gap-4">
        {plans.map((p) => {
          const current = currentPlan === p.tier && isActive
          return (
            <div
              key={p.tier}
              className="rounded-2xl border p-5 flex flex-col"
              style={{
                backgroundColor: "#111111",
                borderColor: current ? "#f59e0b" : "#27272a",
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-white font-bold text-lg" style={{ fontFamily: "var(--font-cormorant)" }}>
                  {p.label}
                </h3>
                {current && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: "#14532d30", color: "#4ade80" }}>
                    atual
                  </span>
                )}
              </div>
              <p className="mb-4">
                <span className="text-white font-bold" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.9rem" }}>
                  R$ {p.price.toFixed(0)}
                </span>
                <span className="text-zinc-500 text-sm">/mês</span>
              </p>
              <ul className="space-y-2 mb-5 flex-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-zinc-300 text-sm">
                    <Check className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => subscribe(p.tier)}
                disabled={loading !== null || current}
                className="w-full py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: current ? "#27272a" : "#f59e0b", color: current ? "#a1a1aa" : "#000" }}
              >
                {loading === p.tier ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Redirecionando…</>
                ) : current ? (
                  "Plano atual"
                ) : (
                  "Assinar"
                )}
              </button>
            </div>
          )
        })}
      </div>

      {hasCustomer && (
        <button
          onClick={openPortal}
          disabled={loading !== null}
          className="text-sm text-zinc-400 hover:text-white underline underline-offset-4 transition-colors"
        >
          {loading === "portal" ? "Abrindo…" : "Gerenciar assinatura (alterar plano, cartão ou cancelar)"}
        </button>
      )}
    </div>
  )
}
