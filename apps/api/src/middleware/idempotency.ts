import type { Request, Response, NextFunction } from "express";
import { IdempotencyService } from "../services/idempotency.service.js";
import { AppError } from "../errors/AppError.js";
import { ERROR_CODES } from "@crewconnect/shared";
import type { Types } from "mongoose";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      idempotency?: {
        key: string;
        ownerToken: string;
        recordId: Types.ObjectId;
        payloadHash: string;
      };
    }
  }
}

export interface IdempotencyMiddlewareOptions {
  required?: boolean;
  endpoint?: string;
}

/**
 * Express middleware for atomic idempotency lease acquisition.
 */
export function idempotency(options: IdempotencyMiddlewareOptions = {}) {
  const { required = true, endpoint: customEndpoint } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const rawKey = req.headers["idempotency-key"];

      if (!rawKey) {
        if (required) {
          throw AppError.badRequest(
            "Idempotency-Key header is required for this operation",
            ERROR_CODES.IDEMPOTENCY_KEY_REQUIRED
          );
        }
        return next();
      }

      const key = IdempotencyService.validateKey(rawKey);
      const userId = req.user?.id;
      if (!userId) {
        throw AppError.unauthorized("Authentication required for idempotent operations");
      }

      const endpoint =
        customEndpoint || `${req.method} ${req.baseUrl}${req.route?.path || req.path}`;
      const payloadHash = IdempotencyService.generatePayloadHash(endpoint, req.params, req.body);

      const leaseResult = await IdempotencyService.acquireLease(key, userId, endpoint, payloadHash);

      if (!leaseResult.acquired) {
        res
          .status(leaseResult.cachedResponse.statusCode)
          .set("X-Cache", "HIT")
          .json(leaseResult.cachedResponse.body);
        return;
      }

      req.idempotency = {
        key,
        ownerToken: leaseResult.ownerToken,
        recordId: leaseResult.record._id,
        payloadHash,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}
