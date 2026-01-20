import prisma from "./prisma";

let ensured = false;

export async function ensureDbShape() {
    if (ensured) return;
    ensured = true;

    // Idempotent drift-fixes for environments where migrations are not applied.
    try {
        await prisma.$executeRawUnsafe(
            'ALTER TABLE "UserVocab" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;'
        );
    } catch (e) {
        // Permissions may block DDL on some managed DBs; ignore but log.
        console.error("ensureDbShape: userVocab createdAt add failed", e);
    }

    try {
        await prisma.$executeRawUnsafe(
            'ALTER TABLE "VocabWord" ADD COLUMN IF NOT EXISTS "example" TEXT;'
        );
    } catch (e) {
        console.error("ensureDbShape: vocabWord example add failed", e);
    }

    try {
        await prisma.$executeRawUnsafe(
            'ALTER TABLE "HardWord" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;'
        );
    } catch (e) {
        console.error("ensureDbShape: hardWord createdAt add failed", e);
    }
}
