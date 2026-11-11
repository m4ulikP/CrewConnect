import mongoose, { Schema, Document, Model } from "mongoose";
import argon2 from "argon2";
import crypto from "crypto";
import type { UserStatus } from "@crewconnect/shared";

export interface IUser extends Document {
  email: string;
  passwordHash?: string;
  googleId?: string;
  avatarUrl?: string;
  authProvider?: "local" | "google";
  displayName: string;
  bio?: string;
  skills: string[];
  timeZone: string;
  experienceLevel?: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  githubUrl?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  status: UserStatus;
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
  verifyPassword(candidatePassword: string): Promise<boolean>;
}

export interface IUserModel extends Model<IUser> {
  hashPassword(plaintext: string): Promise<string>;
}

const UserSchema = new Schema<IUser, IUserModel>(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: function (this: IUser) {
        return !this.googleId;
      },
      select: false, // Never return password hash in queries by default
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
      index: true,
    },
    avatarUrl: {
      type: String,
      trim: true,
    },
    authProvider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    displayName: {
      type: String,
      required: [true, "Display name is required"],
      trim: true,
      minlength: [2, "Display name must be at least 2 characters"],
      maxlength: [50, "Display name cannot exceed 50 characters"],
    },
    bio: {
      type: String,
      maxlength: [500, "Bio cannot exceed 500 characters"],
      default: "",
    },
    skills: {
      type: [String],
      required: [true, "Skills are required"],
      validate: {
        validator: (v: string[]) => Array.isArray(v) && v.length >= 1 && v.length <= 20,
        message: "Must provide between 1 and 20 skills",
      },
      index: true,
    },
    timeZone: {
      type: String,
      default: "UTC",
      trim: true,
    },
    experienceLevel: {
      type: String,
      enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED"],
      default: "INTERMEDIATE",
    },
    githubUrl: {
      type: String,
      trim: true,
    },
    linkedinUrl: {
      type: String,
      trim: true,
    },
    portfolioUrl: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED"],
      default: "ACTIVE",
      index: true,
    },
    tokenVersion: {
      type: Number,
      default: 0,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = ret._id ? String(ret._id) : undefined;
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

// ADR-0008 Argon2id Password Hashing
UserSchema.statics.hashPassword = async function (plaintext: string): Promise<string> {
  return argon2.hash(plaintext, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MiB
    timeCost: 3, // 3 iterations
    parallelism: 1, // 1 thread
    hashLength: 32, // 32 bytes
    salt: crypto.randomBytes(16), // 16 bytes
  });
};

// Instance method to verify password
UserSchema.methods.verifyPassword = async function (candidatePassword: string): Promise<boolean> {
  if (!this.passwordHash) {
    return false;
  }
  return argon2.verify(this.passwordHash, candidatePassword);
};

export const User =
  (mongoose.models.User as IUserModel) || mongoose.model<IUser, IUserModel>("User", UserSchema);
