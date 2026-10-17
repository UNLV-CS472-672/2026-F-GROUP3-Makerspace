import type { LoaderFunctionArgs } from "@remix-run/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Prisma queries so tests never connect to the real database.
const { findStudent, findMachines } = vi.hoisted(() => ({
  findStudent: vi.fn(),
  findMachines: vi.fn(),
}));

vi.mock("~/db.server", () => ({
  prisma: {
    student: { findUnique: findStudent },
    machine: { findMany: findMachines },
  },
}));

// Test the existing results-page backend without changing it.
import { loader } from "./routes/results.$nsheId";

// Create a test student with the supplied certifications.
function studentWithCerts(...certifications: string[]) {
  return {
    id: "student-1",
    nsheId: "1000000000",
    certifications: certifications.map((name) => ({
      certification: { name },
    })),
  };
}

// Create a test machine with certification requirements.
function machine(
  name: string,
  requiredCerts: string[],
  isActive = true,
) {
  return {
    id: name,
    name,
    isActive,
    requirements: requiredCerts.map((cert) => ({
      certification: { name: cert },
    })),
  };
}

 // Run the actual results-page loader with a test NSHE ID.
async function loadEligibilityResults(nsheId = "1000000000") {
  return loader({
    request: new Request(`http://localhost/results/${nsheId}`),
    params: { nsheId },
    context: {},
  } satisfies LoaderFunctionArgs);
}

// Clear mocked database responses before each test.
beforeEach(() => {
  vi.resetAllMocks();
});

describe("Machine certification eligibility", () => {
  it("lists a machine when the student has the required certification", async () => {
    findStudent.mockResolvedValue(studentWithCerts("Laser Safety"));
    findMachines.mockResolvedValue([
      machine("Laser Cutter", ["Laser Safety"]),
    ]);

    const result = await loadEligibilityResults();

    expect(result).toMatchObject({
      useAbleMachines: [{ name: "Laser Cutter" }],
    });
  });

  it("excludes machines when required certifications are missing", async () => {
    findStudent.mockResolvedValue(studentWithCerts("3D Printing"));
    findMachines.mockResolvedValue([
      machine("Laser Cutter", ["Laser Safety"]),
    ]);

    const result = await loadEligibilityResults();

    expect(result).toMatchObject({
      useAbleMachines: [],
    });
  });

  it("lists machines with multiple requirements when all certifications are present", async () => {
    findStudent.mockResolvedValue(
      studentWithCerts("CNC Safety", "CNC Operation"),
    );
    findMachines.mockResolvedValue([
      machine("CNC Mill", ["CNC Safety", "CNC Operation"]),
    ]);

    const result = await loadEligibilityResults();

    expect(result).toMatchObject({
      useAbleMachines: [{ name: "CNC Mill" }],
    });
  });

  it("excludes machines when any required certification is missing", async () => {
    findStudent.mockResolvedValue(studentWithCerts("CNC Safety"));
    findMachines.mockResolvedValue([
      machine("CNC Mill", ["CNC Safety", "CNC Operation"]),
    ]);

    const result = await loadEligibilityResults();

    expect(result).toMatchObject({
      useAbleMachines: [],
    });
  });

  it("lists machines with no certification requirements", async () => {
    findStudent.mockResolvedValue(studentWithCerts());
    findMachines.mockResolvedValue([
      machine("Basic Workbench", []),
    ]);

    const result = await loadEligibilityResults();

    expect(result).toMatchObject({
      useAbleMachines: [{ name: "Basic Workbench" }],
    });
  });

  it("lists only machines matching the student's certifications", async () => {
    findStudent.mockResolvedValue(studentWithCerts("3D Printing"));
    findMachines.mockResolvedValue([
      machine("3D Printer", ["3D Printing"]),
      machine("Laser Cutter", ["Laser Safety"]),
      machine("Basic Workbench", []),
    ]);

    const result = await loadEligibilityResults();

    expect(result).toMatchObject({
      useAbleMachines: [
        { name: "3D Printer" },
        { name: "Basic Workbench" },
      ],
    });
  });

  it("returns an error when the student is not found", async () => {
    findStudent.mockResolvedValue(null);

    const result = await loadEligibilityResults();

    expect(result).toEqual({
      error: "NSHE Id not found linked to a student",
    });

    expect(findMachines).not.toHaveBeenCalled();
  });

  // Future requirement:
  // Confirm with Jeff and the team whether inactive machines
  // should be excluded from the eligibility results page.
  // The current loader does not check the isActive field.
  it.todo("excludes inactive machines from eligibility results");
});
