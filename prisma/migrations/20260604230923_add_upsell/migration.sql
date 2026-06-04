-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "isUpsellSuggestion" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "upsellEnabled" BOOLEAN NOT NULL DEFAULT false;
