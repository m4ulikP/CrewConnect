import mongoose, { Schema, Document, Model, Types } from "mongoose";
import type { TeamRole, MembershipStatus } from "@crewconnect/shared";

export interface IMembership extends Document {
  hackathonId: Types.ObjectId;
  teamId: Types.ObjectId;
  userId: Types.ObjectId;
  role: TeamRole;
  status: MembershipStatus;
  joinedAt: Date;
  leftAt?: Date;
}

const MembershipSchema = new Schema<IMembership>(
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
    role: {
      type: String,
      enum: ["LEADER", "MEMBER"],
      default: "MEMBER",
      required: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "LEFT", "REMOVED"],
      default: "ACTIVE",
      required: true,
      index: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    leftAt: {
      type: Date,
    },
  },
  {
    timestamps: false,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = ret._id ? String(ret._id) : undefined;
        if (ret.hackathonId) ret.hackathonId = String(ret.hackathonId);
        if (ret.teamId) ret.teamId = String(ret.teamId);
        if (ret.userId) ret.userId = String(ret.userId);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// CRITICAL INVARIANT INDEX: A user can belong to at most ONE active team per hackathon
MembershipSchema.index(
  { hackathonId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { status: "ACTIVE" } }
);

// Team roster & User dashboard indexes
MembershipSchema.index({ teamId: 1, status: 1 });
MembershipSchema.index({ userId: 1, status: 1 });

export const Membership =
  (mongoose.models.Membership as Model<IMembership>) ||
  mongoose.model<IMembership>("Membership", MembershipSchema);
