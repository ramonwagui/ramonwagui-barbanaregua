"use client"

import { useState, useTransition } from "react"
import { updateLoyaltySettings } from "@/lib/actions"
import { Check } from "lucide-react"

type ServiceOpt = { id: string; name: string }

export default function FidelidadeClient({
  initial,
  services,
}: {
  initial: { enabled: boolean; threshold: number; rewardServiceId: string | null }
  services: ServiceOpt[]
}) {
  const [form, setForm] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      await updateLoyaltySettings({
        enabled: form.enabled,
        threshold: form.threshold,
        rewardServiceId: form.rewardServiceId,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    })
  }

  const needsReward = form.enabled && !form.rewardServiceId

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
          Programa de fidelidade
        </h2>
        <p className="text-zinc-600 text-xs mt-0.5">
          A cada N atendimentos, o cliente ganha um serviço grátis.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="px-5 py-5 space-y-5">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-white text-sm font-medium">Ativar fidelidade</p>
            <p className="text-zinc-600 text-xs mt-0.5">
              Conta automaticamente os atendimentos concluídos de cada cliente.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.enabled}
            onClick={() => setForm((f) => ({ ...f, enabled: !f.enabled }))}
            className="relative w-12 h-6 rounded-full transition-colors shrink-0 ml-4"
            style={{ backgroundColor: form.enabled ? "#f59e0b" : "#3f3f46" }}
          >
            <span
              className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
              style={{ transform: form.enabled ? "translateX(24px)" : "translateX(0)" }}
            />
          </button>
        </label>

        {form.enabled && (
          <div className="space-y-4 pt-1">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                  A cada (atendimentos)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.threshold}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, threshold: Number(e.target.value) }))
                  }
                  className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                  Recompensa (serviço grátis)
                </label>
                <select
                  value={form.rewardServiceId ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, rewardServiceId: e.target.value || null }))
                  }
                  className="w-full bg-zinc-900 border border-zinc-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:border-amber-500 transition-all"
                >
                  <option value="">Selecione…</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <p className="text-zinc-600 text-xs">
              Ex.: a cada <span className="text-zinc-400">{form.threshold}</span> cortes,
              o próximo {form.rewardServiceId ? "serviço escolhido" : "serviço"} sai grátis.
            </p>
            {needsReward && (
              <p className="text-amber-400 text-xs">
                Selecione o serviço da recompensa para ativar.
              </p>
            )}
          </div>
        )}

        <div className="pt-1 flex items-center gap-3">
          <button
            type="submit"
            disabled={isPending || needsReward}
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
