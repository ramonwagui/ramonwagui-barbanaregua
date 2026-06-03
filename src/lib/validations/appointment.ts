import { z } from "zod"

export const createAppointmentSchema = z.object({
  barberId: z.string().min(1, "Barbeiro inválido"),
  serviceIds: z.array(z.string().min(1)).min(1, "Selecione pelo menos um serviço"),
  scheduledAt: z.coerce.date(),
  guestName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  guestPhone: z
    .string()
    .min(10, "Telefone inválido")
    .regex(/^\d+$/, "Telefone deve conter apenas números"),
  guestEmail: z.string().email("Email inválido").optional().or(z.literal("")),
  notes: z.string().max(500).optional(),
})

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>

/**
 * Quando a barbearia exige sinal, o e-mail do cliente passa a ser
 * obrigatório (o Mercado Pago exige e-mail do pagador no PIX).
 */
export const depositEmailSchema = z
  .string()
  .min(1, "E-mail é obrigatório para pagar o sinal")
  .email("Email inválido")
