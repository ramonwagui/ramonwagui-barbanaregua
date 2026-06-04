"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Loader2, Package, Check } from "lucide-react"

type Pkg = {
  id: string
  name: string
  credits: number
  price: number
  validityDays: number
  serviceName: string
}

export default function PacotesPublicPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()

  const [packages, setPackages] = useState<Pkg[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Pkg | null>(null)
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/public/${slug}/packages`)
      .then((r) => r.json())
      .then((d) => setPackages(d.packages ?? []))
      .finally(() => setLoading(false))
  }, [slug])

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const canBuy = !!selected && name.trim().length > 0 && phone.replace(/\D/g, "").length >= 10 && emailValid

  async function handleBuy() {
    if (!selected) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/public/${slug}/packages/${selected.id}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guestName: name,
          guestPhone: phone.replace(/\D/g, ""),
          guestEmail: email.trim(),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/b/${slug}/pacote-pagamento?paymentId=${data.paymentId}`)
      } else {
        setError(data.error ?? "Erro ao iniciar a compra")
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-5">
      <div className="max-w-lg mx-auto py-6">
        <h1
          className="text-white font-bold mb-1"
          style={{ fontFamily: "var(--font-cormorant)", fontSize: "2rem" }}
        >
          Pacotes
        </h1>
        <p className="text-zinc-500 text-sm mb-6">
          Compre créditos e economize nos próximos atendimentos.
        </p>

        {packages.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-600 text-sm">Nenhum pacote disponível no momento.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {packages.map((pkg) => {
              const sel = selected?.id === pkg.id
              return (
                <button
                  key={pkg.id}
                  onClick={() => setSelected(pkg)}
                  className="w-full text-left rounded-xl border-2 transition-all px-5 py-4 flex items-center justify-between"
                  style={{
                    borderColor: sel ? "#f59e0b" : "#27272a",
                    backgroundColor: sel ? "#f59e0b08" : "#18181b",
                  }}
                >
                  <div>
                    <p className="text-white font-medium text-sm">{pkg.name}</p>
                    <p className="text-zinc-500 text-xs mt-0.5">
                      {pkg.credits}× {pkg.serviceName} · validade {pkg.validityDays} dias
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className="text-amber-400 font-bold text-sm">
                      R$ {pkg.price.toFixed(2).replace(".", ",")}
                    </span>
                    <div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0"
                      style={{
                        borderColor: sel ? "#f59e0b" : "#3f3f46",
                        backgroundColor: sel ? "#f59e0b" : "transparent",
                      }}
                    >
                      {sel && <Check className="w-3.5 h-3.5 text-black" />}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {selected && (
          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                Seu nome
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="João Silva"
                className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-amber-500 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                WhatsApp (com DDD)
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                maxLength={11}
                placeholder="11999999999"
                className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-amber-500 transition-all"
              />
              <p className="text-zinc-600 text-xs mt-2">
                Os créditos ficam vinculados a este número.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-amber-500 transition-all"
              />
              <p className="text-zinc-600 text-xs mt-2">Necessário para gerar o PIX.</p>
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-950/30 border border-red-800/50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              onClick={handleBuy}
              disabled={!canBuy || submitting}
              className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40"
              style={{ backgroundColor: "#f59e0b", color: "#000" }}
            >
              {submitting
                ? "Processando..."
                : `Pagar R$ ${selected.price.toFixed(2).replace(".", ",")} via PIX →`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
