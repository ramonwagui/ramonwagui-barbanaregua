import CircuitBreaker from "opossum"

const DEFAULT_OPTIONS: CircuitBreaker.Options = {
  timeout: 5000,                  // 5s timeout por chamada
  errorThresholdPercentage: 50,   // abre após 50% de falhas
  resetTimeout: 30000,            // tenta fechar após 30s
  volumeThreshold: 5,             // mínimo 5 chamadas antes de avaliar
}

/** Circuit breaker para WhatsApp Cloud API */
export const whatsAppCloudBreaker = new CircuitBreaker(
  async (fn: () => Promise<unknown>) => fn(),
  { ...DEFAULT_OPTIONS, name: "whatsapp-cloud-api" }
)

/** Circuit breaker para Z-API (fallback) */
export const zapiBreaker = new CircuitBreaker(
  async (fn: () => Promise<unknown>) => fn(),
  { ...DEFAULT_OPTIONS, name: "z-api", resetTimeout: 60000 }
)

whatsAppCloudBreaker.on("open", () =>
  console.warn("[circuit-breaker] WhatsApp Cloud API: ABERTO (fallback ativo)")
)
whatsAppCloudBreaker.on("halfOpen", () =>
  console.info("[circuit-breaker] WhatsApp Cloud API: SEMI-ABERTO (testando)")
)
whatsAppCloudBreaker.on("close", () =>
  console.info("[circuit-breaker] WhatsApp Cloud API: FECHADO (normal)")
)

zapiBreaker.on("open", () =>
  console.warn("[circuit-breaker] Z-API: ABERTO (notificações perdidas)")
)
