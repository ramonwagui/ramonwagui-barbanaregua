"use client"

import { useState } from "react"
import Link from "next/link"
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react"

export default function CancelarClient({
  slug,
  appointmentId,
}: {
  slug: string
  appointmentId: string
}) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [refund, setRefund] = useState<string>("NONE")
  const [err, setErr] = useState<string | null>(null)

  async function cancel() {
    setState("loading")
    try {
      const res = await fetch(
        `/api/public/${slug}/appointment/${appointmentId}/cancel`,
        { method: "POST" }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErr(data.error ?? "Não foi possível cancelar. Tente novamente.")
        setState("error")
        return
      }
      setRefund(data.refund ?? "NONE")
      setState("done")
    } catch {
      setErr("Falha de conexão. Tente novamente.")
      setState("error")
    }
  }

  if (state === "done") {
    const refundMsg =
      refund === "REFUNDED"
        ? "O sinal pago será estornado automaticamente na sua conta."
        : refund === "KEPT"
          ? "O sinal não será estornado (cancelamento sem a antecedência mínima)."
          : null

    return (
      <div className="text-center">
        <CheckCircle2 className="w-14 h-14 text-emerald-400 mx-auto mb-4" />
        <h2
          className="text-white mb-2"
          style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.8rem", fontWeight: 700 }}
        >
          Agendamento cancelado
        </h2>
        {refundMsg && <p className="text-zinc-400 text-sm mb-6">{refundMsg}</p>}
        <Link href={`/b/${slug}`}>
          <button className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold transition-all">
            Fazer novo agendamento
          </button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {state === "error" && err && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <p className="text-red-300 text-xs">{err}</p>
        </div>
      )}
      <button
        onClick={cancel}
        disabled={state === "loading"}
        className="w-full py-3.5 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-semibold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
      >
        {state === "loading" ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Cancelando…
          </>
        ) : (
          "Confirmar cancelamento"
        )}
      </button>
      <Link href={`/b/${slug}`}>
        <button className="w-full py-3.5 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 text-sm font-medium transition-all">
          Manter agendamento
        </button>
      </Link>
    </div>
  )
}
