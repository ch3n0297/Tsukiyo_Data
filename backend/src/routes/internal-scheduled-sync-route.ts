import { toErrorResponse } from "../lib/errors.ts";
import { readJsonRequest, sendJson } from "../lib/http.ts";
import { verifySignedRequest } from "../services/auth-service.ts";
import { validateScheduledSyncPayload } from "../services/validation-service.ts";
import type { RouteContext } from "../types/route.ts";

export async function handleInternalScheduledSyncRoute({ req, res, services, config }: RouteContext): Promise<void> {
  try {
    const { rawBody, body } = await readJsonRequest(req, {
      maxBodyBytes: config.maxRequestBodyBytes,
    });
    await verifySignedRequest({
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
