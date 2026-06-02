import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

/**
 * Rate limiting distribuído via Upstash Redis (confiável em serverless).
 *
 * Se UPSTASH_REDIS_REST_URL / _TOKEN não estiverem configurados (ex.: dev
 * local), o rate limit é desativado e todas as requisições passam — assim
 * o build e o ambiente de desenvolvimento não quebram.
 */

const hasRedis =
  !!process.env.UPSTASH_REDIS_REST_URL &&
  !!process.env.UPSTASH_REDIS_REST_TOKEN

const redis = hasRedis ? Redis.fromEnv() : null

function makeLimiter(tokens: number, window: Parameters<typeof Ratelimit.slidingWindow>[1]) {
  if (!redis) return null
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    analytics: true,
    prefix: "barbanaregua",
  })
}

const limiters = {
  // Criação de agendamento: mais restritivo (escrita pública)
  book: makeLimiter(8, "1 m"),
  // Consulta de disponibilidade: leitura, limite mais folgado
  availability: makeLimiter(40, "1 m"),
  // Cadastro de novos tenants: bem restritivo
  register: makeLimiter(5, "10 m"),
} as const

export type RateLimitName = keyof typeof limiters

/** Extrai o IP do cliente a partir dos headers (Vercel/proxies). */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0].trim()
  return req.headers.get("x-real-ip") ?? "unknown"
}

/**
 * Verifica o rate limit para um identificador (geralmente o IP).
 * Retorna { success: true } se o limite não estiver configurado.
 */
export async function checkRateLimit(
  name: RateLimitName,
  identifier: string
): Promise<{ success: boolean }> {
  const limiter = limiters[name]
  if (!limiter) return { success: true }
  const { success } = await limiter.limit(`${name}:${identifier}`)
  return { success }
}
