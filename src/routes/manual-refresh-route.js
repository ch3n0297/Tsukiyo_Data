import { toErrorResponse } from "../lib/errors.js";
import { readJsonRequest, sendJson } from "../lib/http.js";
import { verifySignedRequest } from "../services/auth-service.js";

export async function handleManualRefreshRoute({ req, res, services, config }) {
  try {
    const { rawBody, body } = await readJsonRequest(req);
    const auth = verifySignedRequest({
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
      system_message: "Manual refresh request accepted.",
    });
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}
