import { User } from "./User.js";
import { Hackathon } from "./Hackathon.js";
import { Team } from "./Team.js";
import { Membership } from "./Membership.js";
import { JoinRequest } from "./JoinRequest.js";
import { Invitation } from "./Invitation.js";
import { AuditLog } from "./AuditLog.js";
import { IdempotencyRecord } from "./IdempotencyRecord.js";

export { User, Hackathon, Team, Membership, JoinRequest, Invitation, AuditLog, IdempotencyRecord };

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
