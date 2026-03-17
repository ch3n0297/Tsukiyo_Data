import { toErrorResponse } from "../lib/errors.js";
import { readJsonRequest, sendJson } from "../lib/http.js";
import { verifySignedRequest } from "../services/auth-service.js";
import { validateScheduledSyncPayload } from "../services/validation-service.js";

export async function handleInternalScheduledSyncRoute({ req, res, services, config }) {
  try {
    const { rawBody, body } = await readJsonRequest(req);
    verifySignedRequest({
      headers: req.headers,
      rawBody,
      sharedSecret: config.sharedSecret,
      allowedClientIds: config.allowedClientIds,
      signatureTtlMs: config.signatureTtlMs,
      clock: config.clock,
    });

    const payload = validateScheduledSyncPayload(body);
    const result = await services.scheduledSyncService.enqueueAllActiveAccounts({
      requestedBy: payload.requestedBy,
    });

    sendJson(res, 202, {
      accepted_jobs: result.acceptedJobs,
      skipped_accounts: result.skippedAccounts,
    });
  } catch (error) {
    const response = toErrorResponse(error);
    sendJson(res, response.statusCode, response.body);
  }
}
