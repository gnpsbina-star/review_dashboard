-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('SCHOOL', 'COACHING', 'CLINIC', 'SALON', 'GYM', 'RESTAURANT', 'RETAIL', 'OTHER');

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "qrHeadline" TEXT,
ADD COLUMN     "qrHeadlineHi" TEXT,
ADD COLUMN     "type" "BusinessType";

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "removedAt" TIMESTAMP(3);


-- Suggestions are now written for each business type. Mark every branch's pool
-- as out of date: the customer page serves fresh type-aware wording at once,
-- and the scheduled refresh rewrites the AI pools.
UPDATE "Branch" SET "aiSettingsUpdatedAt" = CURRENT_TIMESTAMP;
