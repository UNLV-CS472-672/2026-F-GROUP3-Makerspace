import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LoaderFunctionArgs } from "@remix-run/node";

vi.mock("~/session.server", () => ({
  getUser: vi.fn(),
}));

import { loader } from "./admin";
import { getUser } from "~/session.server";

function makeRequest(url = "https://example.com/admin") {
  return {
    request: new Request(url),
    params: {},
    context: {},
  } as unknown as LoaderFunctionArgs;
}

describe("admin route auth gate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("redirects unauthenticated users to login", async () => {
    vi.mocked(getUser).mockResolvedValue(null);

    const response = await loader(makeRequest());

    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("/login");
  });

  it("throws a 403 for authenticated non-admin users", async () => {
    vi.mocked(getUser).mockResolvedValue({
      id: "user-123",
      email: "student@unlv.nevada.edu",
      roles: "staff",
    });

    await expect(loader(makeRequest())).rejects.toMatchObject({
      status: 403,
    });
  });

  it("allows authenticated admin users", async () => {
    vi.mocked(getUser).mockResolvedValue({
      id: "admin-123",
      email: "admin@unlv.nevada.edu",
      roles: "admin",
    });

    const result = await loader(makeRequest());

    expect(result).toMatchObject({
      success: true,
      user: {
        id: "admin-123",
        email: "admin@unlv.nevada.edu",
      },
    });
  });
});