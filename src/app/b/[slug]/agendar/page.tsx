"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { Calendar } from "@/components/ui/calendar"
import { format, addDays } from "date-fns"
import { ptBR } from "date-fns/locale"
import { CheckCircle, ChevronLeft, ChevronRight, Clock, Scissors } from "lucide-react"
import BannerCarousel from "@/components/banner-carousel"

type Banner = { id: string; imageUrl: string; clickUrl: string | null }

type Service = { id: string; name: string; durationMinutes: number; price: number }
type Barber = { id: string; bio: string | null; avatarUrl: string | null; user: { name: string | null } }
type Slot = { startAt: string; endsAt: string }

const STEPS = ["Serviços", "Barbeiro", "Data e Hora", "Seus Dados", "Confirmar"]

export default function AgendarPage() {
  const { slug } = useParams<{ slug: string }>()
  const router = useRouter()

  const [step, setStep] = useState(0)
  const [services, setServices] = useState<Service[]>([])
  const [barbers, setBarbers] = useState<Barber[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [selectedServices, setSelectedServices] = useState<Service[]>([])
  const [selectedBarber, setSelectedBarber] = useState<Barber | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(addDays(new Date(), 1))
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null)
  const [guestName, setGuestName] = useState("")
  const [guestPhone, setGuestPhone] = useState("")
  const [banners, setBanners] = useState<Banner[]>([])

  useEffect(() => {
    fetch(`/api/public/${slug}/services`)
      .then((r) => r.json())
      .then((d) => setServices(d.services ?? []))
    fetch(`/api/public/${slug}/banners`)
      .then((r) => r.json())
      .then((d) => setBanners(d.banners ?? []))
  }, [slug])

  useEffect(() => {
    if (step === 1 && selectedServices.length > 0) {
      setLoading(true)
      const serviceId = selectedServices.map((s) => `serviceId=${s.id}`).join("&")
      fetch(`/api/public/${slug}/barbers?${serviceId}`)
        .then((r) => r.json())
        .then((d) => setBarbers(d.barbers ?? []))
        .finally(() => setLoading(false))
    }
  }, [step, slug, selectedServices])

  useEffect(() => {
    if (step === 2 && selectedBarber && selectedDate) {
      setLoading(true)
      setSlots([])
      const serviceIds = selectedServices.map((s) => `serviceId=${s.id}`).join("&")
      fetch(
        `/api/public/${slug}/availability?barberId=${selectedBarber.id}&date=${selectedDate.toISOString()}&${serviceIds}`
      )
        .then((r) => r.json())
        .then((d) => setSlots(d.slots ?? []))
        .finally(() => setLoading(false))
    }
  }, [step, slug, selectedBarber, selectedDate, selectedServices])

  function toggleService(service: Service) {
    setSelectedServices((prev) =>
      prev.find((s) => s.id === service.id)
        ? prev.filter((s) => s.id !== service.id)
        : [...prev, service]
    )
  }

  async function handleConfirm() {
    if (!selectedBarber || !selectedSlot) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/public/${slug}/book`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barberId: selectedBarber.id,
          serviceIds: selectedServices.map((s) => s.id),
          scheduledAt: selectedSlot.startAt,
          guestName,
          guestPhone: guestPhone.replace(/\D/g, ""),
        }),
      })
      const data = await res.json()
      if (res.ok) {
        router.push(`/b/${slug}/confirmar?id=${data.appointment.id}`)
      } else {
        const msg = data.details?.length
          ? `${data.error}: ${data.details.join(", ")}`
          : (data.error ?? "Erro ao agendar")
        alert(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const totalPrice = selectedServices.reduce((s, sv) => s + Number(sv.price), 0)
  const totalDuration = selectedServices.reduce((s, sv) => s + sv.durationMinutes, 0)

  const canAdvance =
    (step === 0 && selectedServices.length > 0) ||
    (step === 1 && selectedBarber !== null) ||
    (step === 2 && selectedSlot !== null) ||
    (step === 3 && guestName.trim().length > 0 && guestPhone.length >= 10) ||
    step === 4

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800/60">
        <div className="max-w-lg mx-auto px-5 py-4">
          {/* Progress bar */}
          <div className="flex gap-1 mb-3">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className="flex-1 h-0.5 rounded-full transition-all duration-500"
                style={{
                  backgroundColor: i <= step ? "#f59e0b" : "#27272a",
                }}
              />
            ))}
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h2
                className="text-white font-bold"
                style={{ fontFamily: "var(--font-cormorant)", fontSize: "1.35rem" }}
              >
                {STEPS[step]}
              </h2>
              <p className="text-zinc-600 text-xs">
                Etapa {step + 1} de {STEPS.length}
              </p>
            </div>
            {selectedServices.length > 0 && (
              <div className="text-right">
                <p className="text-amber-400 font-bold text-sm">
                  R$ {totalPrice.toFixed(2).replace(".", ",")}
                </p>
                <p className="text-zinc-600 text-xs">{totalDuration} min</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-5 py-6 pb-32">
        {/* Step 0 — Serviços */}
        {step === 0 && (
          <div className="space-y-2">
            {services.map((service) => {
              const selected = selectedServices.some((s) => s.id === service.id)
              return (
                <button
                  key={service.id}
                  onClick={() => toggleService(service)}
                  className="w-full text-left rounded-xl border-2 transition-all duration-200 overflow-hidden"
                  style={{
                    borderColor: selected ? "#f59e0b" : "#27272a",
                    backgroundColor: selected ? "#f59e0b08" : "#18181b",
                  }}
                >
                  <div className="flex items-center justify-between px-5 py-4">
                    <div>
                      <p className="text-white font-medium text-sm">{service.name}</p>
                      <p className="text-zinc-600 text-xs mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {service.durationMinutes} min
                      </p>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <span className="text-white font-bold text-sm">
                        R$ {Number(service.price).toFixed(2).replace(".", ",")}
                      </span>
                      <div
                        className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all"
                        style={{
                          borderColor: selected ? "#f59e0b" : "#3f3f46",
                          backgroundColor: selected ? "#f59e0b" : "transparent",
                        }}
                      >
                        {selected && <CheckCircle className="w-3.5 h-3.5 text-black" />}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Step 1 — Barbeiro */}
        {step === 1 && (
          <div className="space-y-2">
            {loading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl bg-zinc-800/50" />
                ))
              : barbers.map((barber) => {
                  const selected = selectedBarber?.id === barber.id
                  return (
                    <button
                      key={barber.id}
                      onClick={() => setSelectedBarber(barber)}
                      className="w-full text-left rounded-xl border-2 transition-all duration-200 flex items-center gap-4 px-5 py-4"
                      style={{
                        borderColor: selected ? "#f59e0b" : "#27272a",
                        backgroundColor: selected ? "#f59e0b08" : "#18181b",
                      }}
                    >
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center overflow-hidden shrink-0 border border-zinc-700"
                        style={{ backgroundColor: "#27272a" }}
                      >
                        {barber.avatarUrl ? (
                          <img src={barber.avatarUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Scissors className="w-5 h-5 text-zinc-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium text-sm">{barber.user.name}</p>
                        {barber.bio && (
                          <p className="text-zinc-500 text-xs mt-0.5 truncate">{barber.bio}</p>
                        )}
                      </div>
                      {selected && (
                        <CheckCircle className="w-5 h-5 shrink-0 text-amber-400" />
                      )}
                    </button>
                  )
                })}
          </div>
        )}

        {/* Step 2 — Data e Hora */}
        {step === 2 && (
          <div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 mb-5 overflow-hidden">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => {
                  setSelectedDate(date)
                  setSelectedSlot(null)
                }}
                locale={ptBR}
                disabled={(date) => date < new Date() || date > addDays(new Date(), 60)}
                className="mx-auto"
              />
            </div>
            {selectedDate && (
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-4">
                  {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </p>
                {loading ? (
                  <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <Skeleton key={i} className="h-11 rounded-lg bg-zinc-800/50" />
                    ))}
                  </div>
                ) : slots.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-zinc-500 text-sm">Nenhum horário disponível nesta data</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    {slots.map((slot) => {
                      const selected = selectedSlot?.startAt === slot.startAt
                      return (
                        <button
                          key={slot.startAt}
                          onClick={() => setSelectedSlot(slot)}
                          className="py-2.5 rounded-lg text-sm font-medium border-2 transition-all duration-150"
                          style={{
                            borderColor: selected ? "#f59e0b" : "#3f3f46",
                            backgroundColor: selected ? "#f59e0b" : "#18181b",
                            color: selected ? "#000" : "#d4d4d8",
                          }}
                        >
                          {format(new Date(slot.startAt), "HH:mm")}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 3 — Dados do cliente */}
        {step === 3 && (
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                Seu nome
              </label>
              <input
                placeholder="João Silva"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">
                WhatsApp (com DDD)
              </label>
              <input
                placeholder="11999999999"
                type="tel"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value.replace(/\D/g, ""))}
                maxLength={11}
                className="w-full bg-zinc-900 border border-zinc-800 text-white placeholder:text-zinc-600 rounded-xl px-4 py-3.5 text-sm outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all"
              />
              <p className="text-zinc-600 text-xs mt-2">
                Você receberá a confirmação no WhatsApp.
              </p>
            </div>
          </div>
        )}

        {/* Step 4 — Confirmar */}
        {step === 4 && selectedSlot && (
          <div className="space-y-4">
            <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800">
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
                  Resumo do agendamento
                </p>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Serviços</span>
                    <span className="text-white font-medium text-right max-w-[60%]">
                      {selectedServices.map((s) => s.name).join(", ")}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Barbeiro</span>
                    <span className="text-white font-medium">{selectedBarber?.user.name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Data e hora</span>
                    <span className="text-white font-medium">
                      {format(new Date(selectedSlot.startAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Duração</span>
                    <span className="text-white font-medium">{totalDuration} min</span>
                  </div>
                </div>
              </div>
              <div className="px-5 py-4 flex justify-between items-center">
                <span className="text-zinc-400 text-sm">Total</span>
                <span
                  className="font-bold text-xl"
                  style={{
                    fontFamily: "var(--font-cormorant)",
                    color: "#f59e0b",
                  }}
                >
                  R$ {totalPrice.toFixed(2).replace(".", ",")}
                </span>
              </div>
            </div>

            <div className="bg-zinc-900 rounded-xl border border-zinc-800 px-5 py-4">
              <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-3">
                Seus dados
              </p>
              <p className="text-white font-medium text-sm">{guestName}</p>
              <p className="text-zinc-500 text-sm">📱 {guestPhone}</p>
            </div>
          </div>
        )}

        {/* Carrossel de banners — aparece em todos os steps exceto etapa 3 (Data e Hora, index 2) */}
        {banners.length > 0 && step !== 2 && (
          <div className="mt-6">
            <BannerCarousel banners={banners} />
          </div>
        )}
      </div>

      {/* Fixed navigation */}
      <div className="fixed bottom-0 inset-x-0 bg-zinc-950/95 backdrop-blur-sm border-t border-zinc-800/60 p-4">
        <div className="max-w-lg mx-auto flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 text-sm font-medium transition-all"
            >
              <ChevronLeft className="w-4 h-4" /> Voltar
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: canAdvance ? "#f59e0b" : "#27272a",
                color: canAdvance ? "#000" : "#52525b",
              }}
              disabled={!canAdvance}
              onClick={() => setStep((s) => s + 1)}
            >
              Continuar <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#f59e0b", color: "#000" }}
              disabled={submitting}
              onClick={handleConfirm}
            >
              {submitting ? "Agendando..." : "Confirmar agendamento →"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
