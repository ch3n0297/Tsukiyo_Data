export class HttpError extends Error {
  constructor(statusCode, code, message, details = undefined) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function toErrorResponse(error) {
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

  return {
    statusCode: 500,
    body: {
      error: "INTERNAL_ERROR",
      system_message: "Internal server error.",
    },
  };
}
