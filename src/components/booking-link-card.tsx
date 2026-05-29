"use client"

import { useState, useRef, useEffect } from "react"
import { QRCodeCanvas } from "qrcode.react"
import { Copy, Check, Download, ExternalLink } from "lucide-react"

export default function BookingLinkCard({ slug }: { slug: string }) {
  const [origin, setOrigin] = useState("")
  const [copied, setCopied] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const bookingUrl = `${origin}/b/${slug}`

  async function handleCopy() {
    await navigator.clipboard.writeText(bookingUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  function handleDownload() {
    const canvas = canvasRef.current?.querySelector("canvas")
    if (!canvas) return
    const url = canvas.toDataURL("image/png")
    const a = document.createElement("a")
    a.href = url
    a.download = `qrcode-${slug}.png`
    a.click()
  }

  return (
    <div
      className="rounded-2xl border border-zinc-800/60 overflow-hidden"
      style={{ backgroundColor: "#111111" }}
    >
      <div className="px-5 py-4 border-b border-zinc-800/60 flex items-center justify-between">
        <div>
          <h2
            className="text-white font-semibold"
            style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.15rem" }}
          >
            Link de Agendamento
          </h2>
          <p className="text-zinc-600 text-xs mt-0.5">
            Compartilhe com seus clientes para receber agendamentos
          </p>
        </div>
        <a
          href={`/b/${slug}`}
          target="_blank"
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-amber-400 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Abrir
        </a>
      </div>

      <div className="px-5 py-5 flex flex-col sm:flex-row items-center gap-6">
        {/* QR Code */}
        <div
          ref={canvasRef}
          className="p-3 rounded-xl bg-white shrink-0"
          style={{ lineHeight: 0 }}
        >
          <QRCodeCanvas
            value={bookingUrl || `http://localhost:3000/b/${slug}`}
            size={120}
            bgColor="#ffffff"
            fgColor="#09090b"
            level="M"
          />
        </div>

        {/* URL + actions */}
        <div className="flex-1 w-full space-y-3">
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-amber-400 truncate block">
              {bookingUrl || `…/b/${slug}`}
            </code>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
              style={{
                backgroundColor: copied ? "#14532d20" : "#f59e0b",
                color: copied ? "#4ade80" : "#000",
              }}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copiar link
                </>
              )}
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-sm font-medium transition-all"
            >
              <Download className="w-4 h-4" />
              Baixar QR
            </button>
          </div>

          <p className="text-zinc-600 text-xs">
            Imprima o QR Code ou compartilhe o link pelo WhatsApp.
          </p>
        </div>
      </div>
    </div>
  )
}
