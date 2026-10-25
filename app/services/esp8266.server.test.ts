import { afterEach, describe, expect, it, vi } from "vitest";

//updates to send commands
import { getSatelliteStatus, sendSatelliteCommand } from "./esp8266.server";

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

// Ping command test
describe("ESP8266 satellite commands", () => {
  it("sends a PING command and receives an acknowledgment", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        message: "PING received",
      }),
    });

    vi.stubGlobal("fetch", mockFetch);

    const result = await sendSatelliteCommand(
      "http://192.168.0.169",
      "PING",
      "test-api-key",
    );

    expect(result).toEqual({
      success: true,
      message: "PING received",
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "http://192.168.0.169/command",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": "test-api-key",
        },
        body: JSON.stringify({ command: "PING" }),
      }),
    );
  });

  it("rejects an HTTP error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
      }),
    );

    await expect(
      sendSatelliteCommand("http://192.168.0.169", "PING", "test-api-key"),
    ).rejects.toThrow("Satellite returned HTTP 400");
  });

  it("rejects an invalid command acknowledgment", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          success: false,
          message: "PING received",
        }),
      }),
    );

    await expect(
      sendSatelliteCommand("http://192.168.0.169", "PING", "test-api-key"),
    ).rejects.toThrow("Invalid satellite command response");
  });

  it("handles a disconnected satellite", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network unreachable")),
    );

    await expect(
      sendSatelliteCommand("http://192.168.0.169", "PING", "test-api-key"),
    ).rejects.toThrow("Network unreachable");
  });
});
