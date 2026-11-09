import mongoose, { Schema, Document, Model, Types } from "mongoose";
import type { JoinRequestStatus } from "@crewconnect/shared";

export interface IJoinRequest extends Document {
  hackathonId: Types.ObjectId;
  teamId: Types.ObjectId;
  userId: Types.ObjectId;
  message?: string;
  status: JoinRequestStatus;
  resolvedAt?: Date;
  resolvedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const JoinRequestSchema = new Schema<IJoinRequest>(
  {
    hackathonId: {
      type: Schema.Types.ObjectId,
      ref: "Hackathon",
      required: [true, "Hackathon ID is required"],
      index: true,
    },
    teamId: {
      type: Schema.Types.ObjectId,
      ref: "Team",
      required: [true, "Team ID is required"],
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
      index: true,
    },
    message: {
      type: String,
      maxlength: [300, "Message cannot exceed 300 characters"],
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
      default: "PENDING",
      required: true,
    },
    resolvedAt: {
      type: Date,
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = ret._id ? String(ret._id) : undefined;
        if (ret.hackathonId) ret.hackathonId = String(ret.hackathonId);
        if (ret.teamId) ret.teamId = String(ret.teamId);
        if (ret.userId) ret.userId = String(ret.userId);
        if (ret.resolvedBy) ret.resolvedBy = String(ret.resolvedBy);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

JoinRequestSchema.index({ teamId: 1, status: 1 });
JoinRequestSchema.index({ hackathonId: 1, userId: 1, status: 1 });
JoinRequestSchema.index(
  { teamId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { status: "PENDING" } }
);

export const JoinRequest =
  (mongoose.models.JoinRequest as Model<IJoinRequest>) ||
  mongoose.model<IJoinRequest>("JoinRequest", JoinRequestSchema);
