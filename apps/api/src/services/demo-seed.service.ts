import { Hackathon, User, Team, Membership } from "../models/index.js";

export interface DemoSeedResult {
  hackathon: {
    id: string;
    slug: string;
    title: string;
    status: string;
  };
  teamsCreated: number;
}

export async function ensureDefaultHackathonAndDemoData(): Promise<DemoSeedResult> {
  // 1. Ensure Hack4Hack 2026 exists and is ACTIVE
  let hackathon = await Hackathon.findOne({ slug: "hack4hack-2026" });

  if (!hackathon) {
    hackathon = await Hackathon.create({
      slug: "hack4hack-2026",
      title: "Hack4Hack 2026 — Crew Hiring Challenge",
      description:
        "The premier race-proof hackathon team formation platform. Form squads of 2–5 members, recruit teammates, and allocate seats without race conditions.",
      minTeamSize: 2,
      maxTeamSize: 5,
      status: "ACTIVE",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-12-31T23:59:59.999Z"),
    });
    console.log("[DemoSeed] Created official demo hackathon: Hack4Hack 2026");
  } else if (hackathon.status !== "ACTIVE") {
    hackathon.status = "ACTIVE";
    await hackathon.save();
    console.log("[DemoSeed] Activated existing Hack4Hack 2026 hackathon");
  }

  // 2. Check if this hackathon already has teams
  const existingTeamsCount = await Team.countDocuments({ hackathonId: hackathon._id });
  if (existingTeamsCount > 0) {
    return {
      hackathon: {
        id: String(hackathon._id),
        slug: hackathon.slug,
        title: hackathon.title,
        status: hackathon.status,
      },
      teamsCreated: 0,
    };
  }

  console.log("[DemoSeed] No teams found for demo hackathon. Seeding sample squads...");

  // 3. Demo team specifications with realistic profiles
  const demoSquads = [
    {
      leaderEmail: "alex.chen@crewconnect.demo",
      leaderName: "Alex Chen",
      leaderBio: "Distributed systems engineer & zero-knowledge state sync enthusiast.",
      leaderSkills: ["Rust", "Distributed Systems", "TypeScript", "Docker"],
      teamName: "Atlas Consensus",
      tagline: "Autonomous zero-knowledge state sync across distributed nodes",
      description:
        "Building high-throughput verifiable state transitions with optimistic rollups. Looking for systems builders who understand memory safety and cryptographic proofs.",
      skillsNeeded: ["Rust", "Distributed Systems", "Solidity", "TypeScript"],
      maxCapacity: 4,
    },
    {
      leaderEmail: "sarah.lin@crewconnect.demo",
      leaderName: "Sarah Lin",
      leaderBio: "Full-stack engineer specializing in low-latency AI streaming pipelines.",
      leaderSkills: ["Python", "React", "TypeScript", "FastAPI", "PyTorch"],
      teamName: "VectorForge",
      tagline: "Real-time multithreaded AI streaming & low-latency inference",
      description:
        "Developing sub-10ms streaming LLM token routing and speculative decoding algorithms on GPU clusters. Seeking frontend and systems hackers.",
      skillsNeeded: ["Python", "PyTorch", "React", "CUDA", "FastAPI"],
      maxCapacity: 5,
    },
    {
      leaderEmail: "marcus.vance@crewconnect.demo",
      leaderName: "Marcus Vance",
      leaderBio: "Local-first software architect & peer-to-peer protocols builder.",
      leaderSkills: ["Go", "WebRTC", "TypeScript", "CRDTs"],
      teamName: "Hyperion Labs",
      tagline: "Offline-first peer-to-peer workspace & local-first CRDT sync",
      description:
        "Creating race-proof collaborative canvases with local SQLite persistence and WebRTC mesh peer discovery.",
      skillsNeeded: ["Go", "WebRTC", "TypeScript", "UI/UX Design", "Docker"],
      maxCapacity: 4,
    },
  ];

  let teamsCreated = 0;

  for (const squad of demoSquads) {
    // Ensure leader user exists
    let leader = await User.findOne({ email: squad.leaderEmail });
    if (!leader) {
      const passwordHash = await User.hashPassword("DemoPassword123!");
      leader = await User.create({
        email: squad.leaderEmail,
        displayName: squad.leaderName,
        bio: squad.leaderBio,
        skills: squad.leaderSkills,
        timeZone: "UTC",
        status: "ACTIVE",
        passwordHash,
      });
    }

    // Create team
    const team = await Team.create({
      hackathonId: hackathon._id,
      name: squad.teamName,
      tagline: squad.tagline,
      description: squad.description,
      skillsNeeded: squad.skillsNeeded,
      maxCapacity: squad.maxCapacity,
      memberCount: 1,
      isOpen: true,
      status: "ACTIVE",
      leaderId: leader._id,
    });

    // Create leader membership
    await Membership.create({
      hackathonId: hackathon._id,
      teamId: team._id,
      userId: leader._id,
      role: "LEADER",
      status: "ACTIVE",
      joinedAt: new Date(),
    });

    teamsCreated++;
  }

  console.log(`[DemoSeed] Successfully seeded ${teamsCreated} demo squads.`);

  return {
    hackathon: {
      id: String(hackathon._id),
      slug: hackathon.slug,
      title: hackathon.title,
      status: hackathon.status,
    },
    teamsCreated,
  };
}
