import mongoose, { Schema, Document, Model, Types } from "mongoose";
import type { TeamStatus } from "@crewconnect/shared";

export interface ITeam extends Document {
  hackathonId: Types.ObjectId;
  leaderId: Types.ObjectId;
  name: string;
  tagline?: string;
  description?: string;
  skillsNeeded: string[];
  memberCount: number;
  maxCapacity: number;
  isOpen: boolean;
  status: TeamStatus;
  createdAt: Date;
  updatedAt: Date;
}

const TeamSchema = new Schema<ITeam>(
  {
    hackathonId: {
      type: Schema.Types.ObjectId,
      ref: "Hackathon",
      required: [true, "Hackathon ID is required"],
      index: true,
    },
    leaderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Leader ID is required"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Team name is required"],
      trim: true,
      minlength: [2, "Team name must be at least 2 characters"],
      maxlength: [50, "Team name cannot exceed 50 characters"],
    },
    tagline: {
      type: String,
      maxlength: [100, "Tagline cannot exceed 100 characters"],
      trim: true,
      default: "",
    },
    description: {
      type: String,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
      trim: true,
      default: "",
    },
    skillsNeeded: {
      type: [String],
      default: [],
    },
    memberCount: {
      type: Number,
      required: true,
      default: 1,
      min: [0, "Member count cannot be negative"],
    },
    maxCapacity: {
      type: Number,
      required: true,
      default: 5,
      min: [1, "Max capacity must be at least 1"],
      max: [10, "Max capacity cannot exceed 10"],
    },
    isOpen: {
      type: Boolean,
      required: true,
      default: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "DISBANDED", "ARCHIVED"],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = ret._id ? String(ret._id) : undefined;
        if (ret.hackathonId) ret.hackathonId = String(ret.hackathonId);
        if (ret.leaderId) {
          if (
            typeof ret.leaderId === "object" &&
            ret.leaderId !== null &&
            "displayName" in ret.leaderId
          ) {
            const l = ret.leaderId as Record<string, unknown>;
            if (l._id) {
              l.id = String(l._id);
              delete l._id;
            }
          } else {
            ret.leaderId = String(ret.leaderId);
          }
        }
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes specified in docs/database-design.md + compound sort indexes for discovery latency
TeamSchema.index({ hackathonId: 1, status: 1, isOpen: 1, memberCount: 1 });
TeamSchema.index({ hackathonId: 1, status: 1, isOpen: 1, createdAt: -1 });
TeamSchema.index({ hackathonId: 1, status: 1, createdAt: -1 });
TeamSchema.index({ hackathonId: 1, name: 1 }, { unique: true });
TeamSchema.index({ hackathonId: 1, skillsNeeded: 1 });

export const Team =
  (mongoose.models.Team as Model<ITeam>) || mongoose.model<ITeam>("Team", TeamSchema);
