
import fs from "node:fs";
import { parse } from "csv-parse/sync";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const csvPath = "data/imports/students.csv";
const shouldImport = process.argv.includes("--import");

type StudentCSV = {
  "First Name": string;
  "Last Name": string;
  "NSHE #": string;
  "Rebel Mail": string;
};

type Student = {
  name: string;
  nsheId: string;
  email: string | null;
};


async function main() {
  const file = fs.readFileSync(csvPath, "utf8");

  const rows = parse(file, {
    columns: (headers: string[]) =>
        headers.map((header) => header.trim() || false),
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_column_count_more: true,
  }) as StudentCSV[];

  const validStudents: Student[] = [];
  let invalidCount = 0;

  let duplicateCount = 0;

  const seenNsheIds = new Set<string>();
  const seenEmails = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const firstName = (row["First Name"] ?? "").trim();
    const lastName = (row["Last Name"] ?? "").trim();
    const name = `${firstName} ${lastName}`;
    const nsheId = (row["NSHE #"] ?? "").trim();
    const email = row["Rebel Mail"]?.trim().toLowerCase() || null;

    if (
      !firstName ||
      !lastName ||
      !nsheId ||
      (email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    ) {
      console.log(`Invalid student at CSV row ${index + 2}`);
      invalidCount++;
      continue;
    }

    if (seenNsheIds.has(nsheId) || (email !== null && seenEmails.has(email))) {
    console.log(`Duplicate student at CSV row ${index + 2}`);
    duplicateCount++;
    continue;
    }

    seenNsheIds.add(nsheId);
    
    if (email !== null){
        seenEmails.add(email);
    }

    validStudents.push({ name, nsheId, email });
  }

const newStudents: Student[] = [];
let existingCount = 0;

for (const student of validStudents) {
  const existing = await prisma.student.findFirst({
    where: {
      OR: [
        { nsheId: student.nsheId },
      ...(student.email !== null
        ? [{ email: student.email }]
        : []),
      ],
    },
  });

  if (existing) {
    existingCount++;
    continue;
  }

  newStudents.push(student);
}

  console.log("\nCSV validation summary:");
  console.log(`Total rows: ${rows.length}`);
  console.log(`Valid students: ${validStudents.length}`);
  console.log(`Invalid students: ${invalidCount}`);
  console.log(`Duplicate students: ${duplicateCount}`);

  console.log("\nDatabase check summary:");
  console.log(`Existing students: ${existingCount}`);
  console.log(`New students ready to import: ${newStudents.length}`);

  //console.log("Preview complete. No database changes made.");
  if (!shouldImport) {
  console.log("Preview complete. No database changes made.");
  return;
}

const result = await prisma.student.createMany({
  data: newStudents,
  skipDuplicates: true,
});

console.log("\nImport summary:");
console.log(`Students imported: ${result.count}`);
console.log(
  `Additional duplicates skipped: ${newStudents.length - result.count}`
);

}

//main();

main()
  .catch((error) => {
  console.error("Student import failed.");
  console.error("Error type:", error.name);
  console.error("Error code:", error.code ?? "Unknown");
  process.exitCode = 1;
})
  .finally(async () => {
    await prisma.$disconnect();
  });
