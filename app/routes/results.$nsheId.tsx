import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import type { ReactNode } from "react";

import { prisma } from "~/db.server";

export type CategoryIconType =
  | "printing"
  | "laser"
  | "welding"
  | "lathe"
  | "machining"
  | "woodworking"
  | "electronics"
  | "textiles"
  | "tools";

const CATEGORY_ICON_RULES: readonly [RegExp, CategoryIconType][] = [
  [/\b(3d|additive|filament|resin|sla|fdm|printing?|printers?)\b/i, "printing"],
  [/\b(laser|engravers?|engraving|etching|photonics?)\b/i, "laser"],
  [
    /\b(weld(?:ing|ers?)?|solder(?:ing)?|brazing|fabrication|hot work)\b/i,
    "welding",
  ],
  [/\b(lathes?|turning|turnery)\b/i, "lathe"],
  [
    /\b(cnc|mills?|milling|machines?|machining|routers?|routing|metalwork(?:ing)?|metal shop)\b/i,
    "machining",
  ],
  [/\b(wood(?:work|working|shop)?|carpentry|saws?)\b/i, "woodworking"],
  [
    /\b(electronics?|electrical|circuits?|pcb|microcontrollers?|robotics?)\b/i,
    "electronics",
  ],
  [/\b(textiles?|sewing|fabric|embroidery|apparel)\b/i, "textiles"],
];

export function getCategoryIconType(categoryName: string): CategoryIconType {
  return (
    CATEGORY_ICON_RULES.find(([pattern]) => pattern.test(categoryName))?.[1] ??
    "tools"
  );
}

function IconFrame({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function CategoryIcon({ categoryName }: { categoryName: string }) {
  switch (getCategoryIconType(categoryName)) {
    case "printing":
      return (
        <IconFrame>
          <path d="m12 3 8.5 4.7v8.6L12 21l-8.5-4.7V7.7L12 3Z" />
          <path d="m3.8 7.9 8.2 4.6 8.2-4.6M12 12.5V21" />
        </IconFrame>
      );
    case "laser":
      return (
        <IconFrame>
          <path d="M4 10V4h6M14 20h6v-6M7 17 17 7" />
          <path d="M16 3v2M21 8h-2M19.5 4.5l-1.4 1.4" />
        </IconFrame>
      );
    case "welding":
      return (
        <IconFrame>
          <path d="M12 22c4.1 0 7-3 7-7 0-3.2-2.2-5.4-4.2-7.2-.2 2.6-1.6 4.5-3.5 5.2.5-3.8-1.8-6.8-3.1-8C7.9 9.1 5 11.3 5 15c0 4 2.9 7 7 7Z" />
          <path d="M9.5 19c0-1.8 1.1-3.1 2.7-4.5.1 1.8 2.3 2.7 2.3 4.5" />
        </IconFrame>
      );
    case "lathe":
      return (
        <IconFrame>
          <path d="M3 8h4l2-2h6l2 2h4v8h-4l-2 2H9l-2-2H3V8Z" />
          <circle cx="7" cy="12" r="2" />
          <circle cx="17" cy="12" r="2" />
          <path d="M9 12h6" />
        </IconFrame>
      );
    case "machining":
      return (
        <IconFrame>
          <path d="M5 3h14v5H5zM8 8v4h8V8M12 12v4" />
          <path d="M9 16h6l2 5H7l2-5Z" />
        </IconFrame>
      );
    case "woodworking":
      return (
        <IconFrame>
          <path d="m4 20 10.5-10.5 3 3L7 23M13 5l2-2 6 6-2 2" />
          <path d="m4 14 3 3M7 11l3 3" />
        </IconFrame>
      );
    case "electronics":
      return (
        <IconFrame>
          <rect x="6" y="6" width="12" height="12" rx="2" />
          <path d="M9 9h6v6H9zM9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />
        </IconFrame>
      );
    case "textiles":
      return (
        <IconFrame>
          <circle cx="6" cy="7" r="3" />
          <circle cx="6" cy="17" r="3" />
          <path d="m8.5 8.5 12 7.5M8.5 15.5 20.5 8M12 12l-3.5 3.5" />
        </IconFrame>
      );
    default:
      return (
        <IconFrame>
          <path d="M14.7 6.3a4 4 0 0 0-5-5L12 3.6 8.4 7.2 6.1 4.9a4 4 0 0 0 5 5L4 17l3 3 7.1-7.1a4 4 0 0 0 5-5L16.8 10 14.7 7.9l2.2-2.2" />
        </IconFrame>
      );
  }
}

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
    prisma.certification.findMany({ orderBy: { name: "asc" } }),
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
                    <span className="shrink-0 text-[#d01818]">
                      <CategoryIcon categoryName={category.name} />
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
