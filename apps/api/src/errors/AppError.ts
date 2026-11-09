import { ERROR_CODES, type ErrorCode } from "@crewconnect/shared";

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    codeOrMessage: ErrorCode | string,
    messageOrCode: string | ErrorCode,
    statusCode: number = 500,
    details?: unknown
  ) {
    // Determine whether (code, message) or (message, code) was passed
    const isFirstCode =
      codeOrMessage in ERROR_CODES ||
      Object.values(ERROR_CODES).includes(codeOrMessage as ErrorCode) ||
      /^[A-Z_]{3,}$/.test(codeOrMessage);

    const code = (isFirstCode ? codeOrMessage : messageOrCode) as ErrorCode;
    const message = isFirstCode ? (messageOrCode as string) : (codeOrMessage as string);

    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static badRequest(
    message: string,
    code: ErrorCode = ERROR_CODES.VALIDATION_ERROR,
    details?: unknown
  ): AppError {
    return new AppError(code, message, 400, details);
  }

  static validation(message: string, details?: unknown): AppError {
    return new AppError(ERROR_CODES.VALIDATION_ERROR, message, 422, details);
  }

  static unauthorized(
    message = "Unauthorized",
    code: ErrorCode = ERROR_CODES.UNAUTHORIZED,
    details?: unknown
  ): AppError {
    return new AppError(code, message, 401, details);
  }

  static forbidden(
    message = "Forbidden",
    code: ErrorCode = ERROR_CODES.FORBIDDEN,
    details?: unknown
  ): AppError {
    return new AppError(code, message, 403, details);
  }

  static notFound(
    message = "Resource not found",
    code: ErrorCode = ERROR_CODES.NOT_FOUND,
    details?: unknown
  ): AppError {
    return new AppError(code, message, 404, details);
  }

  static conflict(
    codeOrMessage: ErrorCode | string,
    messageOrDetails?: string | unknown,
    details?: unknown
  ): AppError {
    if (typeof messageOrDetails === "string") {
      return new AppError(codeOrMessage as ErrorCode, messageOrDetails, 409, details);
    }
    return new AppError(
      ERROR_CODES.CONCURRENCY_CONFLICT,
      codeOrMessage as string,
      409,
      messageOrDetails
    );
  }

  static commitUncertain(
    message = "Transaction commit outcome is uncertain after retries. The operation may have committed or aborted.",
    details?: unknown
  ): AppError {
    return new AppError(ERROR_CODES.TRANSACTION_COMMIT_UNCERTAIN, message, 503, details);
  }

  static internal(message = "Internal server error", details?: unknown): AppError {
    return new AppError(ERROR_CODES.INTERNAL_ERROR, message, 500, details);
  }
}
