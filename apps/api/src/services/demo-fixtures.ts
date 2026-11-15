import mongoose from "mongoose";
import { env } from "../config/env.js";

export function isDevFallbackActive(): boolean {
  return env.NODE_ENV === "development" && mongoose.connection.readyState !== 1;
}

export const FALLBACK_DEMO_HACKATHON = {
  id: "hack4hack-2026",
  _id: "hack4hack-2026",
  slug: "hack4hack-2026",
  title: "Hack4Hack 2026 — Crew Hiring Challenge",
  description:
    "The premier race-proof hackathon team formation platform. Form squads of 2–5 members, recruit teammates, and allocate seats without race conditions.",
  minTeamSize: 2,
  maxTeamSize: 5,
  status: "ACTIVE" as const,
  startDate: new Date("2026-01-01T00:00:00.000Z"),
  endDate: new Date("2026-12-31T23:59:59.999Z"),
};

export const FALLBACK_DEMO_TEAMS = [
  {
    id: "team-atlas-consensus",
    _id: "team-atlas-consensus",
    hackathonId: "hack4hack-2026",
    leaderId: "leader-alex-chen",
    name: "Atlas Consensus",
    tagline: "Autonomous zero-knowledge state sync across distributed nodes",
    description:
      "Building high-throughput verifiable state transitions with optimistic rollups. Looking for systems builders who understand memory safety and cryptographic proofs.",
    skillsNeeded: ["Rust", "Distributed Systems", "Solidity", "TypeScript"],
    maxCapacity: 4,
    memberCount: 3,
    isOpen: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "team-vectorforge",
    _id: "team-vectorforge",
    hackathonId: "hack4hack-2026",
    leaderId: "leader-sarah-lin",
    name: "VectorForge",
    tagline: "Real-time multithreaded AI streaming & low-latency inference",
    description:
      "Developing sub-10ms streaming LLM token routing and speculative decoding algorithms on GPU clusters. Seeking frontend and systems hackers.",
    skillsNeeded: ["Python", "PyTorch", "React", "CUDA", "FastAPI"],
    maxCapacity: 5,
    memberCount: 4,
    isOpen: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "team-hyperion-labs",
    _id: "team-hyperion-labs",
    hackathonId: "hack4hack-2026",
    leaderId: "leader-marcus-vance",
    name: "Hyperion Labs",
    tagline: "Offline-first peer-to-peer workspace & local-first CRDT sync",
    description:
      "Creating race-proof collaborative canvases with local SQLite persistence and WebRTC mesh peer discovery.",
    skillsNeeded: ["Go", "WebRTC", "TypeScript", "UI/UX Design", "Docker"],
    maxCapacity: 4,
    memberCount: 2,
    isOpen: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];
