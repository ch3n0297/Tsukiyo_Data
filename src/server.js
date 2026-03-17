import { createApp } from "./app.js";

const app = await createApp();
const address = await app.start();

app.config.logger.info("Social data hub started", address);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    app.config.logger.info("Shutting down service", { signal });
    await app.stop();
    process.exit(0);
  });
}
