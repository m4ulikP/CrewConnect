import mongoose, { Schema, Document, Model, Types } from "mongoose";
import type { InvitationStatus } from "@crewconnect/shared";

export interface IInvitation extends Document {
  hackathonId: Types.ObjectId;
  teamId: Types.ObjectId;
  inviterId: Types.ObjectId;
  inviteeId?: Types.ObjectId;
  tokenHash: string;
  status: InvitationStatus;
  usesCount: number;
  maxUses: number;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InvitationSchema = new Schema<IInvitation>(
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
    inviterId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Inviter ID is required"],
      index: true,
    },
    inviteeId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    tokenHash: {
      type: String,
      required: [true, "Token hash is required"],
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "EXPIRED", "REVOKED", "EXHAUSTED"],
      default: "ACTIVE",
      required: true,
    },
    usesCount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    maxUses: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    expiresAt: {
      type: Date,
      required: [true, "Expiration date is required"],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = ret._id ? String(ret._id) : undefined;
        if (ret.hackathonId) ret.hackathonId = String(ret.hackathonId);
        if (ret.teamId) ret.teamId = String(ret.teamId);
        if (ret.inviterId) ret.inviterId = String(ret.inviterId);
        if (ret.inviteeId) ret.inviteeId = String(ret.inviteeId);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

InvitationSchema.index({ teamId: 1, status: 1 });
InvitationSchema.index({ inviteeId: 1, status: 1 });

export const Invitation =
  (mongoose.models.Invitation as Model<IInvitation>) ||
  mongoose.model<IInvitation>("Invitation", InvitationSchema);
