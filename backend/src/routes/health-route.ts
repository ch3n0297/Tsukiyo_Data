import { sendJson } from "../lib/http.ts";
import type { RouteContext } from "../types/route.ts";

export function handleHealthRoute({ res, services, config }: RouteContext): void {
  sendJson(res, 200, {
    status: "ok",
    queue: services.jobQueue.snapshot(),
    scheduler: services.schedulerService.snapshot(),
    now: config.clock().toISOString(),
  });
}
