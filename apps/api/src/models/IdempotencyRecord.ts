import mongoose, { Schema, Document, Model, Types } from "mongoose";
import type { IdempotencyStatus } from "@crewconnect/shared";

export interface IIdempotencyRecord extends Document {
  key: string;
  userId: Types.ObjectId;
  endpoint: string;
  payloadHash: string;
  ownerToken: string;
  status: IdempotencyStatus;
  lockedAt?: Date;
  completedAt?: Date;
  statusCode?: number;
  responseBody?: unknown;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const IdempotencyRecordSchema = new Schema<IIdempotencyRecord>(
  {
    key: {
      type: String,
      required: [true, "Idempotency key is required"],
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },
    endpoint: {
      type: String,
      required: [true, "Endpoint identifier is required"],
      trim: true,
    },
    payloadHash: {
      type: String,
      required: [true, "Payload hash is required"],
    },
    ownerToken: {
      type: String,
      required: [true, "Lease owner token is required"],
    },
    status: {
      type: String,
      enum: ["PROCESSING", "COMPLETED", "FAILED"],
      default: "PROCESSING",
      required: true,
    },
    lockedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
    statusCode: {
      type: Number,
    },
    responseBody: {
      type: Schema.Types.Mixed,
    },
    expiresAt: {
      type: Date,
      required: [true, "Expiration timestamp is required for TTL cleanup"],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = ret._id ? String(ret._id) : undefined;
        if (ret.userId) ret.userId = String(ret.userId);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Scoped idempotency constraint: same user, key and endpoint
IdempotencyRecordSchema.index({ key: 1, userId: 1, endpoint: 1 }, { unique: true });

// TTL index for eventual cleanup (24 hours)
IdempotencyRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const IdempotencyRecord =
  (mongoose.models.IdempotencyRecord as Model<IIdempotencyRecord>) ||
  mongoose.model<IIdempotencyRecord>("IdempotencyRecord", IdempotencyRecordSchema);
