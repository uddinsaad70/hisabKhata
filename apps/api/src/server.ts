// apps/api/src/server.ts
import { app, logger } from "./app.js";
import { env } from "./config/env.js";

const server = app.listen(env.PORT, () => {
  logger.info(
    `HisabKhata Sync API listening on http://localhost:${env.PORT} [${env.NODE_ENV}]`,
  );
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, closing HTTP server...");
  server.close(() => {
    process.exit(0);
  });
});
