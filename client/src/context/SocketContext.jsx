import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(() => new Set());

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setSocket((prev) => {
        if (prev) prev.disconnect();
        return null;
      });
      setConnected(false);
      setOnlineUsers(new Set());
      return undefined;
    }

    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
    const socketUrl = apiBase.replace(/\/api\/?$/, "");

    const s = io(socketUrl, {
      auth: { token },
      transports: ["websocket", "polling"]
    });

    const onConnect = () => setConnected(true);
    const onDisconnect = () => {
      setConnected(false);
      setOnlineUsers(new Set());
    };

    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);

    setSocket(s);

    return () => {
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
      s.disconnect();
      setConnected(false);
      setOnlineUsers(new Set());
    };
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (!socket) {
      setOnlineUsers(new Set());
      return undefined;
    }

    const onOnlineUsers = (ids) => {
      setOnlineUsers(new Set((ids || []).map(String)));
    };

    const onUserOnline = ({ userId: uid }) => {
      if (!uid) return;
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.add(String(uid));
        return next;
      });
    };

    const onUserOffline = ({ userId: uid }) => {
      if (!uid) return;
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(String(uid));
        return next;
      });
    };

    socket.on("online_users", onOnlineUsers);
    socket.on("user_online", onUserOnline);
    socket.on("user_offline", onUserOffline);

    return () => {
      socket.off("online_users", onOnlineUsers);
      socket.off("user_online", onUserOnline);
      socket.off("user_offline", onUserOffline);
    };
  }, [socket]);

  const value = useMemo(() => ({ socket, connected, onlineUsers }), [socket, connected, onlineUsers]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error("useSocket must be used within SocketProvider");
  }
  return ctx;
}
