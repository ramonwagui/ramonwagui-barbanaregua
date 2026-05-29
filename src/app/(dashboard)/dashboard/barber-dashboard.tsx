"use client"

import { useState, useTransition } from "react"
import { updateAppointmentStatus } from "@/lib/actions"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CalendarDays, CheckCircle2, Clock, ChevronDown } from "lucide-react"

type ApptStatus = "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW"

type Appointment = {
  id: string
  guestName: string | null
  guestPhone: string | null
  scheduledAt: string
  endsAt: string
  totalPrice: number
  status: ApptStatus
  services: { name: string }[]
}

type NextDay = {
  label: string
  count: number
  dateStr: string
}

const STATUS_LABELS: Record<ApptStatus, string> = {
  PENDING: "Pendente",
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  NO_SHOW: "Não compareceu",
}

const STATUS_STYLES: Record<ApptStatus, { bg: string; text: string }> = {
  CONFIRMED: { bg: "#1e3a5f20", text: "#60a5fa" },
  PENDING: { bg: "#78350f20", text: "#fbbf24" },
  IN_PROGRESS: { bg: "#7c2d1220", text: "#fb923c" },
  COMPLETED: { bg: "#14532d20", text: "#4ade80" },
  CANCELLED: { bg: "#7f1d1d20", text: "#f87171" },
  NO_SHOW: { bg: "#27272a30", text: "#71717a" },
}

const NEXT_STATUS: Partial<Record<ApptStatus, ApptStatus>> = {
  PENDING: "CONFIRMED",
  CONFIRMED: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
}

const NEXT_LABELS: Partial<Record<ApptStatus, string>> = {
  PENDING: "Confirmar",
  CONFIRMED: "Iniciar",
  IN_PROGRESS: "Concluir",
}

export default function BarberDashboard({
  barberName,
  todayAppointments: initial,
  todayStats,
  nextDays,
  weekTotal,
  dateLabel,
}: {
  barberName: string
  todayAppointments: Appointment[]
  todayStats: { total: number; completed: number; pending: number }
  nextDays: NextDay[]
  weekTotal: number
  dateLabel: string
}) {
  const [appointments, setAppointments] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function advanceStatus(appt: Appointment) {
    const next = NEXT_STATUS[appt.status]
    if (!next) return
    startTransition(async () => {
      await updateAppointmentStatus(appt.id, next)
      setAppointments((prev) =>
        prev.map((a) => a.id === appt.id ? { ...a, status: next } : a)
      )
    })
  }

  function cancelAppt(appt: Appointment) {
    startTransition(async () => {
      await updateAppointmentStatus(appt.id, "CANCELLED")
      setAppointments((prev) =>
        prev.map((a) => a.id === appt.id ? { ...a, status: "CANCELLED" } : a)
      )
    })
  }

  const activeAppts = appointments.filter((a) => !["CANCELLED", "NO_SHOW"].includes(a.status))
  const completedToday = appointments.filter((a) => a.status === "COMPLETED").length

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-white font-bold leading-tight"
            style={{ fontFamily: "var(--font-cormorant)", fontSize: "2rem" }}
          >
            Olá, {barberName.split(" ")[0]}!
          </h1>
          <p className="text-zinc-500 text-sm mt-1 capitalize">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-3 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-amber-400 text-xs font-semibold">Ao vivo</span>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Hoje", value: todayStats.total, color: "#f59e0b", icon: CalendarDays },
          { label: "Concluídos", value: completedToday, color: "#4ade80", icon: CheckCircle2 },
          { label: "Esta semana", value: weekTotal, color: "#60a5fa", icon: Clock },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-zinc-800/60 p-4 flex flex-col gap-3"
            style={{ backgroundColor: "#111111" }}
          >
            <div className="flex items-center justify-between">
              <p className="text-zinc-500 text-xs font-semibold uppercase tracking-widest">{kpi.label}</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${kpi.color}15` }}>
                <kpi.icon className="w-3.5 h-3.5" style={{ color: kpi.color }} />
              </div>
            </div>
            <p
              className="text-white font-bold"
              style={{ fontFamily: "var(--font-cormorant)", fontSize: "2rem", lineHeight: 1 }}
            >
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Today's schedule */}
      <div className="rounded-2xl border border-zinc-800/60 overflow-hidden" style={{ backgroundColor: "#111111" }}>
        <div className="px-5 py-4 border-b border-zinc-800/60 flex items-center justify-between">
          <h2
            className="text-white font-semibold"
            style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.15rem" }}
          >
            Agenda de Hoje
          </h2>
          <span className="text-zinc-600 text-xs">
            {activeAppts.length} agendamento{activeAppts.length !== 1 ? "s" : ""}
          </span>
        </div>

        {appointments.length === 0 ? (
          <div className="py-16 text-center">
            <CalendarDays className="w-9 h-9 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-600 text-sm">Nenhum agendamento hoje</p>
            <p className="text-zinc-700 text-xs mt-1">Aproveite para descansar! ✂</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/40">
            {appointments.map((appt) => {
              const style = STATUS_STYLES[appt.status]
              const nextStatus = NEXT_STATUS[appt.status]
              const nextLabel = NEXT_LABELS[appt.status]
              const isExpanded = expandedId === appt.id
              const isDone = ["CANCELLED", "NO_SHOW", "COMPLETED"].includes(appt.status)

              return (
                <div key={appt.id} style={{ opacity: isDone ? 0.55 : 1 }}>
                  {/* Main row */}
                  <div
                    className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-zinc-800/20 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : appt.id)}
                  >
                    {/* Time block */}
                    <div
                      className="w-14 shrink-0 text-center py-2 rounded-xl"
                      style={{ backgroundColor: isDone ? "#18181b" : "#f59e0b10", border: `1px solid ${isDone ? "#27272a" : "#f59e0b20"}` }}
                    >
                      <p className="text-white font-bold text-sm leading-none">
                        {format(new Date(appt.scheduledAt), "HH:mm")}
                      </p>
                      <p className="text-zinc-600 text-xs mt-1">
                        {format(new Date(appt.endsAt), "HH:mm")}
                      </p>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm">{appt.guestName ?? "Cliente"}</p>
                      <p className="text-zinc-500 text-xs mt-0.5 truncate">
                        {appt.services.map((s) => s.name).join(" + ")}
                      </p>
                    </div>

                    {/* Status badge */}
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap shrink-0"
                      style={{ backgroundColor: style.bg, color: style.text }}
                    >
                      {STATUS_LABELS[appt.status]}
                    </span>

                    <ChevronDown
                      className="w-4 h-4 text-zinc-600 shrink-0 transition-transform"
                      style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}
                    />
                  </div>

                  {/* Expanded actions */}
                  {isExpanded && (
                    <div className="px-5 pb-4 flex items-center gap-3 bg-zinc-800/10">
                      {/* Client details */}
                      <div className="flex-1">
                        {appt.guestPhone && (
                          <a
                            href={`https://wa.me/55${appt.guestPhone}`}
                            target="_blank"
                            className="inline-flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 transition-colors"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            {appt.guestPhone}
                          </a>
                        )}
                        <p className="text-amber-400 text-xs font-bold mt-1" style={{ fontFamily: "var(--font-cormorant)" }}>
                          R$ {appt.totalPrice.toFixed(2).replace(".", ",")}
                        </p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        {nextStatus && nextLabel && (
                          <button
                            onClick={(e) => { e.stopPropagation(); advanceStatus(appt) }}
                            disabled={isPending}
                            className="px-3 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                            style={{ backgroundColor: "#f59e0b", color: "#000" }}
                          >
                            {nextLabel}
                          </button>
                        )}
                        {!isDone && (
                          <button
                            onClick={(e) => { e.stopPropagation(); cancelAppt(appt) }}
                            disabled={isPending}
                            className="px-3 py-2 rounded-xl text-xs font-medium border border-zinc-700 text-zinc-500 hover:text-red-400 hover:border-red-800 transition-all disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Next 7 days preview */}
      {weekTotal > 0 && (
        <div className="rounded-2xl border border-zinc-800/60 overflow-hidden" style={{ backgroundColor: "#111111" }}>
          <div className="px-5 py-4 border-b border-zinc-800/60">
            <h2
              className="text-white font-semibold"
              style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.15rem" }}
            >
              Próximos 7 dias
            </h2>
          </div>
          <div className="divide-y divide-zinc-800/40">
            {nextDays.map((day) => (
              <div key={day.dateStr} className="px-5 py-3 flex items-center justify-between hover:bg-zinc-800/20 transition-colors">
                <p className="text-zinc-300 text-sm capitalize">{day.label}</p>
                {day.count > 0 ? (
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {Array.from({ length: Math.min(day.count, 6) }).map((_, i) => (
                        <div key={i} className="w-2 h-2 rounded-full bg-amber-500/60" />
                      ))}
                    </div>
                    <span className="text-amber-400 text-sm font-medium">{day.count}</span>
                  </div>
                ) : (
                  <span className="text-zinc-700 text-sm">—</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
