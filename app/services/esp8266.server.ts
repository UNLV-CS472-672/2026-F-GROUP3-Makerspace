interface SatelliteStatus {
  status: "online";
  device: string;
}

export async function getSatelliteStatus(
  satelliteUrl: string,
): Promise<SatelliteStatus> {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 3000);

  try {
    const response = await fetch(`${satelliteUrl.replace(/\/$/, "")}/status`, {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Satellite returned HTTP ${response.status}`);
    }

    const data: unknown = await response.json();

    if (
      typeof data !== "object" ||
      data === null ||
      !("status" in data) ||
      data.status !== "online" ||
      !("device" in data) ||
      typeof data.device !== "string"
    ) {
      throw new Error("Invalid satellite response");
    }

    return {
      status: "online",
      device: data.device,
    };
  } finally {
    clearTimeout(timeout);
  }
}
