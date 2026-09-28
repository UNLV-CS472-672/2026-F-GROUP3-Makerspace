import prom from "@isaacs/express-prometheus-middleware";
import { createRequestHandler } from "@remix-run/express";
import { installGlobals } from "@remix-run/node";
import compression from "compression";
import express from "express";
import morgan from "morgan";
import sourceMapSupport from "source-map-support";

sourceMapSupport.install();
installGlobals();

async function run() {
  const isProduction = process.env.NODE_ENV === "production";

  const viteDevServer = isProduction
    ? undefined
    : await import("vite").then((vite) =>
        vite.createServer({
          server: {
            middlewareMode: true,
          },
        }),
      );

  const app = express();
  const metricsApp = express();

  app.use(
    prom({
      metricsPath: "/metrics",
      collectDefaultMetrics: true,
      metricsApp,
    }),
  );

  //
  // Keep your existing Fly middleware here.
  //
  // x-fly-region
  // HSTS
  // clean URL redirects
  // fly-replay handling
  //

  app.use(compression());
  app.disable("x-powered-by");

  if (viteDevServer) {
    //
    // Development assets + HMR.
    //
    app.use(viteDevServer.middlewares);
  } else {
    //
    // Production assets.
    //
    app.use(
      "/assets",
      express.static("build/client/assets", {
        immutable: true,
        maxAge: "1y",
      }),
    );

    app.use(
      express.static("build/client", {
        maxAge: "1h",
      }),
    );
  }

  app.use(morgan("tiny"));
  const productionBuildPath = "./build/server/index.js";

  const build = viteDevServer
    ? () => viteDevServer.ssrLoadModule("virtual:remix/server-build")
    : await import(productionBuildPath);

  app.all(
    "*",
    createRequestHandler({
      build,
    }),
  );

  const port = Number(process.env.PORT || 3000);

  app.listen(port, () => {
    console.log(`✅ app ready: http://localhost:${port}`);
  });

  const metricsPort = Number(process.env.METRICS_PORT || 3010);

  metricsApp.listen(metricsPort, () => {
    console.log(`✅ metrics ready: http://localhost:${metricsPort}/metrics`);
  });
}

run();
