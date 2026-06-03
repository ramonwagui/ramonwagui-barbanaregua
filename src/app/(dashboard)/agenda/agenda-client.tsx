"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { updateAppointmentStatus } from "@/lib/actions"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { format } from "date-fns"

type ApptStatus = "PENDING" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "NO_SHOW"

type Appointment = {
  id: string
  guestName: string | null
  guestPhone: string | null
  scheduledAt: string
  endsAt: string
  totalPrice: number
  depositAmount: number | null
  status: ApptStatus
  barberId: string
  barberName: string
  services: { name: string }[]
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

export default function AgendaClient({
  appointments,
  barbers,
  dateLabel,
  dateStr,
  prevDate,
  nextDate,
  isBarber = false,
}: {
  appointments: Appointment[]
  barbers: { id: string; name: string }[]
  dateLabel: string
  dateStr: string
  prevDate: string
  nextDate: string
  isBarber?: boolean
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [filterBarber, setFilterBarber] = useState<string>("all")

  const filtered =
    filterBarber === "all"
      ? appointments
      : appointments.filter((a) => a.barberId === filterBarber)

  function advanceStatus(appt: Appointment) {
    const next = NEXT_STATUS[appt.status]
    if (!next) return
    startTransition(async () => {
      await updateAppointmentStatus(appt.id, next)
    })
  }

  function cancelAppt(appt: Appointment) {
    startTransition(async () => {
      await updateAppointmentStatus(appt.id, "CANCELLED")
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1
            className="text-white font-bold"
            style={{ fontFamily: "var(--font-cormorant)", fontSize: "2rem" }}
          >
            Agenda
          </h1>
          <p className="text-zinc-500 text-sm capitalize mt-0.5">{dateLabel}</p>
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push(`/agenda?date=${prevDate}`)}
            className="w-9 h-9 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white flex items-center justify-center transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => router.push(`/agenda?date=${format(new Date(), "yyyy-MM-dd")}`)}
            className="px-3 h-9 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all"
          >
            <Calendar className="w-3.5 h-3.5" />
            Hoje
          </button>
          <button
            onClick={() => router.push(`/agenda?date=${nextDate}`)}
            className="w-9 h-9 rounded-lg border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white flex items-center justify-center transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Barber filter — apenas para owner/admin */}
      {!isBarber && barbers.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterBarber("all")}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              backgroundColor: filterBarber === "all" ? "#f59e0b" : "#18181b",
              color: filterBarber === "all" ? "#000" : "#71717a",
              border: filterBarber === "all" ? "2px solid #f59e0b" : "2px solid #27272a",
            }}
          >
            Todos
          </button>
          {barbers.map((b) => (
            <button
              key={b.id}
              onClick={() => setFilterBarber(b.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                backgroundColor: filterBarber === b.id ? "#f59e0b" : "#18181b",
                color: filterBarber === b.id ? "#000" : "#71717a",
                border: filterBarber === b.id ? "2px solid #f59e0b" : "2px solid #27272a",
              }}
            >
              {b.name}
            </button>
          ))}
        </div>
      )}

      {/* Appointments */}
      {filtered.length === 0 ? (
        <div
          className="rounded-2xl border border-zinc-800/60 py-20 text-center"
          style={{ backgroundColor: "#111111" }}
        >
          <Calendar className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-600 text-sm">Nenhum agendamento nesta data</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((appt) => {
            const style = STATUS_STYLES[appt.status]
            const nextStatus = NEXT_STATUS[appt.status]
            const start = new Date(appt.scheduledAt)
            const end = new Date(appt.endsAt)

            return (
              <div
                key={appt.id}
                className="rounded-2xl border border-zinc-800/60 overflow-hidden hover:border-zinc-700 transition-colors"
                style={{ backgroundColor: "#111111" }}
              >
                <div className="flex items-center gap-4 px-5 py-4">
                  {/* Time */}
                  <div className="w-16 shrink-0 text-center">
                    <p className="text-white font-bold text-sm">{format(start, "HH:mm")}</p>
                    <p className="text-zinc-600 text-xs">{format(end, "HH:mm")}</p>
                  </div>

                  <div className="w-px h-10 bg-zinc-800 shrink-0" />

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium text-sm">
                      {appt.guestName ?? "Cliente"}
                    </p>
                    <p className="text-zinc-500 text-xs mt-0.5 truncate">
                      {appt.services.map((s) => s.name).join(" + ")}
                      {!isBarber && ` · ${appt.barberName}`}
                    </p>
                    {appt.guestPhone && (
                      <p className="text-zinc-600 text-xs mt-0.5">{appt.guestPhone}</p>
                    )}
                  </div>

                  {/* Price */}
                  <div className="text-right shrink-0 hidden sm:block">
                    <p
                      className="text-amber-400 font-bold"
                      style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.1rem" }}
                    >
                      R$ {appt.totalPrice.toFixed(2).replace(".", ",")}
                    </p>
                    {appt.depositAmount && appt.depositAmount > 0 && (
                      <p className="text-zinc-500 text-[11px] mt-0.5 whitespace-nowrap">
                        sinal R$ {appt.depositAmount.toFixed(2).replace(".", ",")}
                        {" · "}
                        falta R$ {(appt.totalPrice - appt.depositAmount).toFixed(2).replace(".", ",")}
                      </p>
                    )}
                  </div>

                  {/* Status + Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap"
                      style={{ backgroundColor: style.bg, color: style.text }}
                    >
                      {STATUS_LABELS[appt.status]}
                    </span>

                    {nextStatus && (
                      <button
                        onClick={() => advanceStatus(appt)}
                        disabled={isPending}
                        className="text-xs px-2.5 py-1 rounded-full font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors disabled:opacity-50"
                      >
                        → {STATUS_LABELS[nextStatus]}
                      </button>
                    )}

                    {appt.status !== "CANCELLED" && appt.status !== "COMPLETED" && appt.status !== "NO_SHOW" && (
                      <button
                        onClick={() => cancelAppt(appt)}
                        disabled={isPending}
                        className="text-xs px-2 py-1 rounded-full text-zinc-600 hover:text-red-400 transition-colors disabled:opacity-50"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Summary */}
      {filtered.length > 0 && (
        <div className="rounded-2xl border border-zinc-800/60 px-5 py-4 flex items-center justify-between"
          style={{ backgroundColor: "#111111" }}
        >
          <p className="text-zinc-500 text-sm">
            {filtered.length} agendamento{filtered.length !== 1 ? "s" : ""}
          </p>
          <p className="text-amber-400 font-bold" style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.1rem" }}>
            Total: R$ {filtered
              .filter((a) => !["CANCELLED", "NO_SHOW"].includes(a.status))
              .reduce((s, a) => s + a.totalPrice, 0)
              .toFixed(2).replace(".", ",")}
          </p>
        </div>
      )}
    </div>
  )
}
