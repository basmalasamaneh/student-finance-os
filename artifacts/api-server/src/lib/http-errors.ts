export type ErrorCode = "BAD_REQUEST" | "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "INTERNAL_ERROR" | "INVALID_CREDENTIALS" | "EMAIL_TAKEN" | "RATE_LIMITED" | "CONFLICT" | "INSUFFICIENT_FUNDS";

const publicErrors: Record<ErrorCode, { status: number; message: string }> = {
  BAD_REQUEST: { status: 400, message: "Invalid request" },
  UNAUTHENTICATED: { status: 401, message: "Authentication required" },
  FORBIDDEN: { status: 403, message: "Access denied" },
  NOT_FOUND: { status: 404, message: "Resource not found" },
  INTERNAL_ERROR: { status: 500, message: "Internal server error" },
  INVALID_CREDENTIALS: { status: 401, message: "Invalid email or password" },
  EMAIL_TAKEN: { status: 409, message: "Email already registered" },
  RATE_LIMITED: { status: 429, message: "Too many attempts. Try again later" },
  CONFLICT: { status: 409, message: "Conflicting request or unavailable resource" },
  INSUFFICIENT_FUNDS: { status: 409, message: "Insufficient simulated funds" },
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;

  constructor(code: ErrorCode) {
    super(publicErrors[code].message);
    this.name = "ApiError";
    this.code = code;
    this.status = publicErrors[code].status;
  }
}

export function toPublicError(error: unknown, requestId?: string): {
  status: number;
  body: { error: { code: ErrorCode; message: string; requestId?: string } };
} {
  const code = error instanceof ApiError
    ? error.code
    : error instanceof SyntaxError && "status" in error && error.status === 400
      ? "BAD_REQUEST"
      : "INTERNAL_ERROR";
  const publicError = publicErrors[code];
  return {
    status: publicError.status,
    body: {
      error: {
        code,
        message: publicError.message,
        ...(requestId ? { requestId } : {}),
      },
    },
  };
}