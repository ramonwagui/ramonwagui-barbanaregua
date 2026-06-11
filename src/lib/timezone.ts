/**
 * Formatação e janelas de dia no fuso do SALÃO (tenant.timezone).
 *
 * Em produção o servidor roda em UTC; usar `new Date()`/date-fns direto mostra
 * o horário errado (ex.: 10:30 BRT vira 13:30). Aqui tudo passa pelo fuso do
 * salão via Intl. (Brasil não tem mais horário de verão, então o offset é
 * estável, mas o cálculo é genérico para qualquer timezone.)
 */

export const DEFAULT_TZ = "America/Sao_Paulo"

function tz(timezone?: string | null): string {
  return timezone || DEFAULT_TZ
}

// ── Exibição ────────────────────────────────────────────────

/** HH:mm */
export function fmtTime(date: Date, timezone?: string | null): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz(timezone),
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date)
}

/** dd/MM/yyyy */
export function fmtDate(date: Date, timezone?: string | null): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz(timezone),
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

/** dd/MM */
export function fmtDayMonth(date: Date, timezone?: string | null): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz(timezone),
    day: "2-digit",
    month: "2-digit",
  }).format(date)
}

/** dd/MM HH:mm */
export function fmtDayMonthTime(date: Date, timezone?: string | null): string {
  return `${fmtDayMonth(date, timezone)} ${fmtTime(date, timezone)}`
}

/** dd/MM/yyyy às HH:mm */
export function fmtDateTime(date: Date, timezone?: string | null): string {
  return `${fmtDate(date, timezone)} às ${fmtTime(date, timezone)}`
}

/** Ex.: "sexta-feira, 12 de junho de 2026" */
export function fmtWeekdayLong(date: Date, timezone?: string | null): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz(timezone),
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date)
}

/** Ex.: "sexta-feira, 12/06" */
export function fmtWeekdayShort(date: Date, timezone?: string | null): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz(timezone),
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  }).format(date)
}

/** Ex.: "junho de 2026" */
export function fmtMonthYear(date: Date, timezone?: string | null): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: tz(timezone),
    month: "long",
    year: "numeric",
  }).format(date)
}

/** Ex.: "junho" */
export function fmtMonth(date: Date, timezone?: string | null): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: tz(timezone), month: "long" }).format(date)
}

// ── Lógica de dias/janelas no fuso ──────────────────────────

/** Chave de dia local "YYYY-MM-DD" (para agrupar/comparar por dia no fuso). */
export function dayKey(date: Date, timezone?: string | null): string {
  // en-CA → formato YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

/** Offset do fuso (em minutos) no instante dado: asLocalUTC - date. */
function offsetMinutes(date: Date, timezone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const p = Object.fromEntries(dtf.formatToParts(date).map((x) => [x.type, x.value]))
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
  return (asUTC - date.getTime()) / 60000
}

/** Instante UTC da meia-noite local (00:00 do dia que contém `date`) no fuso. */
export function startOfDayInTz(date: Date, timezone?: string | null): Date {
  const z = tz(timezone)
  const [y, m, d] = dayKey(date, z).split("-").map(Number)
  const noonGuess = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const off = offsetMinutes(noonGuess, z)
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0) - off * 60000)
}

/** Início do dia seguinte (exclusivo) — use como `lt` em consultas. */
export function startOfNextDayInTz(date: Date, timezone?: string | null): Date {
  return new Date(startOfDayInTz(date, timezone).getTime() + 24 * 60 * 60 * 1000)
}

/** Instante UTC do 1º dia do mês (00:00 local) no fuso. */
export function startOfMonthInTz(date: Date, timezone?: string | null): Date {
  const z = tz(timezone)
  const [y, m] = dayKey(date, z).split("-").map(Number)
  const noonGuess = new Date(Date.UTC(y, m - 1, 1, 12, 0, 0))
  const off = offsetMinutes(noonGuess, z)
  return new Date(Date.UTC(y, m - 1, 1, 0, 0, 0) - off * 60000)
}

/** Soma `n` dias preservando o horário do instante (para iterar dias). */
export function addDays(date: Date, n: number): Date {
  return new Date(date.getTime() + n * 24 * 60 * 60 * 1000)
}
