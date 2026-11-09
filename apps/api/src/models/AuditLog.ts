import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { AUDIT_ACTIONS, type AuditAction } from "@crewconnect/shared";

export interface IAuditLog extends Document {
  hackathonId: Types.ObjectId;
  teamId?: Types.ObjectId;
  actorId: Types.ObjectId;
  targetUserId?: Types.ObjectId;
  action: AuditAction;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
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
      index: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Actor ID is required"],
      index: true,
    },
    targetUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    action: {
      type: String,
      enum: AUDIT_ACTIONS,
      required: [true, "Audit action is required"],
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: false,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = ret._id ? String(ret._id) : undefined;
        if (ret.hackathonId) ret.hackathonId = String(ret.hackathonId);
        if (ret.teamId) ret.teamId = String(ret.teamId);
        if (ret.actorId) ret.actorId = String(ret.actorId);
        if (ret.targetUserId) ret.targetUserId = String(ret.targetUserId);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

AuditLogSchema.index({ teamId: 1, timestamp: -1 });
AuditLogSchema.index({ actorId: 1, timestamp: -1 });
AuditLogSchema.index({ hackathonId: 1, timestamp: -1 });

export const AuditLog =
  (mongoose.models.AuditLog as Model<IAuditLog>) ||
  mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);
