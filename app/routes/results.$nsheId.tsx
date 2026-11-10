import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

import { prisma } from "~/db.server";

const CATEGORY_ICONS: Record<string, string> = {
  "3D Printing": "▲",
  "CNC Machining": "⬡",
  "CNC Routing": "⬡",
  "CNC Milling": "⬡",
  "Metal Lathe": "◎",
  "Laser Cutting": "◈",
  Welding: "⟡",
};

export const meta: MetaFunction<typeof loader> = ({ data }) => [
  {
    title:
      data && !("error" in data)
        ? `${data.student.name} | Makerspace Access`
        : "Makerspace Access Results",
  },
];

export async function loader({ params }: LoaderFunctionArgs) {
  const { nsheId } = params;
  if (!nsheId) {
    return { error: "Missing NSHE ID" };
  }

  const student = await prisma.student.findUnique({
    where: { nsheId },
    include: {
      certifications: {
        include: { certification: true },
        orderBy: { completedAt: "desc" },
      },
    },
  });

  if (!student) {
    return { error: "NSHE Id not found linked to a student" };
  }

  const [machines, certificationCatalog] = await Promise.all([
    prisma.machine.findMany({
      where: { isActive: true },
      include: {
        category: true,
        requirements: { include: { certification: true } },
      },
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
    }),
    prisma.certification?.findMany({ orderBy: { name: "asc" } }),
  ]);

  const derivedCertifications = [
    ...student.certifications.map(({ certification }) => certification),
    ...machines.flatMap((machine) =>
      machine.requirements.map(({ certification }) => certification),
    ),
  ];
  const allCertifications =
    certificationCatalog && certificationCatalog.length > 0
      ? certificationCatalog
      : Array.from(
          new Map(
            derivedCertifications.map((certification) => [
              certification.id,
              certification,
            ]),
          ).values(),
        ).sort((a, b) => a.name.localeCompare(b.name));
  const studentCertificationNames = new Set(
    student.certifications.map(({ certification }) => certification.name),
  );
  const useAbleMachines = machines.filter((machine) =>
    machine.requirements.every(({ certification }) =>
      studentCertificationNames.has(certification.name),
    ),
  );

  return { student, machines, allCertifications, useAbleMachines };
}

function formatCompletionDate(date: string | Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(date));
}

export default function Results() {
  const loaderData = useLoaderData<typeof loader>();

  if ("error" in loaderData) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#111] px-6 text-white">
        <section className="w-full max-w-md overflow-hidden rounded-sm border border-[#2a2a2a] bg-[#1c1c1c] text-center">
          <div className="h-1 bg-[#b10202]" />
          <div className="p-8">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#b10202]">
              Unable to load access record
            </p>
            <h1 className="mb-6 text-2xl font-bold">{loaderData.error}</h1>
            <Link
              to="/"
              className="inline-flex rounded-sm bg-[#b10202] px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white transition-colors hover:bg-[#d01818] focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#1c1c1c]"
            >
              Scan another card
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const { student, machines, allCertifications } = loaderData;
  const studentCertificationIds = new Set(
    student.certifications.map(({ certificationId }) => certificationId),
  );
  const hasAccess = (machine: (typeof machines)[number]) =>
    machine.requirements.every(({ certificationId }) =>
      studentCertificationIds.has(certificationId),
    );
  const totalAccessible = machines.filter(hasAccess).length;
  const machinesByCategory = machines.reduce(
    (categories, machine) => {
      const existingCategory = categories.find(
        ({ id }) => id === machine.category.id,
      );
      if (existingCategory) {
        existingCategory.machines.push(machine);
      } else {
        categories.push({
          id: machine.category.id,
          name: machine.category.name,
          machines: [machine],
        });
      }
      return categories;
    },
    [] as {
      id: string;
      name: string;
      machines: typeof machines;
    }[],
  );

  return (
    <div className="min-h-screen bg-[#111] text-white">
      <header className="bg-[#b10202] px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <Link
            to="/"
            aria-label="Makerspace access system home"
            className="flex items-center gap-3 rounded-sm focus:outline-none focus:ring-2 focus:ring-white"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-black tracking-wide text-[#b10202]">
              UNLV
            </span>
            <span>
              <span className="hidden text-xs uppercase tracking-[0.16em] text-white/70 sm:block">
                University of Nevada, Las Vegas
              </span>
              <span className="block text-sm font-semibold tracking-[0.08em] text-white">
                MAKERSPACE ACCESS SYSTEM
              </span>
            </span>
          </Link>
          <nav
            className="ml-auto flex items-center gap-4 sm:gap-6"
            aria-label="Page navigation"
          >
            <Link
              to="/admin"
              className="hidden text-xs font-semibold uppercase tracking-[0.14em] text-white/65 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-white sm:inline"
            >
              Admin →
            </Link>
            <Link
              to="/"
              className="text-xs font-semibold uppercase tracking-[0.14em] text-white/85 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
            >
              ← New scan
            </Link>
          </nav>
        </div>
      </header>

      <section className="border-b border-[#2a2a2a] bg-[#1c1c1c]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-7 sm:flex-row sm:items-center sm:px-8">
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#777]">
              Authenticated student
            </p>
            <h1 className="truncate text-3xl font-bold tracking-wide text-white sm:text-4xl">
              {student.name}
            </h1>
            <p className="mt-1 break-words font-mono text-xs text-[#777] sm:text-sm">
              NSHE {student.nsheId} <span aria-hidden="true">·</span>{" "}
              {student.email}
            </p>
          </div>
          <dl className="flex gap-8 sm:gap-10">
            <div>
              <dd className="text-4xl font-bold leading-none text-[#d01818]">
                {totalAccessible}
              </dd>
              <dt className="mt-2 max-w-24 text-xs font-semibold uppercase leading-tight tracking-[0.14em] text-[#777]">
                Machines accessible
              </dt>
            </div>
            <div>
              <dd className="text-4xl font-bold leading-none text-white">
                {student.certifications.length}
              </dd>
              <dt className="mt-2 max-w-24 text-xs font-semibold uppercase leading-tight tracking-[0.14em] text-[#777]">
                Certifications
              </dt>
            </div>
          </dl>
        </div>
      </section>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-3">
        <section
          className="lg:col-span-1"
          aria-labelledby="certifications-heading"
        >
          <div className="overflow-hidden rounded-sm border border-[#2a2a2a] bg-[#1c1c1c]">
            <div className="h-1 bg-[#b10202]" />
            <div className="px-5 py-5 sm:px-6">
              <h2
                id="certifications-heading"
                className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-[#999]"
              >
                Training & certifications
              </h2>
              <ul>
                {allCertifications.map((certification) => {
                  const studentCertification = student.certifications.find(
                    ({ certificationId }) =>
                      certificationId === certification.id,
                  );
                  const earned = Boolean(studentCertification);
                  return (
                    <li
                      key={certification.id}
                      className="flex items-start gap-3 border-b border-[#292929] py-3 last:border-0"
                    >
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                          earned
                            ? "bg-[#b10202] text-white"
                            : "border border-[#3a3a3a] bg-[#191919] text-[#555]"
                        }`}
                      >
                        {earned ? "✓" : ""}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-sm leading-snug ${earned ? "text-[#f5f5f5]" : "text-[#666]"}`}
                        >
                          {certification.name}
                        </span>
                        {studentCertification ? (
                          <span className="mt-1 block font-mono text-[11px] uppercase text-[#d01818]">
                            Completed{" "}
                            {formatCompletionDate(
                              studentCertification.completedAt,
                            )}
                          </span>
                        ) : (
                          <span className="sr-only">Not completed</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>

        <section
          className="space-y-5 lg:col-span-2"
          aria-labelledby="machines-heading"
        >
          <h2
            id="machines-heading"
            className="text-sm font-semibold uppercase tracking-[0.16em] text-[#999]"
          >
            Machine access by category
          </h2>
          {machinesByCategory.length === 0 ? (
            <div className="rounded-sm border border-[#2a2a2a] bg-[#1c1c1c] p-6 text-sm text-[#888]">
              No active machines are currently listed.
            </div>
          ) : (
            machinesByCategory.map((category) => {
              const accessibleCount =
                category.machines.filter(hasAccess).length;
              return (
                <article
                  key={category.id}
                  className="overflow-hidden rounded-sm border border-[#2a2a2a] bg-[#1c1c1c]"
                >
                  <header className="flex items-center gap-3 border-b border-[#292929] px-5 py-4 sm:px-6">
                    <span aria-hidden="true" className="text-lg text-[#d01818]">
                      {CATEGORY_ICONS[category.name] ?? "◆"}
                    </span>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-white">
                      {category.name}
                    </h3>
                    <span className="ml-auto text-right text-xs text-[#777]">
                      {accessibleCount}/{category.machines.length}{" "}
                      <span className="hidden sm:inline">accessible</span>
                    </span>
                  </header>
                  <ul className="divide-y divide-[#292929]">
                    {category.machines.map((machine) => {
                      const access = hasAccess(machine);
                      const missingRequirements = machine.requirements.filter(
                        ({ certificationId }) =>
                          !studentCertificationIds.has(certificationId),
                      );
                      return (
                        <li
                          key={machine.id}
                          className="flex items-start gap-4 px-5 py-4 sm:px-6"
                        >
                          <span
                            aria-hidden="true"
                            className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${access ? "bg-green-500" : "bg-[#4a4a4a]"}`}
                          />
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block text-sm font-medium ${access ? "text-[#f5f5f5]" : "text-[#777]"}`}
                            >
                              {machine.name}
                            </span>
                            {!access && missingRequirements.length > 0 ? (
                              <span className="mt-1 block text-xs leading-relaxed text-[#666]">
                                Requires:{" "}
                                {missingRequirements
                                  .map(
                                    ({ certification }) => certification.name,
                                  )
                                  .join(", ")}
                              </span>
                            ) : null}
                          </span>
                          <span
                            className={`shrink-0 rounded-sm border px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${
                              access
                                ? "border-green-900 bg-green-950/60 text-green-400"
                                : "border-[#333] bg-[#191919] text-[#666]"
                            }`}
                          >
                            {access ? "Authorized" : "Locked"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </article>
              );
            })
          )}
        </section>
      </main>
    </div>
  );
}
