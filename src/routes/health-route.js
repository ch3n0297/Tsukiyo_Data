import { sendJson } from "../lib/http.js";

export async function handleHealthRoute({ res, services, config }) {
  sendJson(res, 200, {
    status: "ok",
    queue: services.jobQueue.snapshot(),
    scheduler: services.schedulerService.snapshot(),
    now: config.clock().toISOString(),
  });
}
