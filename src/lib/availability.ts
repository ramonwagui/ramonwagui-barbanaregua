import { prisma } from "@/lib/prisma"
import {
  addMinutes,
  startOfDay,
  endOfDay,
  setHours,
  setMinutes,
  isAfter,
  isBefore,
} from "date-fns"

export interface TimeSlot {
  startAt: Date
  endsAt: Date
}

interface SlotQuery {
  tenantId: string
  barberId: string
  date: Date
  serviceDurationMinutes: number
}

function parseTime(timeStr: string, baseDate: Date): Date {
  const [hours, minutes] = timeStr.split(":").map(Number)
  return setMinutes(setHours(new Date(baseDate), hours), minutes)
}

function generateCandidates(
  workStart: Date,
  workEnd: Date,
  intervalMinutes: number
): Date[] {
  const slots: Date[] = []
  let current = new Date(workStart)
  while (isBefore(current, workEnd)) {
    slots.push(new Date(current))
    current = addMinutes(current, intervalMinutes)
  }
  return slots
}

export async function getAvailableSlots(query: SlotQuery): Promise<TimeSlot[]> {
  const { tenantId, barberId, date, serviceDurationMinutes } = query

  const dayStart = startOfDay(date)
  const dayEnd = endOfDay(date)

  // 1. Dia fechado para o tenant?
  const closedDay = await prisma.closedDay.findUnique({
    where: { tenantId_date: { tenantId, date: dayStart } },
  })
  if (closedDay) return []

  // 2. Horário de trabalho do barbeiro nesse dia da semana
  const dayOfWeek = date.getDay()
  const schedule = await prisma.barberSchedule.findUnique({
    where: { barberId_dayOfWeek: { barberId, dayOfWeek } },
  })
  if (!schedule || !schedule.isActive) return []

  const workStart = parseTime(schedule.startTime, date)
  const workEnd = parseTime(schedule.endTime, date)

  let breakStart: Date | null = null
  let breakEnd: Date | null = null
  if (schedule.breakStart && schedule.breakEnd) {
    breakStart = parseTime(schedule.breakStart, date)
    breakEnd = parseTime(schedule.breakEnd, date)
  }

  // 3. Agendamentos existentes do barbeiro nesse dia
  const existingAppointments = await prisma.appointment.findMany({
    where: {
      barberId,
      scheduledAt: { gte: dayStart, lte: dayEnd },
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
    },
    select: { scheduledAt: true, endsAt: true },
  })

  // 4. Bloqueios manuais (férias, folgas)
  const timeBlocks = await prisma.timeBlock.findMany({
    where: {
      barberId,
      startAt: { lte: dayEnd },
      endAt: { gte: dayStart },
    },
    select: { startAt: true, endAt: true },
  })

  // 5. Gerar slots candidatos de 15 em 15 minutos
  const candidates = generateCandidates(workStart, workEnd, 15)

  // 6. Filtrar slots inválidos
  const now = new Date()
  return candidates
    .filter((slotStart) => {
      const slotEnd = addMinutes(slotStart, serviceDurationMinutes)

      // Não mostrar horários no passado
      if (isBefore(slotStart, now)) return false

      // Serviço deve terminar antes do fim do expediente
      if (isAfter(slotEnd, workEnd) || slotEnd.getTime() === workEnd.getTime()) {
        // permitir exatamente no horário de fechamento
      } else if (isAfter(slotEnd, workEnd)) {
        return false
      }

      // Não sobrepor pausa
      if (breakStart && breakEnd) {
        if (isBefore(slotStart, breakEnd) && isAfter(slotEnd, breakStart)) {
          return false
        }
      }

      // Não sobrepor agendamentos existentes
      const overlapsAppointment = existingAppointments.some(
        (appt: { scheduledAt: Date; endsAt: Date }) =>
          isBefore(slotStart, appt.endsAt) &&
          isAfter(slotEnd, appt.scheduledAt)
      )
      if (overlapsAppointment) return false

      // Não sobrepor bloqueios manuais
      const overlapsBlock = timeBlocks.some(
        (block: { startAt: Date; endAt: Date }) =>
          isBefore(slotStart, block.endAt) &&
          isAfter(slotEnd, block.startAt)
      )
      if (overlapsBlock) return false

      return true
    })
    .map((slotStart) => ({
      startAt: slotStart,
      endsAt: addMinutes(slotStart, serviceDurationMinutes),
    }))
}

/**
 * Valida, no servidor, se um horário específico é um slot de agendamento
 * válido para o barbeiro (dentro do expediente, fora da pausa, dia não
 * fechado, sem bloqueio manual e não no passado).
 *
 * Reaproveita getAvailableSlots para garantir que a validação do booking
 * use exatamente as mesmas regras exibidas ao cliente. NÃO substitui a
 * checagem de conflito com lock transacional feita no endpoint de booking.
 */
export async function isSlotAvailable(query: SlotQuery & {
  requestedStart: Date
}): Promise<boolean> {
  const { requestedStart, ...slotQuery } = query
  const slots = await getAvailableSlots(slotQuery)
  return slots.some(
    (slot) => slot.startAt.getTime() === requestedStart.getTime()
  )
}
