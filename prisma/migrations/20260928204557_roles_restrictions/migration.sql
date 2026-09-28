-- AlterTable
ALTER TABLE "User" ADD COLUMN     "roles" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "StudentRestriction" (
    "id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "studentId" TEXT NOT NULL,
    "createdById" TEXT,
    "revokedById" TEXT,

    CONSTRAINT "StudentRestriction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudentRestriction_studentId_revokedAt_expiresAt_idx" ON "StudentRestriction"("studentId", "revokedAt", "expiresAt");

-- AddForeignKey
ALTER TABLE "StudentRestriction" ADD CONSTRAINT "StudentRestriction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRestriction" ADD CONSTRAINT "StudentRestriction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRestriction" ADD CONSTRAINT "StudentRestriction_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
