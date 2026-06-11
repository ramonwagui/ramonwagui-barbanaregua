import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { Calendar, Clock, Scissors, XCircle } from "lucide-react"
import CancelarClient from "./cancelar-client"

const TZ_DEFAULT = "America/Sao_Paulo"
function fmtFullDate(d: Date, tz: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d)
}
function fmtHm(d: Date, tz: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d)
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-5">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}

/**
 * Estado de cancelamento calculado fora do componente (usa o horário atual,
 * o que não é permitido durante o render de um Server Component).
 */
function computeCancelState(
  status: string,
  scheduledAt: Date,
  depositPaid: boolean,
  cancelRefundHours: number
) {
  const now = Date.now()
  const cancellable =
    ["PENDING", "CONFIRMED"].includes(status) && scheduledAt.getTime() > now
  const hoursUntil = (scheduledAt.getTime() - now) / (1000 * 60 * 60)
  const willRefund = depositPaid && hoursUntil >= cancelRefundHours
  return { cancellable, willRefund }
}

export default async function CancelarPage({
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
      <Shell>
        <p className="text-zinc-500 text-center">Agendamento não encontrado.</p>
      </Shell>
    )
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id },
    include: {
      barber: { include: { user: { select: { name: true } } } },
      services: { include: { service: true } },
      tenant: true,
      payment: { select: { status: true } },
    },
  })

  if (!appointment || appointment.tenant.slug !== slug) {
    return (
      <Shell>
        <p className="text-zinc-500 text-center">Agendamento não encontrado.</p>
      </Shell>
    )
  }

  const tenant = appointment.tenant

  // Salão não habilitou cancelamento self-service.
  if (!tenant.allowClientCancellation) {
    return (
      <Shell>
        <div className="text-center">
          <XCircle className="w-14 h-14 text-zinc-600 mx-auto mb-4" />
          <h1
            className="text-white mb-2"
            style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.8rem", fontWeight: 700 }}
          >
            Cancelamento indisponível
          </h1>
          <p className="text-zinc-500 text-sm mb-6">
            Para cancelar este agendamento, entre em contato com {tenant.name}.
          </p>
          <Link href={`/b/${slug}`}>
            <button className="w-full py-3.5 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 text-sm font-medium transition-all">
              ← Voltar para a barbearia
            </button>
          </Link>
        </div>
      </Shell>
    )
  }

  const isCancelled = appointment.status === "CANCELLED"
  const depositPaid = appointment.payment?.status === "PAID"
  const { cancellable, willRefund } = computeCancelState(
    appointment.status,
    appointment.scheduledAt,
    depositPaid,
    tenant.cancelRefundHours
  )

  return (
    <Shell>
      <div className="text-center mb-8">
        <h1
          className="text-white mb-2"
          style={{ fontFamily: "var(--font-cormorant)", fontSize: "2rem", fontWeight: 700 }}
        >
          {isCancelled
            ? "Agendamento cancelado"
            : cancellable
              ? "Cancelar agendamento?"
              : "Não é possível cancelar"}
        </h1>
        {!isCancelled && !cancellable && (
          <p className="text-zinc-500 text-sm">
            Este agendamento já passou ou não está mais ativo.
          </p>
        )}
      </div>

      {/* Card de detalhes */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden mb-5">
        <div className="px-6 py-5 border-b border-zinc-800">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-1">
            Barbearia
          </p>
          <p className="text-white font-semibold">{tenant.name}</p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-start gap-3">
            <Calendar className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-zinc-500 mb-0.5">Data</p>
              <p className="text-white text-sm font-medium capitalize">
                {fmtFullDate(appointment.scheduledAt, tenant.timezone ?? TZ_DEFAULT)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-zinc-500 mb-0.5">Horário</p>
              <p className="text-white text-sm font-medium">
                {fmtHm(appointment.scheduledAt, tenant.timezone ?? TZ_DEFAULT)} – {fmtHm(appointment.endsAt, tenant.timezone ?? TZ_DEFAULT)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Scissors className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-zinc-500 mb-0.5">Serviço</p>
              <p className="text-white text-sm font-medium">
                {appointment.services.map((s) => s.service.name).join(" + ")}
              </p>
              <p className="text-zinc-500 text-xs mt-0.5">com {appointment.barber.user.name}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Aviso de estorno + ação */}
      {!isCancelled && cancellable && (
        <>
          {depositPaid && (
            <div
              className={`rounded-xl border px-4 py-3 mb-4 text-xs ${
                willRefund
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300"
              }`}
            >
              {willRefund
                ? `Você está dentro do prazo: o sinal pago será estornado automaticamente.`
                : `Cancelamento sem a antecedência mínima de ${tenant.cancelRefundHours}h — o sinal não será estornado.`}
            </div>
          )}
          <CancelarClient slug={slug} appointmentId={appointment.id} />
        </>
      )}

      {(isCancelled || !cancellable) && (
        <Link href={`/b/${slug}`}>
          <button className="w-full py-3.5 rounded-xl border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-500 text-sm font-medium transition-all">
            ← Voltar para a barbearia
          </button>
        </Link>
      )}
    </Shell>
  )
}
