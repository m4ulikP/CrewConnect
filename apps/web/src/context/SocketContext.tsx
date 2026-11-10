import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "./AuthContext";

export type SocketConnectionState = "connected" | "connecting" | "reconnecting" | "disconnected";

interface SocketContextType {
  socket: Socket | null;
  connectionState: SocketConnectionState;
  joinHackathonRoom: (hackathonId: string) => void;
  leaveHackathonRoom: (hackathonId: string) => void;
  joinTeamRoom: (teamId: string) => void;
  leaveTeamRoom: (teamId: string) => void;
}

const DEFAULT_SOCKET_CONTEXT: SocketContextType = {
  socket: null,
  connectionState: "disconnected",
  joinHackathonRoom: () => {},
  leaveHackathonRoom: () => {},
  joinTeamRoom: () => {},
  leaveTeamRoom: () => {},
};

export const SocketContext = createContext<SocketContextType>(DEFAULT_SOCKET_CONTEXT);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionState, setConnectionState] = useState<SocketConnectionState>("disconnected");

  const activeHackathonsRef = useRef<Set<string>>(new Set());
  const activeTeamsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      setConnectionState("disconnected");
      setSocket((prev) => {
        if (prev) {
          prev.disconnect();
        }
        return null;
      });
      activeHackathonsRef.current.clear();
      activeTeamsRef.current.clear();
      return;
    }

    setConnectionState("connecting");

    const socketUrl = import.meta.env.VITE_SOCKET_URL || window.location.origin;

    const newSocket = io(socketUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });

    newSocket.on("connect", () => {
      setConnectionState("connected");

      // Automatically re-join tracked rooms after initial connect or reconnect
      // (Server still authorizes membership on every join:team call)
      activeHackathonsRef.current.forEach((hackathonId) => {
        newSocket.emit("join:hackathon", { hackathonId });
      });
      activeTeamsRef.current.forEach((teamId) => {
        newSocket.emit("join:team", { teamId }, (ack?: { success: boolean; error?: string }) => {
          if (ack && !ack.success) {
            activeTeamsRef.current.delete(teamId);
          }
        });
      });
    });

    newSocket.on("disconnect", () => {
      setConnectionState("disconnected");
    });

    newSocket.io.on("reconnect_attempt", () => {
      setConnectionState("reconnecting");
    });

    newSocket.io.on("reconnect_error", () => {
      setConnectionState("reconnecting");
    });

    newSocket.io.on("reconnect_failed", () => {
      setConnectionState("disconnected");
    });

    newSocket.on("connect_error", () => {
      setConnectionState("disconnected");
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      setSocket(null);
      setConnectionState("disconnected");
    };
  }, [user]);

  const joinHackathonRoom = useCallback(
    (hackathonId: string) => {
      if (!hackathonId) return;
      activeHackathonsRef.current.add(hackathonId);
      if (socket && socket.connected) {
        socket.emit("join:hackathon", { hackathonId });
      }
    },
    [socket]
  );

  const leaveHackathonRoom = useCallback(
    (hackathonId: string) => {
      if (!hackathonId) return;
      activeHackathonsRef.current.delete(hackathonId);
      if (socket && socket.connected) {
        socket.emit("leave:hackathon", { hackathonId });
      }
    },
    [socket]
  );

  const joinTeamRoom = useCallback(
    (teamId: string) => {
      if (!teamId) return;
      activeTeamsRef.current.add(teamId);
      if (socket && socket.connected) {
        socket.emit("join:team", { teamId }, (ack?: { success: boolean; error?: string }) => {
          if (ack && !ack.success) {
            activeTeamsRef.current.delete(teamId);
          }
        });
      }
    },
    [socket]
  );

  const leaveTeamRoom = useCallback(
    (teamId: string) => {
      if (!teamId) return;
      activeTeamsRef.current.delete(teamId);
      if (socket && socket.connected) {
        socket.emit("leave:team", { teamId });
      }
    },
    [socket]
  );

  return (
    <SocketContext.Provider
      value={{
        socket,
        connectionState,
        joinHackathonRoom,
        leaveHackathonRoom,
        joinTeamRoom,
        leaveTeamRoom,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export function useSocket(): SocketContextType {
  return useContext(SocketContext);
}
