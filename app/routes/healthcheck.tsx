import { prisma } from "~/db.server";

export const loader = async () => {
  try {
    // Readiness depends on the database, not on an HTTP request back into this
    // same process. A self-request can deadlock a single-worker deployment and
    // can be misdirected by forwarded Host headers.
    await prisma.$queryRaw`SELECT 1`;
    return new Response("OK", {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error: unknown) {
    console.error("Healthcheck database probe failed", error);
    return new Response("ERROR", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
};
