"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { QRCodeSVG } from "qrcode.react"
import { Copy, Check, Clock, Loader2, CheckCircle2, XCircle } from "lucide-react"

type Detail = {
  pixCode: string | null
  pixQrCode: string | null
  depositAmount: number
  status: string
  appointmentId: string
  appointmentStatus: string
  expiresAt: string | null
}

export default function PagamentoPage() {
  const { slug } = useParams<{ slug: string }>()
  const search = useSearchParams()
  const router = useRouter()
  const paymentId = search.get("paymentId") ?? ""

  const [detail, setDetail] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [state, setState] = useState<"PENDING" | "PAID" | "EXPIRED" | "FAILED">("PENDING")

  // Carrega o detalhe (QR + código) uma vez
  useEffect(() => {
    if (!paymentId) {
      setLoading(false)
      return
    }
    fetch(`/api/public/${slug}/payment/${paymentId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Detail | null) => {
        setDetail(d)
        if (d?.appointmentStatus === "CANCELLED") setState("EXPIRED")
        if (d?.status === "PAID") setState("PAID")
      })
      .finally(() => setLoading(false))
  }, [slug, paymentId])

  // Polling do status
  const poll = useCallback(async () => {
    const res = await fetch(`/api/public/${slug}/payment/${paymentId}/status`)
    if (!res.ok) return
    const data = await res.json()
    if (data.status === "PAID") {
      setState("PAID")
      setTimeout(() => router.push(`/b/${slug}/confirmar?id=${data.appointmentId}`), 1200)
    } else if (data.status === "EXPIRED") {
      setState("EXPIRED")
    } else if (data.status === "FAILED") {
      setState("FAILED")
    }
  }, [slug, paymentId, router])

  useEffect(() => {
    if (state !== "PENDING" || !paymentId) return
    const interval = setInterval(poll, 4000)
    return () => clearInterval(interval)
  }, [state, paymentId, poll])

  // Contador regressivo
  useEffect(() => {
    if (!detail?.expiresAt) return
    const target = new Date(detail.expiresAt).getTime()
    const tick = () => {
      const diff = Math.max(0, Math.floor((target - Date.now()) / 1000))
      setRemaining(diff)
      if (diff === 0 && state === "PENDING") setState("EXPIRED")
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [detail?.expiresAt, state])

  function copyCode() {
    if (!detail?.pixCode) return
    navigator.clipboard.writeText(detail.pixCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-amber-400 animate-spin" />
      </div>
    )
  }

  if (!paymentId || !detail) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-5">
        <p className="text-zinc-500">Pagamento não encontrado.</p>
      </div>
    )
  }

  const mm = remaining !== null ? String(Math.floor(remaining / 60)).padStart(2, "0") : "--"
  const ss = remaining !== null ? String(remaining % 60).padStart(2, "0") : "--"

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-5">
      <div className="w-full max-w-md">
        {state === "PAID" ? (
          <div className="text-center py-16">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
            <h1 className="text-white text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-cormorant)" }}>
              Sinal recebido!
            </h1>
            <p className="text-zinc-500 text-sm">Confirmando seu agendamento…</p>
          </div>
        ) : state === "EXPIRED" || state === "FAILED" ? (
          <div className="text-center py-16">
            <XCircle className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
            <h1 className="text-white text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-cormorant)" }}>
              {state === "EXPIRED" ? "Tempo esgotado" : "Pagamento não concluído"}
            </h1>
            <p className="text-zinc-500 text-sm mb-6">
              O horário foi liberado. Faça um novo agendamento para tentar de novo.
            </p>
            <button
              onClick={() => router.push(`/b/${slug}/agendar`)}
              className="px-5 py-3 rounded-xl font-semibold text-sm"
              style={{ backgroundColor: "#f59e0b", color: "#000" }}
            >
              Agendar novamente
            </button>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <h1 className="text-white mb-2" style={{ fontFamily: "var(--font-cormorant)", fontSize: "2rem", fontWeight: 700 }}>
                Pague o sinal via PIX
              </h1>
              <p className="text-zinc-500 text-sm">
                Pague <span className="text-amber-400 font-semibold">R$ {detail.depositAmount.toFixed(2).replace(".", ",")}</span> para
                confirmar seu horário. O valor é abatido do total no dia.
              </p>
            </div>

            {/* Contador */}
            <div className="flex items-center justify-center gap-2 mb-5 text-zinc-400 text-sm">
              <Clock className="w-4 h-4 text-amber-400" />
              Expira em <span className="font-mono text-white">{mm}:{ss}</span>
            </div>

            {/* QR Code */}
            <div className="bg-white rounded-2xl p-5 flex items-center justify-center mb-5">
              {detail.pixQrCode ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`data:image/png;base64,${detail.pixQrCode}`}
                  alt="QR Code PIX"
                  className="w-56 h-56"
                />
              ) : detail.pixCode ? (
                <QRCodeSVG value={detail.pixCode} size={224} />
              ) : (
                <p className="text-zinc-500 text-sm py-20">QR indisponível</p>
              )}
            </div>

            {/* Copia e cola */}
            <button
              onClick={copyCode}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-zinc-700 text-zinc-200 hover:border-amber-500 text-sm font-medium transition-all mb-3"
            >
              {copied ? (
                <><Check className="w-4 h-4 text-emerald-400" /> Código copiado!</>
              ) : (
                <><Copy className="w-4 h-4" /> Copiar código PIX (copia e cola)</>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-zinc-600 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Aguardando confirmação do pagamento…
            </div>
          </>
        )}
      </div>
    </div>
  )
}
