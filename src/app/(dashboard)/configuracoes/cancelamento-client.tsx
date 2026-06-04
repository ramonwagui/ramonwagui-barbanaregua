"use client"

import { useState, useTransition } from "react"
import { updateClientCancellation } from "@/lib/actions"
import { Check } from "lucide-react"

export default function CancelamentoClient({
  initial,
  cancelRefundHours,
}: {
  initial: boolean
  cancelRefundHours: number
}) {
  const [enabled, setEnabled] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  function toggle() {
    const next = !enabled
    setEnabled(next)
    startTransition(async () => {
      await updateClientCancellation(next)
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
          Cancelamento pelo cliente
        </h2>
        <p className="text-zinc-600 text-xs mt-0.5">
          Permita que o cliente cancele o próprio agendamento pelo link enviado.
        </p>
      </div>

      <div className="px-5 py-5 space-y-3">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <p className="text-white text-sm font-medium">
              Permitir cancelamento self-service
            </p>
            <p className="text-zinc-600 text-xs mt-0.5">
              O cliente pode cancelar pelo link da confirmação. A política de
              estorno do sinal continua valendo automaticamente.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            disabled={isPending}
            onClick={toggle}
            className="relative w-12 h-6 rounded-full transition-colors shrink-0 ml-4 disabled:opacity-60"
            style={{ backgroundColor: enabled ? "#f59e0b" : "#3f3f46" }}
          >
            <span
              className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform"
              style={{ transform: enabled ? "translateX(24px)" : "translateX(0)" }}
            />
          </button>
        </label>

        {enabled && (
          <p className="text-zinc-600 text-xs">
            Cancelamentos com pelo menos{" "}
            <span className="text-zinc-400">{cancelRefundHours}h</span> de
            antecedência têm o sinal estornado automaticamente. Em cima da hora,
            o sinal fica com a barbearia.
          </p>
        )}

        {saved && (
          <div className="flex items-center gap-1.5 text-green-400 text-sm">
            <Check className="w-4 h-4" />
            Salvo!
          </div>
        )}
      </div>
    </div>
  )
}
