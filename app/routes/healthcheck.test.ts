import { beforeEach, describe, expect, it, vi } from "vitest";

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));

vi.mock("~/db.server", () => ({
  prisma: { $queryRaw: queryRaw },
}));

import { loader } from "./healthcheck";

describe("healthcheck loader", () => {
  beforeEach(() => {
    queryRaw.mockReset();
  });

  it("reports ready after a direct database probe succeeds", async () => {
    queryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const response = await loader();

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("OK");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(queryRaw.mock.calls[0][0].join("")).toBe("SELECT 1");
  });

  it("reports unavailable when the database probe fails", async () => {
    const databaseError = new Error("database unavailable");
    queryRaw.mockRejectedValue(databaseError);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await loader();

    expect(response.status).toBe(503);
    expect(await response.text()).toBe("ERROR");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(consoleError).toHaveBeenCalledWith(
      "Healthcheck database probe failed",
      databaseError,
    );
    consoleError.mockRestore();
  });
});
