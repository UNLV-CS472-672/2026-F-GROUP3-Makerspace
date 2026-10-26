import { type LoaderFunctionArgs } from "@remix-run/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as sessionModule from "~/session.server";
import { loader } from "./admin";

type MockUser = {
  id: string;
  email: string;
  roles: string;
  createdAt: Date;
  updatedAt: Date;
};

const makeUser = (overrides: Partial<MockUser> = {}): MockUser => ({
  id: "user-1",
  email: "test@example.com",
  roles: "staff",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("admin loader", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects unauthenticated users to login", async () => {
    // unauthenticated user is handled before the role check
    vi.spyOn(sessionModule, "getUser").mockResolvedValue(null);

    const request = new Request("http://localhost/admin");
    const result = await loader({ request } as LoaderFunctionArgs);

    expect(result).toBeInstanceOf(Response);

    if (result instanceof Response) {
      expect(result.status).toBe(302);
      expect(result.headers.get("Location")).toBe(
        "/login?redirectTo=%2Fadmin",
      );
    }
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
    ).rejects.toThrow("Forbidden");
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
    ).rejects.toThrow("Forbidden");
  });
});