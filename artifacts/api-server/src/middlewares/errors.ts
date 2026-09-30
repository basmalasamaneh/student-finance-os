import type { ErrorRequestHandler, RequestHandler } from "express";
import { ApiError, toPublicError } from "../lib/http-errors";

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new ApiError("NOT_FOUND"));
};

export const errorHandler: ErrorRequestHandler = (error: unknown, req, res, _next) => {
  const requestId = typeof req.id === "string" || typeof req.id === "number"
    ? String(req.id)
    : undefined;
  const result = toPublicError(error, requestId);
  if (result.status >= 500) {
    req.log.error({ err: error }, "Unhandled request error");
  } else if (!(result.status === 401 && req.originalUrl?.split("?")[0] === "/api/auth/me")) {
    req.log.warn({ code: result.body.error.code }, "Request rejected");
  }
  if (res.headersSent) return;
  res.status(result.status).json(result.body);
};