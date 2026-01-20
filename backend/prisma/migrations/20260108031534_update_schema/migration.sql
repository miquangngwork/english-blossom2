-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "interests" TEXT[],
ADD COLUMN     "occupation" TEXT;

-- AlterTable
ALTER TABLE "UserVocab" ADD COLUMN     "batchId" TEXT,
ALTER COLUMN "status" SET DEFAULT 'new';
