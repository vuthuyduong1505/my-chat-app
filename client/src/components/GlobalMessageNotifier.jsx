import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

const NOTIFICATION_SOUND_URL =
  "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3";

function friendDisplayName(friend) {
  const name = `${friend?.firstName || ""} ${friend?.lastName || ""}`.trim();
  return name || friend?.email || "Bạn bè";
}

function messagePreview(msg) {
  const text = typeof msg.content === "string" ? msg.content.trim() : "";
  if (text) return text.length > 60 ? `${text.slice(0, 60)}…` : text;
  if (msg.fileType === "image") return "Đã gửi ảnh";
  if (msg.fileType === "file") return msg.fileName || "Đã gửi tệp đính kèm";
  return "Tin nhắn mới";
}

function friendKey(friend) {
  return String(friend._id || friend.id || "");
}

/** Toast + âm thanh khi có tin mới — chạy trên mọi trang, không phụ thuộc HomePage */
export default function GlobalMessageNotifier() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { socket, activeChatFriendId } = useSocket();
  const friendsRef = useRef([]);
  const audioRef = useRef(null);
  const currentUserIdRef = useRef("");

  const resolveCurrentUserId = () => {
    try {
      const raw = localStorage.getItem("auth_user");
      if (!raw) return "";
      const parsed = JSON.parse(raw);
      return String(parsed?.id || parsed?._id || "");
    } catch {
      return "";
    }
  };

  useEffect(() => {
    currentUserIdRef.current = resolveCurrentUserId();
  });

  useEffect(() => {
    audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
    audioRef.current.volume = 0.45;
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      friendsRef.current = [];
      return undefined;
    }

    const loadFriends = async () => {
      try {
        const res = await api.get("/users/friends");
        friendsRef.current = res.data?.friends || [];
      } catch {
        friendsRef.current = [];
      }
    };

    loadFriends();
    window.addEventListener("social-updated", loadFriends);
    return () => window.removeEventListener("social-updated", loadFriends);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!socket) return undefined;

    const onIncoming = (msg) => {
      const me = currentUserIdRef.current || resolveCurrentUserId();
      if (!me) return;

      const senderId = String(msg.sender);
      const receiverId = String(msg.receiver);

      if (senderId === me || receiverId !== me) return;

      const activeId = activeChatFriendId ? String(activeChatFriendId) : null;
      if (activeId && senderId === activeId) return;

      const friend = friendsRef.current.find((f) => friendKey(f) === senderId);
      const senderName = friend ? friendDisplayName(friend) : "Bạn bè";
      const preview = messagePreview(msg);

      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }

      toast(
        (t) => (
          <button
            type="button"
            onClick={() => {
              navigate(`/chat/${senderId}`);
              toast.dismiss(t.id);
            }}
            className="flex w-full min-w-[240px] max-w-sm flex-col rounded-xl border border-[#00BFA5]/30 bg-[#003B44] px-4 py-3 text-left shadow-lg transition hover:bg-[#004a54]"
          >
            <span className="text-xs font-semibold text-[#00BFA5]">{senderName}</span>
            <span className="mt-1 line-clamp-2 text-sm text-light/95">{preview}</span>
            <span className="mt-1.5 text-[10px] text-light/50">Nhấn để mở cuộc trò chuyện</span>
          </button>
        ),
        { duration: 5000, position: "top-right" }
      );
    };

    socket.on("new_message", onIncoming);
    return () => {
      socket.off("new_message", onIncoming);
    };
  }, [socket, activeChatFriendId, navigate]);

  return null;
}
