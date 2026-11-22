import { type LoaderFunctionArgs } from "@remix-run/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The database is mocked, so these tests never touch a real Postgres.
const db = vi.hoisted(() => ({
  student: { findUnique: vi.fn() },
  machine: { findMany: vi.fn() },
}));
vi.mock("~/db.server", () => ({ prisma: db }));

import { loader } from "./results.$nsheId";

const run = (nsheId?: string) =>
  loader({ params: { nsheId } } as unknown as LoaderFunctionArgs);

const laserSafety = {
  certificationId: "c1",
  certification: { id: "c1", name: "Laser Safety" },
};

describe("results loader", () => {
  beforeEach(() => {
    db.student.findUnique.mockReset();
    db.machine.findMany.mockReset();
    db.student.findUnique.mockResolvedValue({
      name: "Maria Sanchez",
      certifications: [laserSafety],
    });
    db.machine.findMany.mockResolvedValue([]);
  });

  it("only considers machines that are in service", async () => {
    await run("2001234567");

    expect(db.machine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } }),
    );
  });

  it("offers the machines whose requirements the student has", async () => {
    db.machine.findMany.mockResolvedValue([
      { id: "m1", name: "Laser", requirements: [laserSafety] },
      {
        id: "m2",
        name: "Welder",
        requirements: [
          {
            certification: { id: "c2", name: "Welding" },
            certificationId: "c2",
          },
        ],
      },
      { id: "m3", name: "Open bench", requirements: [] },
    ]);

    const result = await run("2001234567");

    expect(result).toMatchObject({
      useAbleMachines: [{ name: "Laser" }, { name: "Open bench" }],
    });
  });

  it("reports an unknown NSHE ID", async () => {
    db.student.findUnique.mockResolvedValue(null);

    expect(await run("2000000000")).toEqual({
      error: "NSHE Id not found linked to a student",
    });
    expect(db.machine.findMany).not.toHaveBeenCalled();
  });

  it("reports a missing NSHE ID", async () => {
    expect(await run(undefined)).toEqual({ error: "Missing NSHE ID" });
    expect(db.student.findUnique).not.toHaveBeenCalled();
  });
});
