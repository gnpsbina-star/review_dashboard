-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "bloodGroup" TEXT,
ADD COLUMN     "designation" TEXT,
ADD COLUMN     "emergencyContactEnc" TEXT,
ADD COLUMN     "employeeCode" TEXT,
ADD COLUMN     "photoConsentAt" TIMESTAMP(3),
ADD COLUMN     "photoKey" TEXT,
ADD COLUMN     "photoStorage" TEXT,
ADD COLUMN     "photoVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "validUntil" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Staff_photoKey_key" ON "Staff"("photoKey");

-- CreateIndex
CREATE UNIQUE INDEX "Staff_organizationId_employeeCode_key" ON "Staff"("organizationId", "employeeCode");

