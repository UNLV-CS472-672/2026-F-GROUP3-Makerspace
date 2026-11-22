import { type ActionFunctionArgs } from "@remix-run/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The database is mocked, so these tests never touch a real Postgres.
const db = vi.hoisted(() => ({
  student: { findUnique: vi.fn(), findMany: vi.fn() },
}));
vi.mock("~/db.server", () => ({ prisma: db }));

import { action, loader } from "./_index";

const maria = { name: "Maria Sanchez", nsheId: "2001234567" };

const scan = (fields: Record<string, string>) =>
  action({
    request: new Request("http://localhost/", {
      method: "POST",
      body: new URLSearchParams(fields),
    }),
  } as ActionFunctionArgs);

describe("scanner action", () => {
  beforeEach(() => {
    db.student.findUnique.mockReset();
    db.student.findMany.mockReset();
    db.student.findUnique.mockResolvedValue(null);
    db.student.findMany.mockResolvedValue([]);
  });

  it("opens the results page for a linked card number", async () => {
    db.student.findUnique.mockResolvedValueOnce(maria);

    const res = (await scan({ rebelCardId: "1001234567" })) as Response;

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/results/2001234567");
    expect(db.student.findUnique).toHaveBeenCalledTimes(1);
    expect(db.student.findUnique).toHaveBeenCalledWith({
      where: { rebelCardId: "1001234567" },
    });
  });

  it("falls back to the NSHE ID for students with no card on file", async () => {
    // card lookup finds nothing, NSHE lookup finds the student
    db.student.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(maria);

    const res = (await scan({ rebelCardId: "2001234567" })) as Response;

    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/results/2001234567");
    expect(db.student.findUnique).toHaveBeenNthCalledWith(2, {
      where: { nsheId: "2001234567" },
    });
  });

  it("trims whitespace added by a scanner", async () => {
    db.student.findUnique.mockResolvedValueOnce(maria);

    await scan({ rebelCardId: "  1001234567\n" });

    expect(db.student.findUnique).toHaveBeenCalledWith({
      where: { rebelCardId: "1001234567" },
    });
  });

  it("reports a number that matches neither a card nor an NSHE ID", async () => {
    const result = await scan({ rebelCardId: "9999999999" });

    expect(result).toEqual({
      error: expect.stringMatching(/not recognized/),
    });
    expect(db.student.findUnique).toHaveBeenCalledTimes(2);
  });

  it.each([["   "], [""]])("rejects a blank scan (%j)", async (value) => {
    const result = await scan({ rebelCardId: value });

    expect(result).toEqual({ error: "Invalid RebelCard ID" });
    expect(db.student.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a request without the field", async () => {
    const result = await scan({});

    expect(result).toEqual({ error: "Invalid RebelCard ID" });
    expect(db.student.findUnique).not.toHaveBeenCalled();
  });
});

describe("scanner loader", () => {
  beforeEach(() => {
    db.student.findMany.mockReset();
  });

  it("only offers demo students that have a card on file", async () => {
    db.student.findMany.mockResolvedValue([
      { name: "Maria Sanchez", rebelCardId: "1001234567" },
    ]);

    const result = await loader();

    expect(db.student.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { rebelCardId: { not: null } } }),
    );
    expect(result).toEqual({
      demoStudents: [{ name: "Maria Sanchez", rebelCardId: "1001234567" }],
    });
  });
});
