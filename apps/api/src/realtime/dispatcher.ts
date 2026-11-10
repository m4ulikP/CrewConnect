import { REALTIME_EVENTS } from "@crewconnect/shared";
import type {
  TeamMemberJoinedPayload,
  TeamMemberLeftPayload,
  TeamUpdatedPayload,
  TeamDisbandedPayload,
  LeadershipTransferredPayload,
  JoinRequestSubmittedPayload,
  JoinRequestResolvedPayload,
  TeamCapacityUpdatedPayload,
} from "@crewconnect/shared";
import { getSocketServer } from "./socket.js";

/**
 * Realtime Event Dispatcher
 * Dispatches verified domain events post-commit to authorized Socket.IO rooms.
 * Invariant: Must strictly be called AFTER database transaction confirmation.
 */
export class EventDispatcher {
  /**
   * Broadcasts a new member joining a team to the team room and updates public capacity in the hackathon room.
   */
  static dispatchMemberJoined(payload: TeamMemberJoinedPayload): void {
    const io = getSocketServer();
    if (!io) return;

    // Notify private team room
    io.to(`team:${payload.teamId}`).emit(REALTIME_EVENTS.TEAM_MEMBER_JOINED, payload);

    // Broadcast capacity update to entire hackathon directory and team room (deduplicated)
    const capacityPayload: TeamCapacityUpdatedPayload = {
      teamId: payload.teamId,
      hackathonId: payload.hackathonId,
      memberCount: payload.memberCount,
      maxCapacity: payload.maxCapacity,
      isOpen: payload.isOpen,
      timestamp: payload.timestamp,
    };
    io.to(`hackathon:${payload.hackathonId}`)
      .to(`team:${payload.teamId}`)
      .emit(REALTIME_EVENTS.TEAM_CAPACITY_UPDATED, capacityPayload);
  }

  /**
   * Broadcasts a member leaving or being removed from a team, notifies all sockets of
   * the affected user and remaining members, and revokes team-room membership for all
   * of the departing user's connected sockets strictly after dispatch.
   */
  static dispatchMemberLeft(payload: TeamMemberLeftPayload): void {
    const io = getSocketServer();
    if (!io) return;

    // Deliver departure event once per socket across current team room and user's private room
    io.to(`team:${payload.teamId}`)
      .to(`user:${payload.userId}`)
      .emit(REALTIME_EVENTS.TEAM_MEMBER_LEFT, payload);

    const capacityPayload: TeamCapacityUpdatedPayload = {
      teamId: payload.teamId,
      hackathonId: payload.hackathonId,
      memberCount: payload.memberCount,
      maxCapacity: payload.maxCapacity,
      isOpen: payload.isOpen,
      timestamp: payload.timestamp,
    };
    io.to(`hackathon:${payload.hackathonId}`)
      .to(`team:${payload.teamId}`)
      .emit(REALTIME_EVENTS.TEAM_CAPACITY_UPDATED, capacityPayload);

    // Evict all connected sockets belonging to the departed user from the team room
    // strictly after the departure broadcast has been queued.
    io.in(`user:${payload.userId}`).socketsLeave(`team:${payload.teamId}`);
  }

  /**
   * Broadcasts team profile updates.
   */
  static dispatchTeamUpdated(payload: TeamUpdatedPayload): void {
    const io = getSocketServer();
    if (!io) return;

    io.to(`team:${payload.teamId}`)
      .to(`hackathon:${payload.hackathonId}`)
      .emit(REALTIME_EVENTS.TEAM_UPDATED, payload);
  }

  /**
   * Broadcasts team disbanding and evicts all subscribers from the team room afterward.
   */
  static dispatchTeamDisbanded(payload: TeamDisbandedPayload): void {
    const io = getSocketServer();
    if (!io) return;

    io.to(`team:${payload.teamId}`)
      .to(`hackathon:${payload.hackathonId}`)
      .emit(REALTIME_EVENTS.TEAM_DISBANDED, payload);

    // Evict all sockets remaining in the disbanded team's room
    io.in(`team:${payload.teamId}`).socketsLeave(`team:${payload.teamId}`);
  }

  /**
   * Broadcasts leadership transfer to active team members.
   */
  static dispatchLeadershipTransferred(payload: LeadershipTransferredPayload): void {
    const io = getSocketServer();
    if (!io) return;

    io.to(`team:${payload.teamId}`).emit(REALTIME_EVENTS.LEADERSHIP_TRANSFERRED, payload);
  }

  /**
   * Dispatches join request submission notification to the team leader and team room.
   */
  static dispatchJoinRequestSubmitted(
    leaderId: string,
    payload: JoinRequestSubmittedPayload
  ): void {
    const io = getSocketServer();
    if (!io) return;

    io.to(`user:${leaderId}`)
      .to(`team:${payload.teamId}`)
      .emit(REALTIME_EVENTS.JOIN_REQUEST_SUBMITTED, payload);
  }

  /**
   * Dispatches join request resolution (approved or rejected) to the applicant and team room.
   */
  static dispatchJoinRequestResolved(
    targetUserId: string,
    payload: JoinRequestResolvedPayload
  ): void {
    const io = getSocketServer();
    if (!io) return;

    const eventName =
      payload.status === "APPROVED"
        ? REALTIME_EVENTS.JOIN_REQUEST_APPROVED
        : REALTIME_EVENTS.JOIN_REQUEST_REJECTED;

    io.to(`user:${targetUserId}`).to(`team:${payload.teamId}`).emit(eventName, payload);
  }

  /**
   * Broadcasts team capacity changes directly.
   */
  static dispatchCapacityUpdated(payload: TeamCapacityUpdatedPayload): void {
    const io = getSocketServer();
    if (!io) return;

    io.to(`hackathon:${payload.hackathonId}`)
      .to(`team:${payload.teamId}`)
      .emit(REALTIME_EVENTS.TEAM_CAPACITY_UPDATED, payload);
  }
}
