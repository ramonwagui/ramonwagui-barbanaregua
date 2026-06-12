-- AlterTable
ALTER TABLE "GlobalConfig"
  ADD COLUMN "planPriceBasic"   INTEGER NOT NULL DEFAULT 9900,
  ADD COLUMN "planPricePro"     INTEGER NOT NULL DEFAULT 19900,
  ADD COLUMN "planPricePremium" INTEGER NOT NULL DEFAULT 39900,
  ADD COLUMN "stripePriceBasic"    TEXT,
  ADD COLUMN "stripePricePro"      TEXT,
  ADD COLUMN "stripePricePremium"  TEXT;
