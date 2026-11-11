-- AlterTable
ALTER TABLE "Student" ALTER COLUMN "rebelCardId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "roles" SET DEFAULT 'staff';
