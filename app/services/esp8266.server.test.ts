import { afterEach, describe, expect, it, vi } from "vitest";

import { getSatelliteStatus } from "./esp8266.server";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ESP8266 satellite communication", () => {
  it("returns the satellite status when online", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "online",
        device: "makerspace-satellite",
      }),
    });

    vi.stubGlobal("fetch", mockFetch);

    const result = await getSatelliteStatus("http://192.168.0.169");

    expect(result).toEqual({
      status: "online",
      device: "makerspace-satellite",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.0.169/status",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("rejects an HTTP error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );

    await expect(getSatelliteStatus("http://192.168.0.169")).rejects.toThrow(
      "Satellite returned HTTP 500",
    );
  });

  it("rejects invalid satellite data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: "unknown" }),
      }),
    );

    await expect(getSatelliteStatus("http://192.168.0.169")).rejects.toThrow(
      "Invalid satellite response",
    );
  });

  it("handles a disconnected satellite", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network unreachable")),
    );

    await expect(getSatelliteStatus("http://192.168.0.169")).rejects.toThrow(
      "Network unreachable",
    );
  });
});
