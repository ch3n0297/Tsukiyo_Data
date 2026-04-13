import { toErrorResponse } from "../lib/errors.ts";
import { readJsonRequest, sendJson } from "../lib/http.ts";
import { verifySignedRequest } from "../services/auth-service.ts";
import type { RouteContext } from "../types/route.ts";

export async function handleManualRefreshRoute({ req, res, services, config }: RouteContext): Promise<void> {
  try {
    const { rawBody, body } = await readJsonRequest(req, {
      maxBodyBytes: config.maxRequestBodyBytes,
    });
    const auth = await verifySignedRequest({
      headers: req.headers,
      rawBody,
      sharedSecret: config.sharedSecret,
      allowedClientIds: config.allowedClientIds,
      signatureTtlMs: config.signatureTtlMs,
      clock: config.clock,
    });

    const job = await services.manualRefreshService.enqueueManualRefresh({
      payload: body,
      clientId: auth.clientId,
    });

    sendJson(res, 202, {
      job_id: job.id,
      status: "queued",
      system_message: "已受理手動更新請求。",
    });
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}
