export class HttpError extends Error {
  readonly name = "HttpError" as const;
  readonly statusCode: number;
  readonly code: string;
  readonly details: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export interface ErrorResponseBody {
  error: string;
  system_message: string;
  details?: unknown;
}

export interface ErrorResponse {
  statusCode: number;
  body: ErrorResponseBody;
}

export function toErrorResponse(error: unknown): ErrorResponse {
  if (error instanceof HttpError) {
    return {
      statusCode: error.statusCode,
      body: {
        error: error.code,
        system_message: error.message,
        details: error.details,
      },
    };
  }

  const anyError = error as { statusCode?: number; code?: string } | null | undefined;
  if (anyError?.statusCode === 413 || anyError?.code === "FST_ERR_CTP_BODY_TOO_LARGE") {
    return {
      statusCode: 413,
      body: {
        error: "PAYLOAD_TOO_LARGE",
        system_message: "請求內容不得超過允許的大小。",
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      error: "INTERNAL_ERROR",
      system_message: "伺服器發生內部錯誤。",
    },
  };
}
