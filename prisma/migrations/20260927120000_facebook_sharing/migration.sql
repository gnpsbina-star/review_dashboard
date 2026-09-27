-- AlterEnum
ALTER TYPE "ReviewSource" ADD VALUE 'FACEBOOK_REDIRECT';

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "facebookReviewUrl" TEXT;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "facebookSharedAt" TIMESTAMP(3);

