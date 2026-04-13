import { loadConfig } from "../config.ts";
import { signPayload } from "../services/auth-service.ts";

function readBodyArgument(): string {
  const rawArgument = process.argv[2];
  if (!rawArgument) {
    return JSON.stringify({ requested_by: "quickstart" });
  }

  JSON.parse(rawArgument);
  return rawArgument;
}

function main(): void {
  const config = loadConfig();
  const clientId = config.allowedClientIds[0];
  if (!clientId) {
    throw new Error("At least one allowed client ID must be configured.");
  }

  const timestamp = config.clock().toISOString();
  const rawBody = readBodyArgument();
  const signature = signPayload({
    sharedSecret: config.sharedSecret,
    timestamp,
    rawBody,
  });

  process.stdout.write(
    JSON.stringify(
      {
        client_id: clientId,
        timestamp,
        signature,
        raw_body: rawBody,
      },
      null,
      2,
    ),
  );
  process.stdout.write("\n");
}

main();
