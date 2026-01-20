/*
  Warnings:

  - You are about to drop the column `level` on the `Assessment` table. All the data in the column will be lost.
  - You are about to drop the column `score` on the `Assessment` table. All the data in the column will be lost.
  - You are about to drop the column `correct` on the `AssessmentItem` table. All the data in the column will be lost.
  - Added the required column `totalQuestions` to the `Assessment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `correctAnswer` to the `AssessmentItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `options` to the `AssessmentItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `skillTag` to the `AssessmentItem` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Assessment" DROP COLUMN "level",
DROP COLUMN "score",
ADD COLUMN     "finalLevel" TEXT,
ADD COLUMN     "finalScore" DOUBLE PRECISION,
ADD COLUMN     "totalQuestions" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "AssessmentItem" DROP COLUMN "correct",
ADD COLUMN     "correctAnswer" TEXT NOT NULL,
ADD COLUMN     "isCorrect" BOOLEAN,
ADD COLUMN     "options" JSONB NOT NULL,
ADD COLUMN     "skillTag" TEXT NOT NULL,
ADD COLUMN     "userAnswer" TEXT;
