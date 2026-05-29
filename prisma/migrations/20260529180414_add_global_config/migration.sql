-- CreateTable
CREATE TABLE "GlobalConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "platformLogoUrl" TEXT,
    "platformName" TEXT NOT NULL DEFAULT 'Barbanaregua',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalConfig_pkey" PRIMARY KEY ("id")
);
