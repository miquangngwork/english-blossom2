-- Add missing createdAt column for UserVocab
ALTER TABLE "UserVocab"
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
