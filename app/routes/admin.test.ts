import {
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "@remix-run/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as sessionModule from "~/session.server";

/* AI Usage: Claude AI was used to help write tests that mocked
            the database and session, and to generate test cases for form data
            validation and database interactions.
*/
vi.hoisted(() => {
  process.env.SESSION_SECRET ??= "test-secret";
});

// The whole database is mocked, so these tests never touch a real Postgres.
const db = vi.hoisted(() => ({
  student: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  machine: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  certification: {
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  machineCategory: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
  },
  machineRequirement: { create: vi.fn() },
  studentCertification: { create: vi.fn(), delete: vi.fn() },
}));
vi.mock("~/db.server", () => ({ prisma: db }));

import { action, loader } from "./admin";

interface MockUser {
  id: string;
  email: string;
  roles: string;
  createdAt: Date;
  updatedAt: Date;
}

const makeUser = (overrides: Partial<MockUser> = {}): MockUser => ({
  id: "user-1",
  email: "test@example.com",
  roles: "",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const allWrites = [
  db.student.create,
  db.student.update,
  db.student.delete,
  db.machine.create,
  db.machine.update,
  db.machine.delete,
  db.certification.create,
  db.certification.update,
  db.certification.delete,
  db.machineCategory.create,
  db.machineRequirement.create,
  db.studentCertification.create,
  db.studentCertification.delete,
];

// Reset every mock explicitly (instead of relying on restoreAllMocks, whose
// behaviour for vi.fn() differs between Vitest versions), then set defaults.
beforeEach(() => {
  vi.restoreAllMocks();
  for (const model of Object.values(db)) {
    for (const fn of Object.values(model)) fn.mockReset();
  }

  db.student.findMany.mockResolvedValue([]);
  db.machine.findMany.mockResolvedValue([]);
  db.certification.findMany.mockResolvedValue([]);
  db.machineCategory.findMany.mockResolvedValue([]);

  db.student.create.mockResolvedValue({});
  db.student.update.mockResolvedValue({});
  db.student.findUnique.mockResolvedValue({
    id: "s1",
    name: "Maria Sanchez",
    rebelCardId: null,
  });
  // No scan-number clashes unless a test says so.
  db.student.findFirst.mockResolvedValue(null);
  db.machine.update.mockResolvedValue({});
  db.certification.update.mockResolvedValue({});
  db.studentCertification.create.mockResolvedValue({});
  db.studentCertification.delete.mockResolvedValue({});
  db.machine.create.mockResolvedValue({});
  db.certification.create.mockResolvedValue({});
  db.machineCategory.findFirst.mockResolvedValue(null);
  db.machineCategory.aggregate.mockResolvedValue({ _max: { sortOrder: 3 } });
  db.machineCategory.create.mockResolvedValue({ id: "cat-new" });
  db.machineRequirement.create.mockResolvedValue({});
  db.student.delete.mockResolvedValue({});
  db.machine.delete.mockResolvedValue({});
  db.certification.delete.mockResolvedValue({});
});

describe("admin loader", () => {
  it("redirects unauthenticated users to login", async () => {
    // unauthenticated user is handled before the role check
    vi.spyOn(sessionModule, "getUser").mockResolvedValue(null);

    const request = new Request("http://localhost/admin");
    // requireStaff throws the redirect, so catch it to inspect the response
    const thrown = (await loader({ request } as LoaderFunctionArgs).catch(
      (e) => e,
    )) as Response;

    expect(thrown).toBeInstanceOf(Response);
    expect(thrown.status).toBe(302);
    expect(thrown.headers.get("Location")).toBe("/login?redirectTo=%2Fadmin");
    expect(db.student.findMany).not.toHaveBeenCalled();
  });

  it("throws a 403 when a user has no role", async () => {
    // empty or missing role must be denied
    vi.spyOn(sessionModule, "getUser").mockResolvedValue(
      makeUser({
        id: "user-2",
        email: "norole@example.com",
        roles: "",
      }),
    );

    const request = new Request("http://localhost/admin");

    await expect(
      loader({ request } as LoaderFunctionArgs),
    ).rejects.toMatchObject({
      status: 403,
    });
    expect(db.student.findMany).not.toHaveBeenCalled();
    expect(db.machine.findMany).not.toHaveBeenCalled();
  });

  it("allows staff users to view the admin page", async () => {
    // staff is allowed
    vi.spyOn(sessionModule, "getUser").mockResolvedValue(
      makeUser({
        id: "user-3",
        email: "staff@example.com",
        roles: "staff",
      }),
    );

    const request = new Request("http://localhost/admin");
    const result = await loader({ request } as LoaderFunctionArgs);

    expect(result).not.toBeInstanceOf(Response);

    if (!(result instanceof Response)) {
      expect(result).toMatchObject({
        success: true,
        user: {
          id: "user-3",
          email: "staff@example.com",
          roles: "staff",
        },
      });
    }
  });

  it("returns the student roster for staff users", async () => {
    vi.spyOn(sessionModule, "getUser").mockResolvedValue(
      makeUser({ id: "user-7", email: "staff2@example.com", roles: "staff" }),
    );
    db.student.findMany.mockResolvedValue([
      {
        id: "s1",
        name: "Maria Sanchez",
        nsheId: "2001234567",
        rebelCardId: "1001234567",
        email: "m.sanchez@unlv.nevada.edu",
        certifications: [
          { certification: { id: "c1", name: "Laser Safety" } },
          { certification: { id: "c2", name: "Welding" } },
        ],
      },
    ]);

    const request = new Request("http://localhost/admin");
    const result = await loader({ request } as LoaderFunctionArgs);

    expect(result).toMatchObject({
      students: [
        {
          id: "s1",
          name: "Maria Sanchez",
          nshe: "2001234567",
          rebel: "1001234567",
          email: "m.sanchez@unlv.nevada.edu",
          certs: 2,
          held: [
            { id: "c1", name: "Laser Safety" },
            { id: "c2", name: "Welding" },
          ],
        },
      ],
    });
  });

  it("returns an empty RebelCard value for students without a card", async () => {
    vi.spyOn(sessionModule, "getUser").mockResolvedValue(
      makeUser({ id: "user-8", email: "staff3@example.com", roles: "staff" }),
    );
    db.student.findMany.mockResolvedValue([
      {
        id: "s2",
        name: "No Card",
        nsheId: "2007770001",
        rebelCardId: null,
        email: "no.card@unlv.nevada.edu",
        certifications: [],
      },
    ]);

    const request = new Request("http://localhost/admin");
    const result = await loader({ request } as LoaderFunctionArgs);

    expect(result).toMatchObject({
      students: [{ id: "s2", rebel: "", certs: 0, held: [] }],
    });
  });

  it("returns machines, certifications and categories", async () => {
    vi.spyOn(sessionModule, "getUser").mockResolvedValue(
      makeUser({ roles: "staff" }),
    );
    db.machine.findMany.mockResolvedValue([
      {
        id: "m1",
        name: "Prusa MK4",
        isActive: true,
        categoryId: "cat-1",
        category: { name: "3D Printing" },
        requirements: [
          { certification: { name: "Safety B" } },
          { certification: { name: "Safety A" } },
        ],
      },
      {
        id: "m2",
        name: "Bandsaw",
        isActive: false,
        categoryId: "cat-2",
        category: { name: "Woodworking" },
        requirements: [],
      },
    ]);
    db.certification.findMany.mockResolvedValue([
      {
        id: "c1",
        name: "Safety A",
        description: null,
        _count: { students: 4, requiredBy: 2 },
      },
    ]);
    db.machineCategory.findMany.mockResolvedValue([
      { id: "cat-1", name: "3D Printing" },
    ]);

    const request = new Request("http://localhost/admin");
    const result = await loader({ request } as LoaderFunctionArgs);

    expect(result).toMatchObject({
      machines: [
        {
          id: "m1",
          name: "Prusa MK4",
          category: "3D Printing",
          categoryId: "cat-1",
          active: true,
          requires: ["Safety A", "Safety B"],
        },
        { id: "m2", categoryId: "cat-2", active: false, requires: [] },
      ],
      certifications: [
        {
          id: "c1",
          name: "Safety A",
          description: "",
          students: 4,
          machines: 2,
        },
      ],
      categories: [{ id: "cat-1", name: "3D Printing" }],
    });
  });

  it.each([
    ["staff", false],
    ["admin", true],
    ["super admin", true],
  ])("sets canDelete for %s to %s", async (roles, canDelete) => {
    vi.spyOn(sessionModule, "getUser").mockResolvedValue(makeUser({ roles }));

    const request = new Request("http://localhost/admin");
    const result = await loader({ request } as LoaderFunctionArgs);

    expect(result).toMatchObject({ canDelete });
  });

  it("allows admin users to view the admin page", async () => {
    // admin is allowed
    vi.spyOn(sessionModule, "getUser").mockResolvedValue(
      makeUser({
        id: "user-4",
        email: "admin@example.com",
        roles: "admin",
      }),
    );

    const request = new Request("http://localhost/admin");
    const result = await loader({ request } as LoaderFunctionArgs);

    expect(result).not.toBeInstanceOf(Response);

    if (!(result instanceof Response)) {
      expect(result).toMatchObject({
        success: true,
        user: {
          id: "user-4",
          email: "admin@example.com",
          roles: "admin",
        },
      });
    }
  });

  it("allows super admin users to view the admin page", async () => {
    // super admin is allowed
    vi.spyOn(sessionModule, "getUser").mockResolvedValue(
      makeUser({
        id: "user-5",
        email: "superadmin@example.com",
        roles: "super admin",
      }),
    );

    const request = new Request("http://localhost/admin");
    const result = await loader({ request } as LoaderFunctionArgs);

    expect(result).not.toBeInstanceOf(Response);

    if (!(result instanceof Response)) {
      expect(result).toMatchObject({
        success: true,
        user: {
          id: "user-5",
          email: "superadmin@example.com",
          roles: "super admin",
        },
      });
    }
  });

  it("throws a 403 for non-authorized roles", async () => {
    // non-authorized role is denied; student is not a role in this schema
    vi.spyOn(sessionModule, "getUser").mockResolvedValue(
      makeUser({
        id: "user-6",
        email: "guest@example.com",
        roles: "guest",
      }),
    );

    const request = new Request("http://localhost/admin");

    await expect(
      loader({ request } as LoaderFunctionArgs),
    ).rejects.toMatchObject({
      status: 403,
    });
  });
});

describe("admin action", () => {
  interface ActionBody {
    ok: string | null;
    errors: Record<string, string>;
    overwrite: { name: string; currentCard: string } | null;
    target: string | null;
  }

  const postForm = (fields: Record<string, string>) =>
    new Request("http://localhost/admin", {
      method: "POST",
      body: new URLSearchParams(fields),
    });

  const run = async (fields: Record<string, string>) =>
    (await action({
      request: postForm(fields),
    } as ActionFunctionArgs)) as Response;

  const bodyOf = async (res: Response) => (await res.json()) as ActionBody;

  const asStaff = () =>
    vi
      .spyOn(sessionModule, "getUser")
      .mockResolvedValue(makeUser({ roles: "staff" }));

  const expectNoWrites = () => {
    for (const write of allWrites) expect(write).not.toHaveBeenCalled();
  };

  const forms: Record<string, Record<string, string>> = {
    "add-student": {
      intent: "add-student",
      fullName: "  Jane Smith ",
      nsheId: "2001112223",
      rebelCardId: "1001112223",
      studentEmail: "Jane.Smith@UNLV.nevada.edu",
    },
    "link-card": {
      intent: "link-card",
      linkNsheId: "2001112223",
      newRebelCardId: "21234567890123",
    },
    "add-machine": {
      intent: "add-machine",
      machineName: "Prusa MK4",
      machineCategoryId: "cat-1",
      newCategoryName: "",
    },
    "add-cert": {
      intent: "add-cert",
      certName: "Laser Safety",
      certDescription: "",
    },
    "link-requirement": {
      intent: "link-requirement",
      requirementMachineId: "m1",
      requirementCertId: "c1",
    },
    "delete-student": { intent: "delete-student", id: "x1" },
    "delete-machine": { intent: "delete-machine", id: "x1" },
    "delete-cert": { intent: "delete-cert", id: "x1" },
    "edit-student": {
      intent: "edit-student",
      id: "s1",
      editFullName: "  Maria Sanchez-Ruiz ",
      editNsheId: "2001234567",
      editStudentEmail: "Maria.Sanchez@UNLV.nevada.edu",
    },
    "edit-machine": {
      intent: "edit-machine",
      id: "m1",
      editMachineName: "Prusa MK4S",
      editMachineCategoryId: "cat-1",
      editMachineActive: "on",
    },
    "edit-cert": {
      intent: "edit-cert",
      id: "c1",
      editCertName: "Laser Safety II",
      editCertDescription: "",
    },
    "award-cert": {
      intent: "award-cert",
      studentId: "s1",
      awardCertId: "c1",
    },
    "revoke-cert": {
      intent: "revoke-cert",
      studentId: "s1",
      revokeCertId: "c1",
    },
  };

  describe("access control", () => {
    it.each(Object.keys(forms))("rejects signed-out posts: %s", async (key) => {
      vi.spyOn(sessionModule, "getUser").mockResolvedValue(null);

      await expect(run(forms[key])).rejects.toMatchObject({ status: 302 });
      expectNoWrites();
    });

    it.each(Object.keys(forms))(
      "rejects users without an allowed role: %s",
      async (key) => {
        vi.spyOn(sessionModule, "getUser").mockResolvedValue(
          makeUser({ roles: "guest" }),
        );

        await expect(run(forms[key])).rejects.toMatchObject({ status: 403 });
        expectNoWrites();
      },
    );

    it("rejects an unknown intent", async () => {
      asStaff();
      const res = await run({ intent: "drop-everything" });

      expect(res.status).toBe(400);
      expect((await bodyOf(res)).errors).toHaveProperty("form");
      expectNoWrites();
    });
  });

  describe("add student", () => {
    it("returns field errors for bad input", async () => {
      asStaff();
      const res = await run({ ...forms["add-student"], nsheId: "123" });

      expect(res.status).toBe(400);
      expect((await bodyOf(res)).errors).toHaveProperty("nsheId");
      expectNoWrites();
    });

    it("creates the student with trimmed, lowercased values", async () => {
      asStaff();
      const res = await run(forms["add-student"]);

      expect(await bodyOf(res)).toMatchObject({ ok: "add-student" });
      expect(db.student.create).toHaveBeenCalledWith({
        data: {
          name: "Jane Smith",
          nsheId: "2001112223",
          rebelCardId: "1001112223",
          email: "jane.smith@unlv.nevada.edu",
        },
      });
    });

    it("creates a student without a RebelCard ID (stored as null)", async () => {
      asStaff();
      const res = await run({ ...forms["add-student"], rebelCardId: "" });

      expect(await bodyOf(res)).toMatchObject({ ok: "add-student" });
      expect(db.student.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ rebelCardId: null }),
      });
    });

    it("accepts a 14-digit library barcode as the card", async () => {
      asStaff();
      await run({ ...forms["add-student"], rebelCardId: "21234567890123" });

      expect(db.student.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ rebelCardId: "21234567890123" }),
      });
    });

    it("rejects a card containing non-digits", async () => {
      asStaff();
      const res = await run({ ...forms["add-student"], rebelCardId: "12ab" });

      expect(res.status).toBe(400);
      expect((await bodyOf(res)).errors).toHaveProperty("rebelCardId");
      expectNoWrites();
    });

    it("rejects a name that is too long", async () => {
      asStaff();
      const res = await run({
        ...forms["add-student"],
        fullName: "x".repeat(101),
      });

      expect(res.status).toBe(400);
      expect((await bodyOf(res)).errors).toHaveProperty("fullName");
      expectNoWrites();
    });

    it.each([
      ["nsheId", "nsheId"],
      ["rebelCardId", "rebelCardId"],
      ["email", "studentEmail"],
    ])("reports a duplicate %s on the right field", async (column, field) => {
      asStaff();
      db.student.create.mockRejectedValue({
        code: "P2002",
        meta: { target: [column] },
      });
      const res = await run(forms["add-student"]);

      expect(res.status).toBe(400);
      expect((await bodyOf(res)).errors[field]).toMatch(/already exists/);
    });

    it("rethrows unexpected database errors", async () => {
      asStaff();
      db.student.create.mockRejectedValue(new Error("db down"));

      await expect(run(forms["add-student"])).rejects.toThrow("db down");
    });
  });

  describe("link card", () => {
    const withExistingCard = () =>
      db.student.findUnique.mockResolvedValue({
        name: "Maria Sanchez",
        rebelCardId: "1001234567",
      });

    it("links a card to a student who has none", async () => {
      asStaff();
      const res = await run(forms["link-card"]);

      expect(await bodyOf(res)).toMatchObject({ ok: "link-card" });
      expect(db.student.update).toHaveBeenCalledWith({
        where: { nsheId: "2001112223" },
        data: { rebelCardId: "21234567890123" },
      });
    });

    it("returns field errors for bad input", async () => {
      asStaff();
      const res = await run({
        ...forms["link-card"],
        linkNsheId: "12",
        newRebelCardId: "abc",
      });

      expect(res.status).toBe(400);
      const { errors } = await bodyOf(res);
      expect(errors).toHaveProperty("linkNsheId");
      expect(errors).toHaveProperty("newRebelCardId");
      expectNoWrites();
    });

    it("rejects linking when no student has that NSHE ID", async () => {
      asStaff();
      db.student.findUnique.mockResolvedValue(null);
      const res = await run(forms["link-card"]);

      expect(res.status).toBe(400);
      expect((await bodyOf(res)).errors.linkNsheId).toMatch(/No student/);
      expectNoWrites();
    });

    it("asks for confirmation before replacing an existing card", async () => {
      asStaff();
      withExistingCard();
      const res = await run(forms["link-card"]);

      expect(res.status).toBe(409);
      expect(await bodyOf(res)).toMatchObject({
        ok: null,
        overwrite: { name: "Maria Sanchez", currentCard: "1001234567" },
      });
      expectNoWrites();
    });

    it("replaces the card once the exact old card is confirmed", async () => {
      asStaff();
      withExistingCard();
      const res = await run({
        ...forms["link-card"],
        confirmOverwrite: "1001234567",
      });

      expect(await bodyOf(res)).toMatchObject({ ok: "link-card" });
      expect(db.student.update).toHaveBeenCalledTimes(1);
    });

    it("does not accept a confirmation for a different card", async () => {
      asStaff();
      withExistingCard();
      const res = await run({
        ...forms["link-card"],
        confirmOverwrite: "9999999999",
      });

      expect(res.status).toBe(409);
      expectNoWrites();
    });

    it("rejects linking the card the student already has", async () => {
      asStaff();
      db.student.findUnique.mockResolvedValue({
        name: "Maria Sanchez",
        rebelCardId: "21234567890123",
      });
      const res = await run(forms["link-card"]);

      expect(res.status).toBe(400);
      expect((await bodyOf(res)).errors).toHaveProperty("newRebelCardId");
      expectNoWrites();
    });

    it("rejects a card that is already assigned to another student", async () => {
      asStaff();
      db.student.update.mockRejectedValue({
        code: "P2002",
        meta: { target: ["rebelCardId"] },
      });
      const res = await run(forms["link-card"]);

      expect(res.status).toBe(400);
      expect((await bodyOf(res)).errors.newRebelCardId).toMatch(
        /already assigned/,
      );
    });

    it("rethrows unexpected database errors", async () => {
      asStaff();
      db.student.update.mockRejectedValue(new Error("db down"));

      await expect(run(forms["link-card"])).rejects.toThrow("db down");
    });
  });

  describe("add machine", () => {
    it("creates a machine in an existing category", async () => {
      asStaff();
      const res = await run(forms["add-machine"]);

      expect(await bodyOf(res)).toMatchObject({ ok: "add-machine" });
      expect(db.machine.create).toHaveBeenCalledWith({
        data: { name: "Prusa MK4", categoryId: "cat-1" },
      });
      expect(db.machineCategory.create).not.toHaveBeenCalled();
    });

    it("requires a category from the list or a new one", async () => {
      asStaff();
      const res = await run({ ...forms["add-machine"], machineCategoryId: "" });

      expect(res.status).toBe(400);
      expect((await bodyOf(res)).errors).toHaveProperty("machineCategoryId");
      expectNoWrites();
    });

    it("requires a machine name", async () => {
      asStaff();
      const res = await run({ ...forms["add-machine"], machineName: "  " });

      expect(res.status).toBe(400);
      expect((await bodyOf(res)).errors).toHaveProperty("machineName");
      expectNoWrites();
    });

    it("creates a new category (next sort order) and uses it", async () => {
      asStaff();
      const res = await run({
        ...forms["add-machine"],
        machineCategoryId: "",
        newCategoryName: "  Woodworking ",
      });

      expect(await bodyOf(res)).toMatchObject({ ok: "add-machine" });
      expect(db.machineCategory.create).toHaveBeenCalledWith({
        data: { name: "Woodworking", sortOrder: 4 },
        select: { id: true },
      });
      expect(db.machine.create).toHaveBeenCalledWith({
        data: { name: "Prusa MK4", categoryId: "cat-new" },
      });
    });

    it("prefers a typed category over the dropdown", async () => {
      asStaff();
      await run({ ...forms["add-machine"], newCategoryName: "Woodworking" });

      expect(db.machine.create).toHaveBeenCalledWith({
        data: { name: "Prusa MK4", categoryId: "cat-new" },
      });
    });

    it("reuses an existing category when the typed name matches ignoring case", async () => {
      asStaff();
      db.machineCategory.findFirst.mockResolvedValue({ id: "cat-existing" });
      await run({
        ...forms["add-machine"],
        machineCategoryId: "",
        newCategoryName: "laser cutting",
      });

      expect(db.machineCategory.findFirst).toHaveBeenCalledWith({
        where: { name: { equals: "laser cutting", mode: "insensitive" } },
        select: { id: true },
      });
      expect(db.machineCategory.create).not.toHaveBeenCalled();
      expect(db.machine.create).toHaveBeenCalledWith({
        data: { name: "Prusa MK4", categoryId: "cat-existing" },
      });
    });

    it("reports a category created at the same moment by someone else", async () => {
      asStaff();
      db.machineCategory.create.mockRejectedValue({
        code: "P2002",
        meta: { target: ["name"] },
      });
      const res = await run({
        ...forms["add-machine"],
        machineCategoryId: "",
        newCategoryName: "Woodworking",
      });

      expect(res.status).toBe(400);
      expect((await bodyOf(res)).errors).toHaveProperty("newCategoryName");
      expect(db.machine.create).not.toHaveBeenCalled();
    });

    it("reports a duplicate machine name", async () => {
      asStaff();
      db.machine.create.mockRejectedValue({
        code: "P2002",
        meta: { target: ["name"] },
      });
      const res = await run(forms["add-machine"]);

      expect(res.status).toBe(400);
      expect((await bodyOf(res)).errors.machineName).toMatch(/already exists/);
    });

    it("reports a category that no longer exists", async () => {
      asStaff();
      db.machine.create.mockRejectedValue({ code: "P2003" });
      const res = await run(forms["add-machine"]);

      expect(res.status).toBe(400);
      expect((await bodyOf(res)).errors).toHaveProperty("machineCategoryId");
    });
  });

  describe("add certification", () => {
    it("creates a certification, storing a blank description as null", async () => {
      asStaff();
      const res = await run(forms["add-cert"]);

      expect(await bodyOf(res)).toMatchObject({ ok: "add-cert" });
      expect(db.certification.create).toHaveBeenCalledWith({
        data: { name: "Laser Safety", description: null },
      });
    });

    it("stores a trimmed description", async () => {
      asStaff();
      await run({ ...forms["add-cert"], certDescription: "  Basics  " });

      expect(db.certification.create).toHaveBeenCalledWith({
        data: { name: "Laser Safety", description: "Basics" },
      });
    });

    it("requires a name", async () => {
      asStaff();
      const res = await run({ ...forms["add-cert"], certName: "" });

      expect(res.status).toBe(400);
      expect((await bodyOf(res)).errors).toHaveProperty("certName");
      expectNoWrites();
    });

    it("rejects a description that is too long", async () => {
      asStaff();
      const res = await run({
        ...forms["add-cert"],
        certDescription: "x".repeat(501),
      });

      expect(res.status).toBe(400);
      expect((await bodyOf(res)).errors).toHaveProperty("certDescription");
      expectNoWrites();
    });

    it("reports a duplicate certification name", async () => {
      asStaff();
      db.certification.create.mockRejectedValue({
        code: "P2002",
        meta: { target: ["name"] },
      });
      const res = await run(forms["add-cert"]);

      expect(res.status).toBe(400);
      expect((await bodyOf(res)).errors.certName).toMatch(/already exists/);
    });
  });

  // The scanner looks a scan up as a card number first, then as an NSHE ID, so
  // a card number must never equal a different student's NSHE ID.
  describe("scan-number clashes", () => {
    it("rejects a new student whose card is another student's NSHE ID", async () => {
      asStaff();
      db.student.findFirst.mockResolvedValueOnce({ id: "other" });
      const res = await run({
        ...forms["add-student"],
        rebelCardId: "2009999999",
      });

      expect(res.status).toBe(400);
      expect((await bodyOf(res)).errors.rebelCardId).toMatch(/NSHE ID/);
      expectNoWrites();
    });

    it("rejects a new student whose NSHE ID is another student's card", async () => {
      asStaff();
      // first lookup (card vs NSHE) finds nothing, second (NSHE vs card) hits
      db.student.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: "other" });
      const res = await run(forms["add-student"]);

      expect(res.status).toBe(400);
      expect((await bodyOf(res)).errors.nsheId).toMatch(/RebelCard/);
      expectNoWrites();
    });

    it("allows a card equal to the student's own NSHE ID", async () => {
      asStaff();
      const res = await run({
        ...forms["add-student"],
        nsheId: "2001112223",
        rebelCardId: "2001112223",
      });

      expect(await bodyOf(res)).toMatchObject({ ok: "add-student" });
      // only the "NSHE ID vs other cards" lookup runs for a self-card
      expect(db.student.findFirst).toHaveBeenCalledTimes(1);
    });

    it("rejects linking a card that is another student's NSHE ID", async () => {
      asStaff();
      db.student.findFirst.mockResolvedValue({ id: "other" });
      const res = await run(forms["link-card"]);

      expect(res.status).toBe(400);
      expect((await bodyOf(res)).errors.newRebelCardId).toMatch(/NSHE ID/);
      expect(db.student.findFirst).toHaveBeenCalledWith({
        where: { nsheId: "21234567890123", NOT: { id: "s1" } },
        select: { id: true },
      });
      expectNoWrites();
    });
  });

  describe("edit student", () => {
    it("saves trimmed, lowercased values without touching the card", async () => {
      asStaff();
      const res = await run(forms["edit-student"]);

      expect(await bodyOf(res)).toMatchObject({ ok: "edit-student" });
      expect(db.student.update).toHaveBeenCalledWith({
        where: { id: "s1" },
        data: {
          name: "Maria Sanchez-Ruiz",
          nsheId: "2001234567",
          email: "maria.sanchez@unlv.nevada.edu",
        },
      });
    });

    it("returns errors against the edited row for bad input", async () => {
      asStaff();
      const res = await run({
        ...forms["edit-student"],
        editFullName: "",
        editNsheId: "12",
        editStudentEmail: "nope",
      });

      expect(res.status).toBe(400);
      const body = await bodyOf(res);
      expect(body.target).toBe("s1");
      expect(body.errors).toHaveProperty("editFullName");
      expect(body.errors).toHaveProperty("editNsheId");
      expect(body.errors).toHaveProperty("editStudentEmail");
      expectNoWrites();
    });

    it("rejects an NSHE ID that matches another student's card", async () => {
      asStaff();
      db.student.findFirst.mockResolvedValue({ id: "other" });
      const res = await run(forms["edit-student"]);

      expect(res.status).toBe(400);
      expect((await bodyOf(res)).errors).toHaveProperty("editNsheId");
      expectNoWrites();
    });

    it.each([
      ["nsheId", "editNsheId"],
      ["email", "editStudentEmail"],
    ])("reports a duplicate %s on the right field", async (column, field) => {
      asStaff();
      db.student.update.mockRejectedValue({
        code: "P2002",
        meta: { target: [column] },
      });
      const res = await run(forms["edit-student"]);

      expect(res.status).toBe(400);
      expect((await bodyOf(res)).errors[field]).toMatch(/already exists/);
    });

    it("reports a student that was deleted meanwhile", async () => {
      asStaff();
      db.student.update.mockRejectedValue({ code: "P2025" });
      const res = await run(forms["edit-student"]);

      expect(res.status).toBe(400);
      expect(await bodyOf(res)).toMatchObject({
        target: "s1",
        errors: { manage: expect.stringMatching(/no longer exists/) },
      });
    });
  });

  describe("edit machine", () => {
    it("saves the name, category and active flag", async () => {
      asStaff();
      const res = await run(forms["edit-machine"]);

      expect(await bodyOf(res)).toMatchObject({ ok: "edit-machine" });
      expect(db.machine.update).toHaveBeenCalledWith({
        where: { id: "m1" },
        data: { name: "Prusa MK4S", categoryId: "cat-1", isActive: true },
      });
    });

    it("treats a missing checkbox as inactive", async () => {
      asStaff();
      // A browser sends nothing for an unchecked checkbox.
      const unchecked = { ...forms["edit-machine"] };
      delete unchecked.editMachineActive;
      await run(unchecked);

      expect(db.machine.update).toHaveBeenCalledWith({
        where: { id: "m1" },
        data: expect.objectContaining({ isActive: false }),
      });
    });

    it("requires a name and a category", async () => {
      asStaff();
      const res = await run({
        ...forms["edit-machine"],
        editMachineName: "",
        editMachineCategoryId: "",
      });

      expect(res.status).toBe(400);
      const { errors } = await bodyOf(res);
      expect(errors).toHaveProperty("editMachineName");
      expect(errors).toHaveProperty("editMachineCategoryId");
      expectNoWrites();
    });

    it("reports a duplicate name, a missing category and a missing machine", async () => {
      asStaff();

      db.machine.update.mockRejectedValueOnce({ code: "P2002" });
      let body = await bodyOf(await run(forms["edit-machine"]));
      expect(body.errors.editMachineName).toMatch(/already exists/);

      db.machine.update.mockRejectedValueOnce({ code: "P2003" });
      body = await bodyOf(await run(forms["edit-machine"]));
      expect(body.errors).toHaveProperty("editMachineCategoryId");

      db.machine.update.mockRejectedValueOnce({ code: "P2025" });
      body = await bodyOf(await run(forms["edit-machine"]));
      expect(body.errors).toHaveProperty("manage");
    });
  });

  describe("edit certification", () => {
    it("saves the name, storing a blank description as null", async () => {
      asStaff();
      const res = await run(forms["edit-cert"]);

      expect(await bodyOf(res)).toMatchObject({ ok: "edit-cert" });
      expect(db.certification.update).toHaveBeenCalledWith({
        where: { id: "c1" },
        data: { name: "Laser Safety II", description: null },
      });
    });

    it("requires a name", async () => {
      asStaff();
      const res = await run({ ...forms["edit-cert"], editCertName: " " });

      expect(res.status).toBe(400);
      expect((await bodyOf(res)).errors).toHaveProperty("editCertName");
      expectNoWrites();
    });

    it("reports a duplicate name and a missing certification", async () => {
      asStaff();

      db.certification.update.mockRejectedValueOnce({ code: "P2002" });
      let body = await bodyOf(await run(forms["edit-cert"]));
      expect(body.errors.editCertName).toMatch(/already exists/);

      db.certification.update.mockRejectedValueOnce({ code: "P2025" });
      body = await bodyOf(await run(forms["edit-cert"]));
      expect(body.errors).toHaveProperty("manage");
    });
  });

  describe("award and remove a student's certification", () => {
    it("awards the certification and records who awarded it", async () => {
      asStaff();
      const res = await run(forms["award-cert"]);

      expect(await bodyOf(res)).toMatchObject({ ok: "award-cert" });
      expect(db.studentCertification.create).toHaveBeenCalledWith({
        data: {
          studentId: "s1",
          certificationId: "c1",
          awardedById: "user-1",
        },
      });
    });

    it("requires a certification to be chosen", async () => {
      asStaff();
      const res = await run({ ...forms["award-cert"], awardCertId: "" });

      expect(res.status).toBe(400);
      expect(await bodyOf(res)).toMatchObject({
        target: "s1",
        errors: { awardCertId: expect.any(String) },
      });
      expectNoWrites();
    });

    it("reports a certification the student already holds", async () => {
      asStaff();
      db.studentCertification.create.mockRejectedValue({
        code: "P2002",
        meta: { target: ["studentId", "certificationId"] },
      });
      const res = await run(forms["award-cert"]);

      expect(res.status).toBe(400);
      expect((await bodyOf(res)).errors.awardCertId).toMatch(/already has/);
    });

    it("reports a student or certification deleted meanwhile", async () => {
      asStaff();
      db.studentCertification.create.mockRejectedValue({ code: "P2003" });
      const res = await run(forms["award-cert"]);

      expect(res.status).toBe(400);
      expect((await bodyOf(res)).errors).toHaveProperty("manage");
    });

    it("removes a certification using the student/certification key", async () => {
      asStaff();
      const res = await run(forms["revoke-cert"]);

      expect(await bodyOf(res)).toMatchObject({ ok: "revoke-cert" });
      expect(db.studentCertification.delete).toHaveBeenCalledWith({
        where: {
          studentId_certificationId: { studentId: "s1", certificationId: "c1" },
        },
      });
    });

    it("treats an already-removed certification as success", async () => {
      asStaff();
      db.studentCertification.delete.mockRejectedValue({ code: "P2025" });
      const res = await run(forms["revoke-cert"]);

      expect(res.status).toBe(200);
      expect(await bodyOf(res)).toMatchObject({ ok: "revoke-cert" });
    });

    it("rejects removing without both ids", async () => {
      asStaff();
      const res = await run({ ...forms["revoke-cert"], revokeCertId: "" });

      expect(res.status).toBe(400);
      expectNoWrites();
    });
  });

  describe("delete", () => {
    const deletes = [
      ["delete-student", db.student.delete],
      ["delete-machine", db.machine.delete],
      ["delete-cert", db.certification.delete],
    ] as const;

    const asRole = (roles: string) =>
      vi.spyOn(sessionModule, "getUser").mockResolvedValue(makeUser({ roles }));

    it.each(deletes)("forbids staff from %s", async (intent, remove) => {
      asRole("staff");

      await expect(run(forms[intent])).rejects.toMatchObject({ status: 403 });
      expect(remove).not.toHaveBeenCalled();
    });

    it.each(deletes)("lets an admin %s", async (intent, remove) => {
      asRole("admin");
      const res = await run(forms[intent]);

      expect(await bodyOf(res)).toMatchObject({ ok: intent });
      expect(remove).toHaveBeenCalledWith({ where: { id: "x1" } });
    });

    it.each(deletes)("lets a super admin %s", async (intent, remove) => {
      asRole("super admin");
      const res = await run(forms[intent]);

      expect(await bodyOf(res)).toMatchObject({ ok: intent });
      expect(remove).toHaveBeenCalledTimes(1);
    });

    it.each(deletes)("rejects %s without an id", async (intent, remove) => {
      asRole("admin");
      const res = await run({ intent, id: "  " });

      expect(res.status).toBe(400);
      expect((await bodyOf(res)).errors).toHaveProperty("delete");
      expect(remove).not.toHaveBeenCalled();
    });

    it.each(deletes)(
      "treats an already-deleted row as success for %s",
      async (intent, remove) => {
        asRole("admin");
        remove.mockRejectedValue({ code: "P2025" });
        const res = await run(forms[intent]);

        expect(res.status).toBe(200);
        expect(await bodyOf(res)).toMatchObject({ ok: intent });
      },
    );

    it.each(deletes)(
      "rethrows unexpected database errors for %s",
      async (intent, remove) => {
        asRole("admin");
        remove.mockRejectedValue(new Error("db down"));

        await expect(run(forms[intent])).rejects.toThrow("db down");
      },
    );
  });

  describe("link certification to machine", () => {
    it("creates the requirement", async () => {
      asStaff();
      const res = await run(forms["link-requirement"]);

      expect(await bodyOf(res)).toMatchObject({ ok: "link-requirement" });
      expect(db.machineRequirement.create).toHaveBeenCalledWith({
        data: { machineId: "m1", certificationId: "c1" },
      });
    });

    it("requires both a machine and a certification", async () => {
      asStaff();
      const res = await run({
        intent: "link-requirement",
        requirementMachineId: "",
        requirementCertId: "",
      });

      expect(res.status).toBe(400);
      const { errors } = await bodyOf(res);
      expect(errors).toHaveProperty("requirementMachineId");
      expect(errors).toHaveProperty("requirementCertId");
      expectNoWrites();
    });

    it("reports a requirement that already exists", async () => {
      asStaff();
      db.machineRequirement.create.mockRejectedValue({
        code: "P2002",
        meta: { target: ["machineId", "certificationId"] },
      });
      const res = await run(forms["link-requirement"]);

      expect(res.status).toBe(400);
      expect((await bodyOf(res)).errors.requirementCertId).toMatch(
        /already requires/,
      );
    });

    it("reports a machine or certification that no longer exists", async () => {
      asStaff();
      db.machineRequirement.create.mockRejectedValue({ code: "P2003" });
      const res = await run(forms["link-requirement"]);

      expect(res.status).toBe(400);
      expect((await bodyOf(res)).errors).toHaveProperty("requirementMachineId");
    });
  });
});
