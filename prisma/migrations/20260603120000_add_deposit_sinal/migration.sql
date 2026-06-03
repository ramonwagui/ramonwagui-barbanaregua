-- AlterTable: Tenant — configuração de sinal (depósito) por barbearia
ALTER TABLE "Tenant"
  ADD COLUMN "requireDeposit" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "depositPercent" INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN "depositExpiryMinutes" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN "cancelRefundHours" INTEGER NOT NULL DEFAULT 24;

-- AlterTable: Appointment — dados do sinal
ALTER TABLE "Appointment"
  ADD COLUMN "depositAmount" DECIMAL(10,2),
  ADD COLUMN "paymentExpiresAt" TIMESTAMP(3);
