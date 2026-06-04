"use client"

import { useTransition } from "react"
import { disconnectMercadoPago } from "@/lib/actions"
import { Check, Link2, Unlink } from "lucide-react"

type Info = {
  connected: boolean
  nickname: string | null
  connectedAt: string | null
}

export default function MercadoPagoClient({ info }: { info: Info }) {
  const [isPending, startTransition] = useTransition()

  function handleDisconnect() {
    if (!confirm("Desconectar o Mercado Pago? Novos sinais não poderão ser cobrados até reconectar.")) {
      return
    }
    startTransition(async () => {
      await disconnectMercadoPago()
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
          Recebimento (Mercado Pago)
        </h2>
        <p className="text-zinc-600 text-xs mt-0.5">
          Conecte sua conta do Mercado Pago para receber o sinal direto na sua conta.
        </p>
      </div>

      <div className="px-5 py-5">
        {info.connected ? (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-9 h-9 rounded-full bg-green-500/15 text-green-400 shrink-0">
                <Check className="w-5 h-5" />
              </span>
              <div>
                <p className="text-white text-sm font-medium">
                  Conectado{info.nickname ? ` como ${info.nickname}` : ""}
                </p>
                <p className="text-zinc-600 text-xs mt-0.5">
                  Os sinais via PIX caem direto na sua conta do Mercado Pago.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isPending}
              className="inline-flex items-center gap-1.5 border border-zinc-700 hover:border-red-500/60 hover:text-red-400 text-zinc-300 font-medium px-4 py-2 rounded-xl text-sm transition-all disabled:opacity-60"
            >
              <Unlink className="w-4 h-4" />
              {isPending ? "Desconectando..." : "Desconectar"}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-zinc-500 text-sm">
              Nenhuma conta conectada. Conecte para poder exigir sinal nos agendamentos.
            </p>
            <a
              href="/api/mp/connect"
              className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold px-5 py-2.5 rounded-xl text-sm transition-all"
            >
              <Link2 className="w-4 h-4" />
              Conectar Mercado Pago
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
