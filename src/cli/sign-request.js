import { loadConfig } from "../config.js";
import { signPayload } from "../services/auth-service.js";

function readBodyArgument() {
  const rawArgument = process.argv[2];
  if (!rawArgument) {
    return JSON.stringify({ requested_by: "quickstart" });
  }

  JSON.parse(rawArgument);
  return rawArgument;
}

function main() {
  const config = loadConfig();
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
        client_id: config.allowedClientIds[0],
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
