import http from "http";
import { Server as SocketIOServer, Socket } from "socket.io";
import { Types } from "mongoose";
import { env } from "../config/env.js";
import { AuthService } from "../services/auth.service.js";
import { User, Membership, Hackathon } from "../models/index.js";

let io: SocketIOServer | null = null;

export interface AuthenticatedSocketData {
  userId: string;
  email: string;
  displayName: string;
  tokenVersion: number;
}

export type AuthenticatedSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  AuthenticatedSocketData
>;

/**
 * Extracts authentication token from socket handshake (auth object, headers, or cookies)
 */
function extractToken(socket: Socket): string | undefined {
  // 1. Handshake auth payload
  if (typeof socket.handshake.auth?.token === "string" && socket.handshake.auth.token.trim()) {
    return socket.handshake.auth.token.trim();
  }

  // 2. Authorization header
  const authHeader = socket.handshake.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  // 3. HTTP-only cookies
  const cookieHeader = socket.handshake.headers.cookie;
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map((c) => {
        const [k, ...v] = c.trim().split("=");
        return [k, decodeURIComponent(v.join("="))];
      })
    );
    if (cookies.token) {
      return cookies.token;
    }
  }

  return undefined;
}

export interface InitSocketServerOptions {
  /**
   * Optional lifecycle hook invoked after initial membership validation and before socket.join
   * on `join:team`. Used solely by concurrency tests to inject deterministic interleavings.
   */
  onBeforeTeamRoomJoin?: (context: { teamId: string; userId: string }) => Promise<void> | void;
}

/**
 * Initializes the Socket.IO server on top of an HTTP server
 */
export function initSocketServer(
  httpServer: http.Server,
  options: InitSocketServerOptions = {}
): SocketIOServer {
  const socketAllowedOrigins =
    env.NODE_ENV === "production"
      ? [env.CLIENT_URL.replace(/\/$/, "")]
      : [env.CLIENT_URL, "http://localhost:5173", "http://localhost:3000"].map((o) =>
          o.replace(/\/$/, "")
        );

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: socketAllowedOrigins,
      credentials: true,
      methods: ["GET", "POST"],
    },
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // Authentication Middleware
  io.use(async (socket, next) => {
    try {
      const token = extractToken(socket);
      if (!token) {
        return next(new Error("UNAUTHORIZED: Authentication token required"));
      }

      const payload = AuthService.verifyToken(token);
      const user = await User.findById(payload.id);

      if (!user) {
        return next(new Error("UNAUTHORIZED: User account no longer exists"));
      }

      if (user.status === "SUSPENDED") {
        return next(new Error("FORBIDDEN: User account suspended"));
      }

      if (payload.tokenVersion !== user.tokenVersion) {
        return next(new Error("UNAUTHORIZED: Session revoked"));
      }

      socket.data = {
        userId: user._id.toString(),
        email: user.email,
        displayName: user.displayName,
        tokenVersion: user.tokenVersion,
      };

      next();
    } catch {
      next(new Error("UNAUTHORIZED: Invalid or expired token"));
    }
  });

  // Connection Handler
  io.on("connection", (socket: AuthenticatedSocket) => {
    const userId = socket.data.userId;

    // Automatically join the user's private notification room
    socket.join(`user:${userId}`);

    // Join Team Room (Authorized to active team members only)
    // Implements double-checked join-then-reverify to close the join-vs-eviction race window.
    socket.on(
      "join:team",
      async (
        payload: { teamId?: string },
        ack?: (res: { success: boolean; error?: string }) => void
      ) => {
        try {
          const teamId = payload?.teamId;
          if (!teamId || !Types.ObjectId.isValid(teamId)) {
            ack?.({ success: false, error: "VALIDATION_ERROR: Invalid team ID" });
            return;
          }

          const teamObjectId = new Types.ObjectId(teamId);
          const userObjectId = new Types.ObjectId(userId);
          const roomName = `team:${teamId}`;

          const isMemberInitially = await Membership.exists({
            teamId: teamObjectId,
            userId: userObjectId,
            status: "ACTIVE",
          });

          if (!isMemberInitially) {
            ack?.({
              success: false,
              error: "FORBIDDEN: Must be an active member to join team room",
            });
            return;
          }

          if (options.onBeforeTeamRoomJoin) {
            await options.onBeforeTeamRoomJoin({ teamId, userId });
          }

          await socket.join(roomName);

          // Re-verify active membership AFTER entering the room so any concurrent
          // post-commit removal/disbandment that raced ahead of socket.join is caught.
          const isStillMember = await Membership.exists({
            teamId: teamObjectId,
            userId: userObjectId,
            status: "ACTIVE",
          });

          if (!isStillMember) {
            await socket.leave(roomName);
            ack?.({
              success: false,
              error: "FORBIDDEN: Membership is no longer active",
            });
            return;
          }

          ack?.({ success: true });
        } catch {
          ack?.({ success: false, error: "INTERNAL_ERROR: Failed to join team room" });
        }
      }
    );

    // Leave Team Room
    socket.on(
      "leave:team",
      (payload: { teamId?: string }, ack?: (res: { success: boolean }) => void) => {
        const teamId = payload?.teamId;
        if (teamId && Types.ObjectId.isValid(teamId)) {
          socket.leave(`team:${teamId}`);
        }
        ack?.({ success: true });
      }
    );

    // Join Hackathon Room (Public team directory / capacity events)
    socket.on(
      "join:hackathon",
      async (
        payload: { hackathonId?: string },
        ack?: (res: { success: boolean; error?: string }) => void
      ) => {
        try {
          const hackathonId = payload?.hackathonId;
          if (!hackathonId || !Types.ObjectId.isValid(hackathonId)) {
            ack?.({ success: false, error: "VALIDATION_ERROR: Invalid hackathon ID" });
            return;
          }

          const hackathonExists = await Hackathon.exists({ _id: new Types.ObjectId(hackathonId) });
          if (!hackathonExists) {
            ack?.({ success: false, error: "NOT_FOUND: Hackathon not found" });
            return;
          }

          socket.join(`hackathon:${hackathonId}`);
          ack?.({ success: true });
        } catch {
          ack?.({ success: false, error: "INTERNAL_ERROR: Failed to join hackathon room" });
        }
      }
    );

    // Leave Hackathon Room
    socket.on(
      "leave:hackathon",
      (payload: { hackathonId?: string }, ack?: (res: { success: boolean }) => void) => {
        const hackathonId = payload?.hackathonId;
        if (hackathonId && Types.ObjectId.isValid(hackathonId)) {
          socket.leave(`hackathon:${hackathonId}`);
        }
        ack?.({ success: true });
      }
    );
  });

  return io;
}

/**
 * Returns the current Socket.IO server instance, if initialized
 */
export function getSocketServer(): SocketIOServer | null {
  return io;
}

/**
 * Closes the Socket.IO server instance (for clean shutdown and testing)
 */
export async function closeSocketServer(): Promise<void> {
  if (io) {
    await io.close();
    io = null;
  }
}
