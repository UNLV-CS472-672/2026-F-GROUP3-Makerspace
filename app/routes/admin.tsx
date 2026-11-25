import {
  json,
  redirect,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import {
  Form,
  Link,
  useActionData,
  useLoaderData,
  useNavigation,
} from "@remix-run/react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { prisma } from "~/db.server";
import { getUser } from "~/session.server";
import { validateEmail } from "~/utils";

// ─────────────────────────────────────────────────────────────
// Shared server helpers
// ─────────────────────────────────────────────────────────────

// NSHE IDs are always 10 digits. RebelCard barcodes are 10 digits (raw NSHE
// scan) or 14 digits (older library barcode), so cards are only required to be
// numeric and reasonably short; future card formats keep working.
const NSHE_ID_PATTERN = /^\d{10}$/;
const CARD_ID_PATTERN = /^\d{1,20}$/;
const CARD_ID_MESSAGE = "RebelCard ID must be digits only";

const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 500;

type Tab = "users" | "machines" | "certs";

type Intent =
  | "add-student"
  | "link-card"
  | "add-machine"
  | "add-cert"
  | "link-requirement"
  | "edit-student"
  | "edit-machine"
  | "edit-cert"
  | "award-cert"
  | "revoke-cert"
  | DeleteIntent;

type FormErrors = Record<string, string>;
type Text = (key: string) => string;

// Staff can add and link things. Deleting is destructive (it cascades to
// certification awards and machine requirements), so it needs an admin.
const STAFF_ROLES = ["staff", "admin", "super admin"];
const ADMIN_ROLES = ["admin", "super admin"];

async function requireRole(request: Request, allowed: string[]) {
  const user = await getUser(request);

  if (!user) {
    const url = new URL(request.url);
    throw redirect(
      `/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`,
    );
  }

  const roles = (user.roles ?? "")
    .split(",")
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);

  if (!roles.some((role) => allowed.includes(role))) {
    throw new Response("Forbidden", { status: 403 });
  }

  return { user, roles };
}

const requireStaff = (request: Request) => requireRole(request, STAFF_ROLES);
const requireAdmin = (request: Request) => requireRole(request, ADMIN_ROLES);

export async function loader({ request }: LoaderFunctionArgs) {
  // Protect the admin route:
  // 1) If the user is not authenticated -> redirect to login page (with redirectTo).
  // 2) If authenticated but not in an allowed role -> throw 403.
  // 3) Otherwise return necessary data for the admin UI.
  const { user, roles } = await requireStaff(request);

  const [students, machines, certifications, categories] = await Promise.all([
    prisma.student.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        nsheId: true,
        rebelCardId: true,
        email: true,
        certifications: {
          orderBy: { certification: { name: "asc" } },
          select: { certification: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.machine.findMany({
      orderBy: [{ category: { sortOrder: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        isActive: true,
        categoryId: true,
        category: { select: { name: true } },
        requirements: {
          select: { certification: { select: { name: true } } },
        },
      },
    }),
    prisma.certification.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        _count: { select: { students: true, requiredBy: true } },
      },
    }),
    prisma.machineCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  // At this stage the user is authenticated and authorized.
  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      roles: roles.join(", "),
    },
    // Only used to show or hide the Delete buttons; the action enforces it.
    canDelete: roles.some((role) => ADMIN_ROLES.includes(role)),
    students: students.map((s) => ({
      id: s.id,
      name: s.name,
      nshe: s.nsheId,
      // Students may have no card on file (their card scans the NSHE ID).
      rebel: s.rebelCardId ?? "",
      email: s.email,
      certs: s.certifications.length,
      // The certifications this student holds (for the edit panel).
      held: s.certifications.map((c) => ({
        id: c.certification.id,
        name: c.certification.name,
      })),
    })),
    machines: machines.map((m) => ({
      id: m.id,
      name: m.name,
      category: m.category.name,
      categoryId: m.categoryId,
      active: m.isActive,
      requires: m.requirements.map((r) => r.certification.name).sort(),
    })),
    certifications: certifications.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description ?? "",
      students: c._count.students,
      machines: c._count.requiredBy,
    })),
    categories,
  };
}

// `target` is the id of the roster row an edit-panel error belongs to, so a
// panel only ever shows errors from its own submission.
const fail = (errors: FormErrors) =>
  json({ ok: null, errors, overwrite: null, target: null }, { status: 400 });

const failFor = (target: string, errors: FormErrors) =>
  json({ ok: null, errors, overwrite: null, target }, { status: 400 });

const succeed = (ok: Intent) =>
  json({ ok, errors: {} as FormErrors, overwrite: null, target: null });

const needsOverwriteConfirmation = (name: string, currentCard: string) =>
  json(
    {
      ok: null,
      errors: {} as FormErrors,
      overwrite: { name, currentCard },
      target: null,
    },
    { status: 409 },
  );

// Prisma reports database errors with a code: P2002 is a unique-constraint
// violation (the clashing column(s) are in meta.target) and P2003 is a
// foreign-key violation (the row being pointed at does not exist).
// Thrown inside a transaction to roll it back and report a form error.
class FormRejected extends Error {
  errors: FormErrors;

  constructor(errors: FormErrors) {
    super("Form rejected");
    this.errors = errors;
  }
}

function prismaError(error: unknown) {
  if (typeof error !== "object" || error === null) return null;
  const { code, meta } = error as {
    code?: unknown;
    meta?: { target?: unknown };
  };
  if (typeof code !== "string") return null;
  return {
    code,
    fields: Array.isArray(meta?.target) ? meta.target.map(String) : [],
  };
}

function checkLength(
  errors: FormErrors,
  key: string,
  value: string,
  label: string,
  max: number,
) {
  if (value.length > max) {
    errors[key] = `${label} must be ${max} characters or fewer`;
  }
}

// The scanner treats a scan as a card number first and an NSHE ID second. That
// is only unambiguous if a card number never equals a *different* student's
// NSHE ID; otherwise scanning that student would open the wrong record.
const otherThan = (id?: string) => (id ? { NOT: { id } } : {});

async function cardMatchesOtherNshe(card: string, excludeId?: string) {
  const clash = await prisma.student.findFirst({
    where: { nsheId: card, ...otherThan(excludeId) },
    select: { id: true },
  });
  return clash !== null;
}

async function nsheMatchesOtherCard(nsheId: string, excludeId?: string) {
  const clash = await prisma.student.findFirst({
    where: { rebelCardId: nsheId, ...otherThan(excludeId) },
    select: { id: true },
  });
  return clash !== null;
}

const CARD_IS_OTHER_NSHE = "This number is another student's NSHE ID";
const NSHE_IS_OTHER_CARD =
  "This NSHE ID matches another student's RebelCard number";

async function addStudent(text: Text) {
  const name = text("fullName");
  const nsheId = text("nsheId");
  const rebelCardId = text("rebelCardId");
  const email = text("studentEmail").toLowerCase();

  const errors: FormErrors = {};
  if (!name) errors.fullName = "Name is required";
  checkLength(errors, "fullName", name, "Name", MAX_NAME_LENGTH);
  if (!NSHE_ID_PATTERN.test(nsheId))
    errors.nsheId = "NSHE ID must be 10 digits";
  // The card is optional: only check the format when one was typed.
  if (rebelCardId && !CARD_ID_PATTERN.test(rebelCardId)) {
    errors.rebelCardId = CARD_ID_MESSAGE;
  }
  if (!validateEmail(email)) errors.studentEmail = "Email is invalid";
  if (Object.keys(errors).length > 0) return fail(errors);

  if (
    rebelCardId &&
    rebelCardId !== nsheId &&
    (await cardMatchesOtherNshe(rebelCardId))
  ) {
    errors.rebelCardId = CARD_IS_OTHER_NSHE;
  }
  if (await nsheMatchesOtherCard(nsheId)) errors.nsheId = NSHE_IS_OTHER_CARD;
  if (Object.keys(errors).length > 0) return fail(errors);

  try {
    await prisma.student.create({
      // Blank becomes null, never "": an empty string would collide with the
      // next card-less student on the unique column.
      data: { name, nsheId, rebelCardId: rebelCardId || null, email },
    });
  } catch (error) {
    const info = prismaError(error);
    if (info?.code !== "P2002") throw error;

    if (info.fields.includes("nsheId")) {
      errors.nsheId = "A student with this NSHE ID already exists";
    }
    if (info.fields.includes("rebelCardId")) {
      errors.rebelCardId = "A student with this RebelCard ID already exists";
    }
    if (info.fields.includes("email")) {
      errors.studentEmail = "A student with this email already exists";
    }
    if (Object.keys(errors).length === 0) {
      errors.form = "That student already exists";
    }
    return fail(errors);
  }

  return succeed("add-student");
}

async function linkCard(text: Text) {
  const nsheId = text("linkNsheId");
  const newRebelCardId = text("newRebelCardId");
  const confirmOverwrite = text("confirmOverwrite");

  const errors: FormErrors = {};
  if (!NSHE_ID_PATTERN.test(nsheId)) {
    errors.linkNsheId = "NSHE ID must be 10 digits";
  }
  if (!CARD_ID_PATTERN.test(newRebelCardId)) {
    errors.newRebelCardId = CARD_ID_MESSAGE;
  }
  if (Object.keys(errors).length > 0) return fail(errors);

  const student = await prisma.student.findUnique({
    where: { nsheId },
    select: { id: true, name: true, rebelCardId: true },
  });
  if (!student) return fail({ linkNsheId: "No student has this NSHE ID" });

  if (student.rebelCardId === newRebelCardId) {
    return fail({ newRebelCardId: "This student already has this card" });
  }

  // A student's own NSHE ID is fine as their card number; another student's
  // is not (see cardMatchesOtherNshe).
  if (await cardMatchesOtherNshe(newRebelCardId, student.id)) {
    return fail({ newRebelCardId: CARD_IS_OTHER_NSHE });
  }

  // Never replace an existing card unless staff confirmed that exact card.
  // The confirmation is the old card number the page showed in its warning,
  // so a stale warning can never approve an overwrite for someone else.
  if (
    student.rebelCardId !== null &&
    confirmOverwrite !== student.rebelCardId
  ) {
    return needsOverwriteConfirmation(student.name, student.rebelCardId);
  }

  // Only write if the card is still exactly what we read above. If another
  // staff member changed it in the meantime, nothing matches, so their change
  // is never silently overwritten and no unconfirmed overwrite can slip in.
  let updated;
  try {
    updated = await prisma.student.updateMany({
      where: { nsheId, rebelCardId: student.rebelCardId },
      data: { rebelCardId: newRebelCardId },
    });
  } catch (error) {
    if (prismaError(error)?.code === "P2002") {
      return fail({
        newRebelCardId: "This RebelCard ID is already assigned to a student",
      });
    }
    throw error;
  }

  if (updated.count === 0) {
    return fail({
      newRebelCardId:
        "This student's card was changed by someone else just now. Nothing was saved, so check the student and try again.",
    });
  }

  return succeed("link-card");
}

async function addMachine(text: Text) {
  const name = text("machineName");
  const categoryId = text("machineCategoryId");
  const newCategoryName = text("newCategoryName");

  const errors: FormErrors = {};
  if (!name) errors.machineName = "Machine name is required";
  checkLength(errors, "machineName", name, "Name", MAX_NAME_LENGTH);
  if (!categoryId && !newCategoryName) {
    errors.machineCategoryId = "Choose a category or enter a new one";
  }
  checkLength(
    errors,
    "newCategoryName",
    newCategoryName,
    "Category name",
    MAX_NAME_LENGTH,
  );
  if (Object.keys(errors).length > 0) return fail(errors);

  // The category and the machine are created in one transaction, so a machine
  // that fails to save (for example a duplicate name) never leaves behind a
  // brand-new empty category. Throwing FormRejected rolls everything back.
  try {
    await prisma.$transaction(async (tx) => {
      let resolvedCategoryId = categoryId;

      // A typed category takes priority over the dropdown. Matching an
      // existing category ignoring case avoids near-duplicates like
      // "Laser cutting".
      if (newCategoryName) {
        const existing = await tx.machineCategory.findFirst({
          where: { name: { equals: newCategoryName, mode: "insensitive" } },
          select: { id: true },
        });

        if (existing) {
          resolvedCategoryId = existing.id;
        } else {
          const last = await tx.machineCategory.aggregate({
            _max: { sortOrder: true },
          });
          try {
            const created = await tx.machineCategory.create({
              data: {
                name: newCategoryName,
                sortOrder: (last._max.sortOrder ?? 0) + 1,
              },
              select: { id: true },
            });
            resolvedCategoryId = created.id;
          } catch (error) {
            if (prismaError(error)?.code === "P2002") {
              throw new FormRejected({
                newCategoryName: "That category already exists",
              });
            }
            throw error;
          }
        }
      }

      try {
        await tx.machine.create({
          data: { name, categoryId: resolvedCategoryId },
        });
      } catch (error) {
        const info = prismaError(error);
        if (info?.code === "P2002") {
          throw new FormRejected({
            machineName: "A machine with this name already exists",
          });
        }
        if (info?.code === "P2003") {
          throw new FormRejected({
            machineCategoryId: "That category no longer exists",
          });
        }
        throw error;
      }
    });
  } catch (error) {
    if (error instanceof FormRejected) return fail(error.errors);
    throw error;
  }

  return succeed("add-machine");
}

async function addCertification(text: Text) {
  const name = text("certName");
  const description = text("certDescription");

  const errors: FormErrors = {};
  if (!name) errors.certName = "Certification name is required";
  checkLength(errors, "certName", name, "Name", MAX_NAME_LENGTH);
  checkLength(
    errors,
    "certDescription",
    description,
    "Description",
    MAX_DESCRIPTION_LENGTH,
  );
  if (Object.keys(errors).length > 0) return fail(errors);

  try {
    await prisma.certification.create({
      data: { name, description: description || null },
    });
  } catch (error) {
    if (prismaError(error)?.code === "P2002") {
      return fail({
        certName: "A certification with this name already exists",
      });
    }
    throw error;
  }

  return succeed("add-cert");
}

async function linkRequirement(text: Text) {
  const machineId = text("requirementMachineId");
  const certificationId = text("requirementCertId");

  const errors: FormErrors = {};
  if (!machineId) errors.requirementMachineId = "Choose a machine";
  if (!certificationId) errors.requirementCertId = "Choose a certification";
  if (Object.keys(errors).length > 0) return fail(errors);

  try {
    await prisma.machineRequirement.create({
      data: { machineId, certificationId },
    });
  } catch (error) {
    const info = prismaError(error);
    if (info?.code === "P2002") {
      return fail({
        requirementCertId: "This machine already requires that certification",
      });
    }
    if (info?.code === "P2003") {
      return fail({
        requirementMachineId:
          "Choose a machine and certification from the list",
      });
    }
    throw error;
  }

  return succeed("link-requirement");
}

// Edit forms use their own field names (edit...) so an error from one form can
// never show up on another form that is on screen at the same time.
const NO_LONGER_EXISTS = "That entry no longer exists. Refresh the page.";

async function editStudent(text: Text) {
  const id = text("id");
  const name = text("editFullName");
  const nsheId = text("editNsheId");
  const email = text("editStudentEmail").toLowerCase();

  // The RebelCard is deliberately not editable here: cards change only through
  // the Link form, which asks before replacing an existing one.
  const errors: FormErrors = {};
  if (!id) errors.manage = "Nothing to edit";
  if (!name) errors.editFullName = "Name is required";
  checkLength(errors, "editFullName", name, "Name", MAX_NAME_LENGTH);
  if (!NSHE_ID_PATTERN.test(nsheId)) {
    errors.editNsheId = "NSHE ID must be 10 digits";
  }
  if (!validateEmail(email)) errors.editStudentEmail = "Email is invalid";
  if (Object.keys(errors).length > 0) return failFor(id, errors);

  if (await nsheMatchesOtherCard(nsheId, id)) {
    return failFor(id, { editNsheId: NSHE_IS_OTHER_CARD });
  }

  try {
    await prisma.student.update({
      where: { id },
      data: { name, nsheId, email },
    });
  } catch (error) {
    const info = prismaError(error);
    if (info?.code === "P2025")
      return failFor(id, { manage: NO_LONGER_EXISTS });
    if (info?.code !== "P2002") throw error;

    if (info.fields.includes("nsheId")) {
      errors.editNsheId = "A student with this NSHE ID already exists";
    }
    if (info.fields.includes("email")) {
      errors.editStudentEmail = "A student with this email already exists";
    }
    if (Object.keys(errors).length === 0) {
      errors.manage = "That student already exists";
    }
    return failFor(id, errors);
  }

  return succeed("edit-student");
}

async function editMachine(text: Text) {
  const id = text("id");
  const name = text("editMachineName");
  const categoryId = text("editMachineCategoryId");
  // An unchecked checkbox sends nothing at all, so absent means inactive.
  const isActive = text("editMachineActive") === "on";

  const errors: FormErrors = {};
  if (!id) errors.manage = "Nothing to edit";
  if (!name) errors.editMachineName = "Machine name is required";
  checkLength(errors, "editMachineName", name, "Name", MAX_NAME_LENGTH);
  if (!categoryId) errors.editMachineCategoryId = "Choose a category";
  if (Object.keys(errors).length > 0) return failFor(id, errors);

  try {
    await prisma.machine.update({
      where: { id },
      data: { name, categoryId, isActive },
    });
  } catch (error) {
    const info = prismaError(error);
    if (info?.code === "P2025")
      return failFor(id, { manage: NO_LONGER_EXISTS });
    if (info?.code === "P2002") {
      return failFor(id, {
        editMachineName: "A machine with this name already exists",
      });
    }
    if (info?.code === "P2003") {
      return failFor(id, {
        editMachineCategoryId: "That category no longer exists",
      });
    }
    throw error;
  }

  return succeed("edit-machine");
}

async function editCertification(text: Text) {
  const id = text("id");
  const name = text("editCertName");
  const description = text("editCertDescription");

  const errors: FormErrors = {};
  if (!id) errors.manage = "Nothing to edit";
  if (!name) errors.editCertName = "Certification name is required";
  checkLength(errors, "editCertName", name, "Name", MAX_NAME_LENGTH);
  checkLength(
    errors,
    "editCertDescription",
    description,
    "Description",
    MAX_DESCRIPTION_LENGTH,
  );
  if (Object.keys(errors).length > 0) return failFor(id, errors);

  try {
    await prisma.certification.update({
      where: { id },
      data: { name, description: description || null },
    });
  } catch (error) {
    const info = prismaError(error);
    if (info?.code === "P2025")
      return failFor(id, { manage: NO_LONGER_EXISTS });
    if (info?.code === "P2002") {
      return failFor(id, {
        editCertName: "A certification with this name already exists",
      });
    }
    throw error;
  }

  return succeed("edit-cert");
}

// Awarding records who did it (awardedById) for the audit trail.
async function awardCertification(text: Text, awardedById: string) {
  const studentId = text("studentId");
  const certificationId = text("awardCertId");

  if (!studentId) return failFor(studentId, { manage: "Nothing to award to" });
  if (!certificationId)
    return failFor(studentId, { awardCertId: "Choose a certification" });

  try {
    await prisma.studentCertification.create({
      data: { studentId, certificationId, awardedById },
    });
  } catch (error) {
    const info = prismaError(error);
    if (info?.code === "P2002") {
      return failFor(studentId, {
        awardCertId: "This student already has that certification",
      });
    }
    if (info?.code === "P2003")
      return failFor(studentId, { manage: NO_LONGER_EXISTS });
    throw error;
  }

  return succeed("award-cert");
}

async function revokeCertification(text: Text) {
  const studentId = text("studentId");
  const certificationId = text("revokeCertId");
  if (!studentId || !certificationId) {
    return failFor(studentId, { manage: "Nothing to remove" });
  }

  try {
    await prisma.studentCertification.delete({
      where: { studentId_certificationId: { studentId, certificationId } },
    });
  } catch (error) {
    // P2025 = it is already gone, which is what was asked for.
    if (prismaError(error)?.code !== "P2025") throw error;
  }

  return succeed("revoke-cert");
}

const DELETERS = {
  "delete-student": (id: string) => prisma.student.delete({ where: { id } }),
  "delete-machine": (id: string) => prisma.machine.delete({ where: { id } }),
  "delete-cert": (id: string) => prisma.certification.delete({ where: { id } }),
} as const;

type DeleteIntent = keyof typeof DELETERS;

const isDeleteIntent = (value: unknown): value is DeleteIntent =>
  typeof value === "string" && Object.keys(DELETERS).includes(value);

async function deleteEntry(intent: DeleteIntent, text: Text) {
  const id = text("id");
  if (!id) return fail({ delete: "Nothing to delete" });

  try {
    await DELETERS[intent](id);
  } catch (error) {
    // P2025 = the row is already gone (someone else deleted it first). The
    // goal is met, so treat it as success instead of showing an error page.
    if (prismaError(error)?.code !== "P2025") throw error;
  }

  return succeed(intent);
}

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  // The loader's check does not cover form posts, so check again here.
  // Deleting needs a higher role than everything else.
  const { user } = await (isDeleteIntent(intent)
    ? requireAdmin(request)
    : requireStaff(request));

  const text: Text = (key) => String(formData.get(key) ?? "").trim();

  if (isDeleteIntent(intent)) return deleteEntry(intent, text);

  switch (intent) {
    case "edit-student":
      return editStudent(text);
    case "edit-machine":
      return editMachine(text);
    case "edit-cert":
      return editCertification(text);
    case "award-cert":
      return awardCertification(text, user.id);
    case "revoke-cert":
      return revokeCertification(text);
    case "add-student":
      return addStudent(text);
    case "link-card":
      return linkCard(text);
    case "add-machine":
      return addMachine(text);
    case "add-cert":
      return addCertification(text);
    case "link-requirement":
      return linkRequirement(text);
    default:
      return fail({ form: "Unknown action" });
  }
}

// ─────────────────────────────────────────────────────────────
// UI
// ─────────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string }[] = [
  { key: "users", label: "USERS" },
  { key: "machines", label: "MACHINES" },
  { key: "certs", label: "CERTIFICATIONS" },
];

const ROSTER: Record<
  Tab,
  {
    title: string;
    placeholder: string;
    empty: string;
    columns: { label: string; className: string }[];
  }
> = {
  users: {
    title: "Student Roster",
    placeholder: "Search name, NSHE ID, card or email",
    empty: "No students found.",
    columns: [
      { label: "Name", className: "col-span-3" },
      { label: "NSHE ID", className: "col-span-2" },
      { label: "RebelCard ID", className: "col-span-2" },
      { label: "Email", className: "col-span-3" },
      { label: "Certs", className: "col-span-1 text-right" },
      { label: "Actions", className: "col-span-1 text-right" },
    ],
  },
  machines: {
    title: "Machine Roster",
    placeholder: "Search machine, category or certification",
    empty: "No machines found.",
    columns: [
      { label: "Name", className: "col-span-3" },
      { label: "Category", className: "col-span-2" },
      { label: "Required certifications", className: "col-span-4" },
      { label: "Status", className: "col-span-2 text-right" },
      { label: "Actions", className: "col-span-1 text-right" },
    ],
  },
  certs: {
    title: "Certification Roster",
    placeholder: "Search certification or description",
    empty: "No certifications found.",
    columns: [
      { label: "Name", className: "col-span-3" },
      { label: "Description", className: "col-span-4" },
      { label: "Machines", className: "col-span-2 text-right" },
      { label: "Students", className: "col-span-2 text-right" },
      { label: "Actions", className: "col-span-1 text-right" },
    ],
  },
};

// Confirmations for actions that happen inside a roster row, shown above it.
const ROSTER_MESSAGES: Partial<Record<Intent, string>> = {
  "edit-student": "Student updated.",
  "edit-machine": "Machine updated.",
  "edit-cert": "Certification updated.",
  "award-cert": "Certification awarded.",
  "revoke-cert": "Certification removed.",
  "delete-student": "Entry deleted.",
  "delete-machine": "Entry deleted.",
  "delete-cert": "Entry deleted.",
};

const INPUT_CLASS =
  "w-full rounded border border-gray-800 bg-[#080808] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500";

function ErrorText({ error, last }: { error?: string; last: boolean }) {
  if (!error) return null;
  return (
    <p
      role="alert"
      className={`${last ? "-mt-5 mb-6" : "-mt-3 mb-4"} text-xs text-red-400`}
    >
      {error}
    </p>
  );
}

// `name` is what the action reads; it defaults to the id. Edit panels set both
// because the same field appears once per roster row and ids must be unique.
function TextField({
  id,
  name = id,
  label,
  placeholder,
  defaultValue,
  error,
  last = false,
}: {
  id: string;
  name?: string;
  label: string;
  placeholder: string;
  defaultValue?: string;
  error?: string;
  last?: boolean;
}) {
  return (
    <>
      <label htmlFor={id} className="mb-2 block text-xs text-gray-400">
        {label}
      </label>
      <input
        id={id}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        className={`${INPUT_CLASS} ${last ? "mb-6" : "mb-4"}`}
        placeholder={placeholder}
      />
      <ErrorText error={error} last={last} />
    </>
  );
}

function SelectField({
  id,
  name = id,
  label,
  placeholder,
  options,
  defaultValue = "",
  error,
  last = false,
}: {
  id: string;
  name?: string;
  label: string;
  placeholder: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
  error?: string;
  last?: boolean;
}) {
  return (
    <>
      <label htmlFor={id} className="mb-2 block text-xs text-gray-400">
        {label}
      </label>
      <select
        id={id}
        name={name}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        className={`${INPUT_CLASS} ${last ? "mb-6" : "mb-4"}`}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ErrorText error={error} last={last} />
    </>
  );
}

function FormCard({
  intent,
  title,
  hint,
  success,
  formRef,
  children,
}: {
  intent: Intent;
  title: string;
  hint?: string;
  success: string | null;
  formRef: (element: HTMLFormElement | null) => void;
  children: ReactNode;
}) {
  return (
    <Form
      method="post"
      ref={formRef}
      className="rounded border border-gray-800 bg-[#0c0c0c] p-6"
    >
      <input type="hidden" name="intent" value={intent} />

      <h3
        className={`${hint ? "mb-2" : "mb-4"} text-sm uppercase text-gray-400`}
      >
        {title}
      </h3>
      {hint ? <p className="mb-4 text-xs text-gray-500">{hint}</p> : null}
      {success ? (
        <p className="mb-4 text-sm text-green-400">{success}</p>
      ) : null}

      {children}
    </Form>
  );
}

function DeleteButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="text-xs font-semibold text-red-400 transition-colors hover:text-red-300"
    >
      Delete
    </button>
  );
}

// Rendered inside a roster row's grid, so col-span-12 makes it a full-width
// line directly under that row.
function DeleteConfirm({
  intent,
  id,
  message,
  busy,
  onCancel,
}: {
  intent: DeleteIntent;
  id: string;
  message: string;
  busy: boolean;
  onCancel: () => void;
}) {
  return (
    <Form
      method="post"
      role="alert"
      className="col-span-12 rounded border border-red-900 bg-red-950/30 p-3 text-sm text-red-200"
    >
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="id" value={id} />

      <p>{message}</p>

      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-gray-700 px-4 py-1.5 text-xs font-semibold text-gray-200 transition-opacity hover:opacity-90"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-[#c00000] px-4 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Deleting..." : "Delete permanently"}
        </button>
      </div>
    </Form>
  );
}

type LoaderData = Awaited<ReturnType<typeof loader>>;
type StudentRow = LoaderData["students"][number];
type MachineRow = LoaderData["machines"][number];
type CertRow = LoaderData["certifications"][number];
interface Option {
  value: string;
  label: string;
}

function EditButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="text-xs font-semibold text-gray-300 transition-colors hover:text-white"
    >
      Edit
    </button>
  );
}

// What every edit panel needs from the page. `errors` already holds only the
// errors that belong to this panel's row.
interface PanelProps {
  errors: FormErrors;
  isBusy: (intent: Intent) => boolean;
  registerForm: (intent: Intent) => (element: HTMLFormElement | null) => void;
  onClose: () => void;
}

// Rendered inside a roster row's grid, so col-span-12 makes it a full-width
// block directly under that row.
function EditPanel({
  title,
  errors,
  onClose,
  children,
}: {
  title: string;
  errors: FormErrors;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="col-span-12 rounded border border-gray-700 bg-[#080808] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h4 className="text-sm uppercase text-gray-400">{title}</h4>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-semibold text-gray-400 transition-colors hover:text-white"
        >
          Close
        </button>
      </div>

      {errors.manage ? (
        <p role="alert" className="mb-4 text-sm text-red-400">
          {errors.manage}
        </p>
      ) : null}

      {children}
    </div>
  );
}

function StudentEditPanel({
  row,
  certOptions,
  errors,
  isBusy,
  registerForm,
  onClose,
}: PanelProps & { row: StudentRow; certOptions: Option[] }) {
  const heldIds = new Set(row.held.map((cert) => cert.id));
  const awardable = certOptions.filter((option) => !heldIds.has(option.value));

  return (
    <EditPanel title={`Edit ${row.name}`} errors={errors} onClose={onClose}>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Form method="post" ref={registerForm("edit-student")}>
          <input type="hidden" name="intent" value="edit-student" />
          <input type="hidden" name="id" value={row.id} />

          <TextField
            id={`edit-name-${row.id}`}
            name="editFullName"
            label="Full name"
            placeholder="Jane Smith"
            defaultValue={row.name}
            error={errors.editFullName}
          />
          <TextField
            id={`edit-nshe-${row.id}`}
            name="editNsheId"
            label="NSHE ID"
            placeholder="2001234567"
            defaultValue={row.nshe}
            error={errors.editNsheId}
          />
          <TextField
            id={`edit-email-${row.id}`}
            name="editStudentEmail"
            label="Email"
            placeholder="j.smith@unlv.nevada.edu"
            defaultValue={row.email}
            error={errors.editStudentEmail}
          />

          <p className="mb-4 text-xs text-gray-500">
            RebelCard: {row.rebel || "none on file"}. Change it with Link NSHE
            ID → RebelCard, which asks before replacing a card.
          </p>

          <SubmitButton
            busy={isBusy("edit-student")}
            label="Save changes"
            busyLabel="Saving..."
          />
        </Form>

        <div>
          <h5 className="mb-2 text-xs uppercase text-gray-400">
            Certifications
          </h5>

          {row.held.length === 0 ? (
            <p className="mb-4 text-sm text-gray-500">No certifications yet.</p>
          ) : (
            <ul className="mb-4 space-y-2">
              {row.held.map((cert) => (
                <li
                  key={cert.id}
                  className="flex items-center justify-between gap-3 rounded border border-gray-800 px-3 py-2 text-sm"
                >
                  <span>{cert.name}</span>
                  <Form method="post">
                    <input type="hidden" name="intent" value="revoke-cert" />
                    <input type="hidden" name="studentId" value={row.id} />
                    <input type="hidden" name="revokeCertId" value={cert.id} />
                    <button
                      type="submit"
                      disabled={isBusy("revoke-cert")}
                      aria-label={`Remove ${cert.name} from ${row.name}`}
                      className="text-xs font-semibold text-red-400 transition-colors hover:text-red-300 disabled:opacity-60"
                    >
                      Remove
                    </button>
                  </Form>
                </li>
              ))}
            </ul>
          )}

          <Form method="post" ref={registerForm("award-cert")}>
            <input type="hidden" name="intent" value="award-cert" />
            <input type="hidden" name="studentId" value={row.id} />

            <SelectField
              id={`award-cert-${row.id}`}
              name="awardCertId"
              label="Award a certification"
              placeholder={
                awardable.length > 0
                  ? "Select a certification"
                  : "No more certifications to award"
              }
              options={awardable}
              error={errors.awardCertId}
              last
            />

            <SubmitButton
              busy={isBusy("award-cert")}
              label="Award"
              busyLabel="Awarding..."
            />
          </Form>
        </div>
      </div>
    </EditPanel>
  );
}

function MachineEditPanel({
  row,
  categoryOptions,
  errors,
  isBusy,
  registerForm,
  onClose,
}: PanelProps & { row: MachineRow; categoryOptions: Option[] }) {
  return (
    <EditPanel title={`Edit ${row.name}`} errors={errors} onClose={onClose}>
      <Form
        method="post"
        ref={registerForm("edit-machine")}
        className="max-w-md"
      >
        <input type="hidden" name="intent" value="edit-machine" />
        <input type="hidden" name="id" value={row.id} />

        <TextField
          id={`edit-machine-name-${row.id}`}
          name="editMachineName"
          label="Machine name"
          placeholder="Prusa MK4"
          defaultValue={row.name}
          error={errors.editMachineName}
        />
        <SelectField
          id={`edit-machine-category-${row.id}`}
          name="editMachineCategoryId"
          label="Category"
          placeholder="Select a category"
          options={categoryOptions}
          defaultValue={row.categoryId}
          error={errors.editMachineCategoryId}
        />

        <label className="mb-4 flex items-center gap-2 text-sm text-gray-300">
          <input
            type="checkbox"
            name="editMachineActive"
            defaultChecked={row.active}
          />
          Active (uncheck to take it out of service)
        </label>

        <SubmitButton
          busy={isBusy("edit-machine")}
          label="Save changes"
          busyLabel="Saving..."
        />
      </Form>
    </EditPanel>
  );
}

function CertEditPanel({
  row,
  errors,
  isBusy,
  registerForm,
  onClose,
}: PanelProps & { row: CertRow }) {
  return (
    <EditPanel title={`Edit ${row.name}`} errors={errors} onClose={onClose}>
      <Form method="post" ref={registerForm("edit-cert")} className="max-w-md">
        <input type="hidden" name="intent" value="edit-cert" />
        <input type="hidden" name="id" value={row.id} />

        <TextField
          id={`edit-cert-name-${row.id}`}
          name="editCertName"
          label="Certification name"
          placeholder="Laser Cutter Safety & Operation"
          defaultValue={row.name}
          error={errors.editCertName}
        />
        <TextField
          id={`edit-cert-description-${row.id}`}
          name="editCertDescription"
          label="Description (optional)"
          placeholder="What the student has been trained on"
          defaultValue={row.description}
          error={errors.editCertDescription}
          last
        />

        <SubmitButton
          busy={isBusy("edit-cert")}
          label="Save changes"
          busyLabel="Saving..."
        />
      </Form>
    </EditPanel>
  );
}

function SubmitButton({
  busy,
  label,
  busyLabel,
}: {
  busy: boolean;
  label: string;
  busyLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="rounded bg-[#c00000] px-5 py-2 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {busy ? busyLabel : label}
    </button>
  );
}

/**
 * CHECKLIST:
 * - Render the admin dashboard with tabs for Users, Machines,
 *    and Certifications.
 * - Each tab should display relevant data and
 *   provide functionality to manage users, machines, and certifications.
 * - Implement forms for adding new students and linking NSHE IDs to
 *    RebelCard IDs.
 * - Ensure proper styling and responsive design for the
 *    admin console.
 *
 * AI Usage: Github Copilot & Claude AI was used to assist in writing the code for the admin
 *           dashboard UI elements such as buttons, tabs, and forms. It provided
 *           suggestions for JSX structure and Tailwind CSS classes to achieve the
 *           desired layout and styling.
 *
 */
export default function AdminPage() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [search, setSearch] = useState("");
  // The roster row whose "Delete" confirmation is currently open.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  // The roster row whose edit panel is open. Only one panel or confirmation is
  // ever open at a time.
  const [editingId, setEditingId] = useState<string | null>(null);

  const errors: FormErrors = actionData?.errors ?? {};
  // An edit panel only shows errors from its own submission.
  const errorsFor = (rowId: string): FormErrors =>
    actionData?.target === rowId ? errors : {};
  const ok = actionData?.ok ?? null;
  const submittingIntent =
    navigation.state === "submitting"
      ? navigation.formData?.get("intent")
      : null;
  const isBusy = (intent: Intent) => submittingIntent === intent;

  // Inputs keep their text after a save, so clear the form that just
  // succeeded. Keyed by intent so each card resets only itself.
  const formRefs = useRef<Record<string, HTMLFormElement | null>>({});
  const registerForm =
    (intent: Intent) => (element: HTMLFormElement | null) => {
      formRefs.current[intent] = element;
    };
  useEffect(() => {
    if (actionData?.ok) formRefs.current[actionData.ok]?.reset();
    // A finished delete closes its confirmation, a saved edit closes its panel
    // (awarding or removing a certification keeps the panel open).
    if (actionData?.ok?.startsWith("delete-")) setConfirmingId(null);
    if (actionData?.ok?.startsWith("edit-")) setEditingId(null);
  }, [actionData]);

  const selectTab = (tab: Tab) => {
    setActiveTab(tab);
    setSearch("");
    setConfirmingId(null);
    setEditingId(null);
  };

  const openEdit = (rowId: string) => {
    setEditingId(rowId);
    setConfirmingId(null);
  };
  const openDelete = (rowId: string) => {
    setConfirmingId(rowId);
    setEditingId(null);
  };
  const closePanels = () => {
    setEditingId(null);
    setConfirmingId(null);
  };

  const query = search.trim().toLowerCase();
  const matches = (values: string[]) =>
    !query || values.some((value) => value.toLowerCase().includes(query));

  const filteredStudents = loaderData.students.filter((s) =>
    matches([s.name, s.nshe, s.rebel, s.email]),
  );
  const filteredMachines = loaderData.machines.filter((m) =>
    matches([m.name, m.category, ...m.requires]),
  );
  const filteredCerts = loaderData.certifications.filter((c) =>
    matches([c.name, c.description]),
  );

  const rowCount = {
    users: filteredStudents.length,
    machines: filteredMachines.length,
    certs: filteredCerts.length,
  }[activeTab];
  const roster = ROSTER[activeTab];

  const machineOptions = loaderData.machines.map((m) => ({
    value: m.id,
    label: m.name,
  }));
  const certOptions = loaderData.certifications.map((c) => ({
    value: c.id,
    label: c.name,
  }));
  const categoryOptions = loaderData.categories.map((c) => ({
    value: c.id,
    label: c.name,
  }));

  const renderTabUnderline = (tab: Tab) => {
    return activeTab === tab ? (
      <span className="absolute -bottom-4 left-0 h-1 w-full rounded bg-[#c00000]" />
    ) : null;
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* Top header */}
      <header className="h-20 bg-[#c00000]">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-4">
            {/* Circular UNLV mark */}
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white font-bold text-[#c00000]">
              UNLV
            </div>
            <div>
              <div className="text-xs font-semibold tracking-wide">
                UNIVERSITY OF NEVADA, LAS VEGAS
              </div>

              <div className="text-lg font-bold tracking-wider">
                MAKERSPACE ADMIN CONSOLE
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <Link
              to="/"
              className="text-sm font-semibold transition-opacity hover:opacity-80"
            >
              ← STUDENT SCANNER
            </Link>
            {/* Logging out changes the session, so it must be a POST. */}
            <Form method="post" action="/logout">
              <button
                type="submit"
                className="rounded border border-white/70 px-3 py-1 text-sm font-semibold transition-colors hover:bg-white hover:text-[#c00000]"
              >
                LOG OUT
              </button>
            </Form>
          </div>
        </div>
      </header>
      {/* Main content */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        <h1 className="text-xl font-bold">Admin Dashboard</h1>

        <p className="mt-2 text-sm text-gray-400">
          {loaderData.success
            ? `Admin page is ready for development. Signed in as ${loaderData.user?.email ?? "admin"}`
            : "Unable to load the admin page."}
        </p>
        {/* Tabs */}
        <nav className="mt-8 border-b border-gray-700">
          <ul className="flex gap-8">
            {TABS.map((tab) => (
              <li key={tab.key}>
                <button
                  type="button"
                  onClick={() => selectTab(tab.key)}
                  className={`pb-4 text-sm font-semibold tracking-wider transition-colors ${
                    activeTab === tab.key
                      ? "text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  <span className="relative">
                    {tab.label}
                    {renderTabUnderline(tab.key)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="mt-8" />
        {/* Two-column forms (change with the active tab) */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {activeTab === "users" ? (
            <>
              {/* Left: Add New Student */}
              <FormCard
                intent="add-student"
                title="Add New Student"
                success={ok === "add-student" ? "Student added." : null}
                formRef={registerForm("add-student")}
              >
                {errors.form ? (
                  <p role="alert" className="mb-4 text-sm text-red-400">
                    {errors.form}
                  </p>
                ) : null}

                <TextField
                  id="fullName"
                  label="Full name"
                  placeholder="Jane Smith"
                  error={errors.fullName}
                />
                <TextField
                  id="nsheId"
                  label="NSHE ID"
                  placeholder="2001234567"
                  error={errors.nsheId}
                />
                <TextField
                  id="rebelCardId"
                  label="RebelCard ID (optional)"
                  placeholder="Leave blank if the card scans the NSHE ID"
                  error={errors.rebelCardId}
                />
                <TextField
                  id="studentEmail"
                  label="Email"
                  placeholder="j.smith@unlv.nevada.edu"
                  error={errors.studentEmail}
                  last
                />

                <SubmitButton
                  busy={isBusy("add-student")}
                  label="Add Student"
                  busyLabel="Adding..."
                />
              </FormCard>

              {/* Right: Link NSHE ID -> RebelCard */}
              <FormCard
                intent="link-card"
                title="Link NSHE ID → RebelCard"
                hint="Only needed when a card scans a different number than the NSHE ID, such as an older 14-digit library barcode."
                success={ok === "link-card" ? "RebelCard linked." : null}
                formRef={registerForm("link-card")}
              >
                <TextField
                  id="linkNsheId"
                  label="NSHE ID"
                  placeholder="2001234567"
                  error={errors.linkNsheId}
                />
                <TextField
                  id="newRebelCardId"
                  label="New RebelCard ID"
                  placeholder="14-digit library barcode or card number"
                  error={errors.newRebelCardId}
                  last
                />

                <SubmitButton
                  busy={isBusy("link-card")}
                  label="Link IDs"
                  busyLabel="Linking..."
                />

                {/* Must stay AFTER the Link IDs button: pressing Enter in an
                    input submits the first submit button in the form, and that
                    must never be "Replace card". */}
                {actionData?.overwrite ? (
                  <div
                    role="alert"
                    className="mt-4 rounded border border-yellow-700 bg-yellow-950/40 p-3 text-sm text-yellow-200"
                  >
                    <p>
                      {actionData.overwrite.name} already has card{" "}
                      <span className="font-semibold">
                        {actionData.overwrite.currentCard}
                      </span>
                      . Replacing it means that card will stop being recognized
                      at the scanner.
                    </p>
                    <button
                      type="submit"
                      name="confirmOverwrite"
                      value={actionData.overwrite.currentCard}
                      disabled={isBusy("link-card")}
                      className="mt-3 rounded bg-yellow-600 px-4 py-1.5 text-xs font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      Replace card
                    </button>
                  </div>
                ) : null}
              </FormCard>
            </>
          ) : null}

          {activeTab === "machines" ? (
            <>
              {/* Left: Add New Machine */}
              <FormCard
                intent="add-machine"
                title="Add New Machine"
                success={ok === "add-machine" ? "Machine added." : null}
                formRef={registerForm("add-machine")}
              >
                <TextField
                  id="machineName"
                  label="Machine name"
                  placeholder="Prusa MK4"
                  error={errors.machineName}
                />
                <SelectField
                  id="machineCategoryId"
                  label="Category"
                  placeholder="Select a category"
                  options={categoryOptions}
                  error={errors.machineCategoryId}
                />
                <TextField
                  id="newCategoryName"
                  label="Or create a new category (takes priority)"
                  placeholder="Leave blank to use the category above"
                  error={errors.newCategoryName}
                  last
                />

                <SubmitButton
                  busy={isBusy("add-machine")}
                  label="Add Machine"
                  busyLabel="Adding..."
                />
              </FormCard>

              {/* Right: Require a certification for a machine */}
              <FormCard
                intent="link-requirement"
                title="Link Certification → Machine"
                hint="Students will need this certification to be authorized on the machine."
                success={
                  ok === "link-requirement" ? "Certification linked." : null
                }
                formRef={registerForm("link-requirement")}
              >
                <SelectField
                  id="requirementMachineId"
                  label="Machine"
                  placeholder="Select a machine"
                  options={machineOptions}
                  error={errors.requirementMachineId}
                />
                <SelectField
                  id="requirementCertId"
                  label="Required certification"
                  placeholder="Select a certification"
                  options={certOptions}
                  error={errors.requirementCertId}
                  last
                />

                <SubmitButton
                  busy={isBusy("link-requirement")}
                  label="Link Certification"
                  busyLabel="Linking..."
                />
              </FormCard>
            </>
          ) : null}

          {activeTab === "certs" ? (
            <>
              {/* Left: Add New Certification */}
              <FormCard
                intent="add-cert"
                title="Add New Certification"
                success={ok === "add-cert" ? "Certification added." : null}
                formRef={registerForm("add-cert")}
              >
                <TextField
                  id="certName"
                  label="Certification name"
                  placeholder="Laser Cutter Safety & Operation"
                  error={errors.certName}
                />
                <TextField
                  id="certDescription"
                  label="Description (optional)"
                  placeholder="What the student has been trained on"
                  error={errors.certDescription}
                  last
                />

                <SubmitButton
                  busy={isBusy("add-cert")}
                  label="Add Certification"
                  busyLabel="Adding..."
                />
              </FormCard>

              {/* Right: Require a certification for a machine */}
              <FormCard
                intent="link-requirement"
                title="Link Certification → Machine"
                hint="Students will need this certification to be authorized on the machine."
                success={
                  ok === "link-requirement" ? "Certification linked." : null
                }
                formRef={registerForm("link-requirement")}
              >
                <SelectField
                  id="requirementCertId"
                  label="Required certification"
                  placeholder="Select a certification"
                  options={certOptions}
                  error={errors.requirementCertId}
                />
                <SelectField
                  id="requirementMachineId"
                  label="Machine"
                  placeholder="Select a machine"
                  options={machineOptions}
                  error={errors.requirementMachineId}
                  last
                />

                <SubmitButton
                  busy={isBusy("link-requirement")}
                  label="Link Certification"
                  busyLabel="Linking..."
                />
              </FormCard>
            </>
          ) : null}
        </div>
        {/* Roster (table-like) for the active tab */}
        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm uppercase text-gray-400">{roster.title}</h2>
            <label htmlFor="rosterSearch" className="sr-only">
              Search {roster.title}
            </label>
            <input
              id="rosterSearch"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={roster.placeholder}
              className="w-full rounded border border-gray-800 bg-[#080808] px-3 py-2 text-sm text-gray-200 placeholder:text-gray-500 sm:w-72"
            />
          </div>

          {ok && ROSTER_MESSAGES[ok] ? (
            <p className="mb-4 text-sm text-green-400">{ROSTER_MESSAGES[ok]}</p>
          ) : null}
          {errors.delete ? (
            <p role="alert" className="mb-4 text-sm text-red-400">
              {errors.delete}
            </p>
          ) : null}

          <div className="overflow-hidden rounded border border-gray-800 bg-[#0c0c0c]">
            <div className="grid grid-cols-12 gap-4 px-6 py-3 text-xs uppercase text-gray-400">
              {roster.columns.map((column) => (
                <div
                  key={column.label}
                  className={`${column.className} font-semibold`}
                >
                  {column.label === "Actions" ? (
                    <span className="sr-only">Actions</span>
                  ) : (
                    column.label
                  )}
                </div>
              ))}
            </div>

            <div className="max-h-96 divide-y divide-gray-800 overflow-y-auto">
              {rowCount === 0 ? (
                <div className="px-6 py-4 text-sm text-gray-400">
                  {roster.empty}
                </div>
              ) : null}

              {activeTab === "users"
                ? filteredStudents.map((row) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-12 items-center gap-4 px-6 py-4 text-sm"
                    >
                      <div className="col-span-3">
                        <div className="font-medium text-white">{row.name}</div>
                      </div>

                      <div className="col-span-2 text-gray-300">{row.nshe}</div>

                      <div className="col-span-2 text-gray-300">
                        {row.rebel || "—"}
                      </div>

                      <div className="col-span-3 text-gray-400">
                        {row.email}
                      </div>

                      <div className="col-span-1 text-right">
                        <span
                          className={`inline-block rounded px-2 py-1 text-xs font-semibold ${
                            row.certs > 0
                              ? "border border-[#5a0000] bg-[#2b0000] text-[#ffb6b6]"
                              : "bg-gray-800 text-gray-400"
                          }`}
                        >
                          {row.certs}
                        </span>
                      </div>

                      <div className="col-span-1 flex flex-col items-end gap-1">
                        <EditButton
                          label={`Edit ${row.name}`}
                          onClick={() => openEdit(row.id)}
                        />
                        {loaderData.canDelete ? (
                          <DeleteButton
                            label={`Delete ${row.name}`}
                            onClick={() => openDelete(row.id)}
                          />
                        ) : null}
                      </div>

                      {editingId === row.id ? (
                        <StudentEditPanel
                          row={row}
                          certOptions={certOptions}
                          errors={errorsFor(row.id)}
                          isBusy={isBusy}
                          registerForm={registerForm}
                          onClose={closePanels}
                        />
                      ) : null}

                      {confirmingId === row.id ? (
                        <DeleteConfirm
                          intent="delete-student"
                          id={row.id}
                          busy={isBusy("delete-student")}
                          onCancel={closePanels}
                          message={`Permanently delete ${row.name}? Their ${row.certs} certification award(s) and any restrictions on file are deleted too. Past scan logs are kept but no longer linked to them.`}
                        />
                      ) : null}
                    </div>
                  ))
                : null}

              {activeTab === "machines"
                ? filteredMachines.map((row) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-12 items-center gap-4 px-6 py-4 text-sm"
                    >
                      <div className="col-span-3 font-medium text-white">
                        {row.name}
                      </div>

                      <div className="col-span-2 text-gray-300">
                        {row.category}
                      </div>

                      <div className="col-span-4 text-gray-400">
                        {row.requires.length > 0
                          ? row.requires.join(", ")
                          : "None (open to everyone)"}
                      </div>

                      <div className="col-span-2 text-right">
                        <span
                          className={`inline-block rounded px-2 py-1 text-xs font-semibold ${
                            row.active
                              ? "border border-[#5a0000] bg-[#2b0000] text-[#ffb6b6]"
                              : "bg-gray-800 text-gray-400"
                          }`}
                        >
                          {row.active ? "Active" : "Inactive"}
                        </span>
                      </div>

                      <div className="col-span-1 flex flex-col items-end gap-1">
                        <EditButton
                          label={`Edit ${row.name}`}
                          onClick={() => openEdit(row.id)}
                        />
                        {loaderData.canDelete ? (
                          <DeleteButton
                            label={`Delete ${row.name}`}
                            onClick={() => openDelete(row.id)}
                          />
                        ) : null}
                      </div>

                      {editingId === row.id ? (
                        <MachineEditPanel
                          row={row}
                          categoryOptions={categoryOptions}
                          errors={errorsFor(row.id)}
                          isBusy={isBusy}
                          registerForm={registerForm}
                          onClose={closePanels}
                        />
                      ) : null}

                      {confirmingId === row.id ? (
                        <DeleteConfirm
                          intent="delete-machine"
                          id={row.id}
                          busy={isBusy("delete-machine")}
                          onCancel={closePanels}
                          message={`Permanently delete ${row.name}? Its ${row.requires.length} certification requirement(s) are deleted too.`}
                        />
                      ) : null}
                    </div>
                  ))
                : null}

              {activeTab === "certs"
                ? filteredCerts.map((row) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-12 items-center gap-4 px-6 py-4 text-sm"
                    >
                      <div className="col-span-3 font-medium text-white">
                        {row.name}
                      </div>

                      <div className="col-span-4 text-gray-400">
                        {row.description || "—"}
                      </div>

                      <div className="col-span-2 text-right text-gray-300">
                        {row.machines}
                      </div>

                      <div className="col-span-2 text-right text-gray-300">
                        {row.students}
                      </div>

                      <div className="col-span-1 flex flex-col items-end gap-1">
                        <EditButton
                          label={`Edit ${row.name}`}
                          onClick={() => openEdit(row.id)}
                        />
                        {loaderData.canDelete ? (
                          <DeleteButton
                            label={`Delete ${row.name}`}
                            onClick={() => openDelete(row.id)}
                          />
                        ) : null}
                      </div>

                      {editingId === row.id ? (
                        <CertEditPanel
                          row={row}
                          errors={errorsFor(row.id)}
                          isBusy={isBusy}
                          registerForm={registerForm}
                          onClose={closePanels}
                        />
                      ) : null}

                      {confirmingId === row.id ? (
                        <DeleteConfirm
                          intent="delete-cert"
                          id={row.id}
                          busy={isBusy("delete-cert")}
                          onCancel={closePanels}
                          message={`Permanently delete ${row.name}? It is removed from ${row.students} student(s) and no longer required by ${row.machines} machine(s).${
                            row.machines > 0
                              ? " Any machine where it was the only requirement becomes open to everyone."
                              : ""
                          }`}
                        />
                      ) : null}
                    </div>
                  ))
                : null}
            </div>
          </div>
        </section>
      </main>
      {/* Floating help button */}
      <div className="fixed bottom-6 right-6">
        <button className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-700 bg-[#111111] text-gray-300">
          ?
        </button>
      </div>
    </div>
  );
}
