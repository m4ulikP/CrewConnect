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
}
