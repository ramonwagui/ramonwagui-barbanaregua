import { prisma } from "@/lib/prisma"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import Link from "next/link"
import { Calendar, Clock, Scissors, CheckCircle2 } from "lucide-react"

export default async function ConfirmarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ id?: string }>
}) {
  const { slug } = await params
  const { id } = await searchParams

  if (!id) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-500">Agendamento não encontrado.</p>
      </div>
    )
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      barber: { include: { user: { select: { name: true } } } },
      services: { include: { service: true } },
      tenant: true,
    },
  })

  if (!appointment) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-500">Agendamento não encontrado.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-5">
      <div className="w-full max-w-md">
        {/* Success icon */}
        <div className="text-center mb-10">
          <div className="relative inline-flex items-center justify-center mb-6">
            <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-amber-400" />
            </div>
            <div className="absolute inset-0 rounded-full animate-ping bg-amber-500/10" />
          </div>

          <h1
            className="text-white mb-3"
            style={{
              fontFamily: "var(--font-cormorant)",
              fontSize: "2.2rem",
              fontWeight: 700,
              lineHeight: 1.1,
            }}
          >
            Agendado com sucesso!
          </h1>
          <p className="text-zinc-500 text-sm leading-relaxed max-w-xs mx-auto">
            Você receberá uma confirmação no WhatsApp em breve. Até lá! ✂
          </p>
        </div>

        {/* Appointment card */}
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden mb-5">
          <div className="px-6 py-5 border-b border-zinc-800">
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1">
              Barbearia
            </p>
            <p className="text-white font-semibold">{appointment.tenant.name}</p>
          </div>

          <div className="px-6 py-5 space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-zinc-500 mb-0.5">Data</p>
                <p className="text-white text-sm font-medium capitalize">
                  {format(appointment.scheduledAt, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-zinc-500 mb-0.5">Horário</p>
                <p className="text-white text-sm font-medium">
                  {format(appointment.scheduledAt, "HH:mm")} – {format(appointment.endsAt, "HH:mm")}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Scissors className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-zinc-500 mb-0.5">Serviço</p>
                <p className="text-white text-sm font-medium">
                  {appointment.services.map((s: { service: { name: string } }) => s.service.name).join(" + ")}
                </p>
                <p className="text-zinc-500 text-xs mt-0.5">com {appointment.barber.user.name}</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-4 bg-zinc-800/40 border-t border-zinc-800 flex justify-between items-center">
            <span className="text-zinc-500 text-sm">Total</span>
            <span
              className="font-bold text-lg text-amber-400"
              style={{ fontFamily: "var(--font-cormorant)" }}
            >
              R$ {Number(appointment.totalPrice).toFixed(2).replace(".", ",")}
            </span>
          </div>
        </div>

        <Link href={`/b/${slug}`}>
          <button className="w-full py-3.5 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 text-sm font-medium transition-all">
            ← Voltar para a barbearia
          </button>
        </Link>
      </div>
    </div>
  )
}
