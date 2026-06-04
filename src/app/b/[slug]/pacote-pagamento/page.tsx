"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useSearchParams } from "next/navigation"
import { QRCodeSVG } from "qrcode.react"
import { Copy, Check, Loader2, CheckCircle2, XCircle } from "lucide-react"

type State = {
  status: "PENDING" | "PAID" | "FAILED"
  pixCode: string | null
  pixQrCode: string | null
  amount: number
  credits: number
}

export default function PacotePagamentoPage() {
  const { slug } = useParams<{ slug: string }>()
  const search = useSearchParams()
  const paymentId = search.get("paymentId") ?? ""

  const [data, setData] = useState<State | null>(null)
  const [loading, setLoading] = useState(!!paymentId)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/public/${slug}/package-payment/${paymentId}`)
    if (!res.ok) return null
    return (await res.json()) as State
  }, [slug, paymentId])

  useEffect(() => {
    if (!paymentId) return
    load()
      .then((d) => setData(d))
      .finally(() => setLoading(false))
  }, [paymentId, load])

  useEffect(() => {
    if (!paymentId || !data || data.status !== "PENDING") return
    const interval = setInterval(async () => {
      const d = await load()
      if (d) setData(d)
    }, 4000)
    return () => clearInterval(interval)
  }, [paymentId, data, load])

  function copyCode() {
    if (!data?.pixCode) return
    navigator.clipboard.writeText(data.pixCode)
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

  if (!paymentId || !data) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-5">
        <p className="text-zinc-500">Pagamento não encontrado.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-5">
      <div className="w-full max-w-md">
        {data.status === "PAID" ? (
          <div className="text-center py-16">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
            <h1 className="text-white text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-cormorant)" }}>
              Pacote ativado!
            </h1>
            <p className="text-zinc-500 text-sm">
              Você tem {data.credits} créditos. Use-os no próximo agendamento. ✂️
            </p>
          </div>
        ) : data.status === "FAILED" ? (
          <div className="text-center py-16">
            <XCircle className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
            <h1 className="text-white text-2xl font-bold mb-2" style={{ fontFamily: "var(--font-cormorant)" }}>
              Pagamento não concluído
            </h1>
            <p className="text-zinc-500 text-sm">Tente comprar o pacote novamente.</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-6">
              <h1 className="text-white mb-2" style={{ fontFamily: "var(--font-cormorant)", fontSize: "2rem", fontWeight: 700 }}>
                Pague o pacote via PIX
              </h1>
              <p className="text-zinc-500 text-sm">
                Pague{" "}
                <span className="text-amber-400 font-semibold">
                  R$ {data.amount.toFixed(2).replace(".", ",")}
                </span>{" "}
                para liberar {data.credits} créditos.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-5 flex items-center justify-center mb-5">
              {data.pixQrCode ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`data:image/png;base64,${data.pixQrCode}`} alt="QR Code PIX" className="w-56 h-56" />
              ) : data.pixCode ? (
                <QRCodeSVG value={data.pixCode} size={224} />
              ) : (
                <p className="text-zinc-500 text-sm py-20">QR indisponível</p>
              )}
            </div>

            <button
              onClick={copyCode}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-zinc-700 text-zinc-200 hover:border-amber-500 text-sm font-medium transition-all mb-3"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" /> Código copiado!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" /> Copiar código PIX (copia e cola)
                </>
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
