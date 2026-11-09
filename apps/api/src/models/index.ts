import { User, type IUser } from "./User.js";
import { Hackathon, type IHackathon } from "./Hackathon.js";
import { Team, type ITeam } from "./Team.js";
import { Membership, type IMembership } from "./Membership.js";
import { JoinRequest, type IJoinRequest } from "./JoinRequest.js";
import { Invitation, type IInvitation } from "./Invitation.js";
import { AuditLog, type IAuditLog } from "./AuditLog.js";
import { IdempotencyRecord, type IIdempotencyRecord } from "./IdempotencyRecord.js";

export {
  User,
  Hackathon,
  Team,
  Membership,
  JoinRequest,
  Invitation,
  AuditLog,
  IdempotencyRecord,
  type IUser,
  type IHackathon,
  type ITeam,
  type IMembership,
  type IJoinRequest,
  type IInvitation,
  type IAuditLog,
  type IIdempotencyRecord,
};

export async function syncAllIndexes(): Promise<Record<string, string[]>> {
  const models = [
    { name: "User", model: User },
    { name: "Hackathon", model: Hackathon },
    { name: "Team", model: Team },
    { name: "Membership", model: Membership },
    { name: "JoinRequest", model: JoinRequest },
    { name: "Invitation", model: Invitation },
    { name: "AuditLog", model: AuditLog },
    { name: "IdempotencyRecord", model: IdempotencyRecord },
  ];

  const results: Record<string, string[]> = {};

  for (const { name, model } of models) {
    await model.syncIndexes();
    const indexes = await model.collection.indexes();
    results[name] = indexes.map((idx) => Object.keys(idx.key).join("+"));
  }

  return results;
}
