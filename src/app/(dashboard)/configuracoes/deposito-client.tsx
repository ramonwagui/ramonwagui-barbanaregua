"use client"

import { useState, useTransition } from "react"
import { updateDepositSettings } from "@/lib/actions"
import { Check } from "lucide-react"

type DepositData = {
  requireDeposit: boolean
  depositPercent: number
  depositExpiryMinutes: number
  cancelRefundHours: number
}

export default function DepositoClient({ initial }: { initial: DepositData }) {
  const [form, setForm] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      await updateDepositSettings(form)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  return (
    <div
      className="rounded-2xl border border-zinc-800/60 overflow-hidden"
      style={{ backgroundColor: "#111111" }}
    >
      <div className="px-5 py-4 border-b border-zinc-800/60">
        <h2
          className="text-white font-semibold"
          style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.1rem" }}
        >
          Sinal / Depósito
        </h2>
        <p className="text-zinc-600 text-xs mt-0.5">
          Exija um sinal via PIX para confirmar o agendamento e evitar no-shows.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="px-5 py-5 space-y-5">
        {/* Toggle */}
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-white text-sm font-medium">Exigir sinal para agendar</p>
            <p className="text-zinc-600 text-xs mt-0.5">
              O cliente paga uma parte antecipada via PIX para garantir o horário.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.requireDeposit}
            onClick={() => setForm((f) => ({ ...f, requireDeposit: !f.requireDeposit }))}
            className="relative w-12 h-6 rounded-full transition-colors shrink-0 ml-4"
            style={{ backgroundColor: form.requireDeposit ? "#f59e0b" : "#3f3f46" }}
          >
            <span
              className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
              style={{ transform: form.requireDeposit ? "translateX(24px)" : "translateX(0)" }}
            />
          </button>
        </label>

        {form.requireDeposit && (
          <div className="space-y-4 pt-1">
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                  Sinal (%)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.depositPercent}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, depositPercent: Number(e.target.value) }))
                  }
                  className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                  Prazo PIX (min)
                </label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={form.depositExpiryMinutes}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, depositExpiryMinutes: Number(e.target.value) }))
                  }
                  className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                  Estorno até (h antes)
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.cancelRefundHours}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cancelRefundHours: Number(e.target.value) }))
                  }
                  className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all"
                />
              </div>
            </div>
            <p className="text-zinc-600 text-xs">
              Cancelamentos com pelo menos <span className="text-zinc-400">{form.cancelRefundHours}h</span> de
              antecedência são estornados. No-show e cancelamentos em cima da hora: o sinal fica com a barbearia.
            </p>
          </div>
        )}

        <div className="pt-1 flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="bg-amber-500 hover:bg-amber-400 text-black font-semibold px-6 py-2.5 rounded-xl text-sm transition-all disabled:opacity-60"
          >
            {isPending ? "Salvando..." : "Salvar"}
          </button>
          {saved && (
            <div className="flex items-center gap-1.5 text-green-400 text-sm">
              <Check className="w-4 h-4" />
              Salvo!
            </div>
          )}
        </div>
      </form>
    </div>
  )
}
