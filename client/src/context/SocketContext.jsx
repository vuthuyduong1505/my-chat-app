import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import GlobalMessageNotifier from "../components/GlobalMessageNotifier";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token, isAuthenticated, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(() => new Set());
  /** ID người bạn đang mở khung chat — dùng để không tăng số chưa đọc khi đang xem cuộc trò chuyện đó */
  const [activeChatFriendId, setActiveChatFriendId] = useState(null);
  /** Số tin chưa đọc theo từng bạn: { [userId]: count } */
  const [unreadCounts, setUnreadCounts] = useState({});

  const currentUserId = useMemo(() => {
    if (user?.id) return String(user.id);
    if (user?._id) return String(user._id);
    try {
      const raw = localStorage.getItem("auth_user");
      if (raw) {
        const parsed = JSON.parse(raw);
        return String(parsed?.id || parsed?._id || "");
      }
    } catch {
      /* ignore */
    }
    return "";
  }, [user]);

  const activeChatFriendIdRef = useRef(activeChatFriendId);
  useEffect(() => {
    activeChatFriendIdRef.current = activeChatFriendId;
  }, [activeChatFriendId]);

  const markFriendAsRead = useCallback((friendId) => {
    if (!friendId) return;
    const key = String(friendId);
    setUnreadCounts((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

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

  useEffect(() => {
    if (!socket || !currentUserId) return undefined;

    const onNewMessage = (msg) => {
      const me = String(currentUserId);
      const senderId = String(msg.sender);
      const receiverId = String(msg.receiver);

      // Chỉ xử lý tin gửi đến mình, bỏ qua tin do chính mình gửi (optimistic / echo)
      if (senderId === me || receiverId !== me) return;

      // Đang mở đúng cuộc chat với người gửi → coi như đã đọc, không tăng badge
      const activeId = activeChatFriendIdRef.current;
      if (activeId && senderId === String(activeId)) return;

      setUnreadCounts((prev) => ({
        ...prev,
        [senderId]: (prev[senderId] || 0) + 1
      }));
    };

    socket.on("new_message", onNewMessage);
    return () => {
      socket.off("new_message", onNewMessage);
    };
  }, [socket, currentUserId]);

  const value = useMemo(
    () => ({
      socket,
      connected,
      onlineUsers,
      unreadCounts,
      activeChatFriendId,
      setActiveChatFriendId,
      markFriendAsRead
    }),
    [socket, connected, onlineUsers, unreadCounts, activeChatFriendId, markFriendAsRead]
  );

  return (
    <SocketContext.Provider value={value}>
      <GlobalMessageNotifier />
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) {
    throw new Error("useSocket must be used within SocketProvider");
  }
  return ctx;
}
