import mongoose, { Schema, Document, Model } from "mongoose";
import type { HackathonStatus } from "@crewconnect/shared";

export interface IHackathon extends Document {
  slug: string;
  title: string;
  description: string;
  minTeamSize: number;
  maxTeamSize: number;
  status: HackathonStatus;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

const HackathonSchema = new Schema<IHackathon>(
  {
    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      minlength: [3, "Title must be at least 3 characters"],
      maxlength: [100, "Title cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    minTeamSize: {
      type: Number,
      required: true,
      default: 1,
      min: [1, "Minimum team size must be at least 1"],
    },
    maxTeamSize: {
      type: Number,
      required: true,
      default: 5,
      max: [10, "Maximum team size cannot exceed 10"],
    },
    status: {
      type: String,
      enum: ["UPCOMING", "ACTIVE", "COMPLETED"],
      default: "UPCOMING",
      index: true,
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = ret._id ? String(ret._id) : undefined;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

HackathonSchema.index({ status: 1, startDate: 1 });

export const Hackathon =
  (mongoose.models.Hackathon as Model<IHackathon>) ||
  mongoose.model<IHackathon>("Hackathon", HackathonSchema);
