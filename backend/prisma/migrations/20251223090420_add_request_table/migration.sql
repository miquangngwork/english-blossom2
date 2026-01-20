-- CreateTable
CREATE TABLE "Request" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "level" TEXT,
    "timeslot" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);
