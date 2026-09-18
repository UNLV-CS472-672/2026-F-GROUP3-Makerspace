/*
  Warnings:

  - You are about to drop the `Class` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StudentClass` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Class" DROP CONSTRAINT "Class_awardsCertificationId_fkey";

-- DropForeignKey
ALTER TABLE "StudentClass" DROP CONSTRAINT "StudentClass_awardedById_fkey";

-- DropForeignKey
ALTER TABLE "StudentClass" DROP CONSTRAINT "StudentClass_classId_fkey";

-- DropForeignKey
ALTER TABLE "StudentClass" DROP CONSTRAINT "StudentClass_studentId_fkey";

-- DropTable
DROP TABLE "Class";

-- DropTable
DROP TABLE "StudentClass";
