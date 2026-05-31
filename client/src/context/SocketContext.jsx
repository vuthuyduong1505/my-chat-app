import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import GlobalMessageNotifier from "../components/GlobalMessageNotifier";
import {
  dispatchConversationActivity,
  isDuplicateConversationMessage
} from "../utils/conversationEvents";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { token, isAuthenticated, user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(() => new Set());
  /** ID bạn bè đang mở khung chat 1-1 */
  const [activeChatFriendId, setActiveChatFriendId] = useState(null);
  /** ID nhóm đang mở khung chat nhóm */
  const [activeChatGroupId, setActiveChatGroupId] = useState(null);
  /** Tin chưa đọc theo bạn: { [userId]: count } */
  const [unreadCounts, setUnreadCounts] = useState({});
  /** Tin chưa đọc theo nhóm: { [groupId]: count } */
  const [groupUnreadCounts, setGroupUnreadCounts] = useState({});

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
  const activeChatGroupIdRef = useRef(activeChatGroupId);
  useEffect(() => {
    activeChatFriendIdRef.current = activeChatFriendId;
  }, [activeChatFriendId]);
  useEffect(() => {
    activeChatGroupIdRef.current = activeChatGroupId;
  }, [activeChatGroupId]);

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

  const markGroupAsRead = useCallback((groupId) => {
    if (!groupId) return;
    const key = String(groupId);
    setGroupUnreadCounts((prev) => {
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
      if (isDuplicateConversationMessage(msg)) return;

      // Báo HomePage cập nhật preview + đẩy đoạn chat lên đầu (cả tin mình gửi và tin nhận)
      dispatchConversationActivity(msg);

      const me = String(currentUserId);
      const senderId = String(
        msg.senderId ||
          (msg.sender && typeof msg.sender === "object" ? msg.sender._id || msg.sender.id : msg.sender) ||
          ""
      );

      // Badge nhóm: chỉ tăng khi không mở khung chat nhóm đó và không phải tin tự gửi
      if (msg.groupId) {
        if (senderId === me) return;
        const gid = String(msg.groupId);
        const activeGroupId = activeChatGroupIdRef.current;
        if (activeGroupId && gid === String(activeGroupId)) return;

        setGroupUnreadCounts((prev) => ({
          ...prev,
          [gid]: (prev[gid] || 0) + 1
        }));
        return;
      }

      const receiverId = String(msg.receiver);
      if (senderId === me || receiverId !== me) return;

      const activeId = activeChatFriendIdRef.current;
      if (activeId && senderId === String(activeId)) return;

      setUnreadCounts((prev) => ({
        ...prev,
        [senderId]: (prev[senderId] || 0) + 1
      }));
    };

    /**
     * Join Room tự động khi được thêm vào nhóm (phía client):
     * Server đã phát added_to_group và có thể đã join phòng group:{id} trên socket server.
     * Client vẫn emit join_group_chat để đảm bảo tab hiện tại vào đúng phòng,
     * rồi báo HomePage tải lại danh sách nhóm — không cần reconnect hay F5.
     */
    const onAddedToGroup = (data) => {
      const gid = data?.group?._id || data?.group?.id;
      if (!gid) return;
      socket.emit("join_group_chat", { groupId: String(gid) });
      window.dispatchEvent(new CustomEvent("groups-updated"));
    };

    socket.on("new_message", onNewMessage);
    socket.on("added_to_group", onAddedToGroup);

    return () => {
      socket.off("new_message", onNewMessage);
      socket.off("added_to_group", onAddedToGroup);
    };
  }, [socket, currentUserId]);

  const value = useMemo(
    () => ({
      socket,
      connected,
      onlineUsers,
      unreadCounts,
      groupUnreadCounts,
      activeChatFriendId,
      activeChatGroupId,
      setActiveChatFriendId,
      setActiveChatGroupId,
      markFriendAsRead,
      markGroupAsRead
    }),
    [
      socket,
      connected,
      onlineUsers,
      unreadCounts,
      groupUnreadCounts,
      activeChatFriendId,
      activeChatGroupId,
      markFriendAsRead,
      markGroupAsRead
    ]
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
