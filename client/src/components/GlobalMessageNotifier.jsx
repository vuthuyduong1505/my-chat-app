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

function memberDisplayName(member) {
  const name = `${member?.firstName || ""} ${member?.lastName || ""}`.trim();
  return name || member?.email || "Thành viên";
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

function groupKey(group) {
  return String(group._id || group.id || "");
}

function playNotificationSound(audioRef) {
  const audio = audioRef.current;
  if (!audio) return;
  audio.currentTime = 0;
  audio.play().catch(() => {});
}

const toastClass =
  "flex w-full min-w-[240px] max-w-sm flex-col rounded-xl border border-[#00BFA5]/30 bg-[#003B44] px-4 py-3 text-left shadow-lg transition hover:bg-[#004a54]";

/** Toast + âm thanh cho tin DM và tin nhóm — chạy trên mọi trang */
export default function GlobalMessageNotifier() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { socket, activeChatFriendId, activeChatGroupId } = useSocket();
  const friendsRef = useRef([]);
  const groupsRef = useRef([]);
  const conversationsRef = useRef([]);
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
      groupsRef.current = [];
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

    const loadGroups = async () => {
      try {
        const res = await api.get("/groups");
        groupsRef.current = res.data?.groups || [];
      } catch {
        groupsRef.current = [];
      }
    };

    const loadConversations = async () => {
      try {
        const res = await api.get("/conversations");
        conversationsRef.current = res.data?.conversations || [];
      } catch {
        conversationsRef.current = [];
      }
    };

    const onGroupsUpdated = () => {
      loadGroups();
      loadConversations();
    };

    loadFriends();
    loadGroups();
    loadConversations();
    window.addEventListener("social-updated", loadFriends);
    window.addEventListener("groups-updated", onGroupsUpdated);
    return () => {
      window.removeEventListener("social-updated", loadFriends);
      window.removeEventListener("groups-updated", onGroupsUpdated);
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!socket) return undefined;

    const onIncomingDm = (msg) => {
      const me = currentUserIdRef.current || resolveCurrentUserId();
      if (!me) return;

      if (msg.groupId) return;

      const senderId = String(
        msg.senderId ||
          (msg.sender && typeof msg.sender === "object" ? msg.sender._id || msg.sender.id : msg.sender) ||
          ""
      );
      const receiverId = String(msg.receiver);

      if (senderId === me || receiverId !== me) return;

      const activeId = activeChatFriendId ? String(activeChatFriendId) : null;
      if (activeId && senderId === activeId) return;

      const friend = friendsRef.current.find((f) => friendKey(f) === senderId);
      const senderName = friend ? friendDisplayName(friend) : "Bạn bè";
      const preview = messagePreview(msg);

      playNotificationSound(audioRef);

      toast(
        (t) => (
          <button
            type="button"
            onClick={() => {
              navigate(`/chat/${senderId}`);
              toast.dismiss(t.id);
            }}
            className={toastClass}
          >
            <span className="text-xs font-semibold text-[#00BFA5]">{senderName}</span>
            <span className="mt-1 line-clamp-2 text-sm text-light/95">{preview}</span>
            <span className="mt-1.5 text-[10px] text-light/50">Nhấn để mở cuộc trò chuyện</span>
          </button>
        ),
        { duration: 5000, position: "top-right" }
      );
    };

    const onIncomingGroup = (msg) => {
      const me = currentUserIdRef.current || resolveCurrentUserId();
      if (!me || !msg.groupId) return;

      const senderId = String(
        msg.senderId ||
          (msg.sender && typeof msg.sender === "object" ? msg.sender._id || msg.sender.id : msg.sender) ||
          ""
      );
      if (senderId === me) return;

      const gid = String(msg.groupId);
      const activeGroupId = activeChatGroupId ? String(activeChatGroupId) : null;
      if (activeGroupId && gid === activeGroupId) return;

      const conv = conversationsRef.current.find((c) => c.type === "group" && String(c.id) === gid);
      const group = groupsRef.current.find((g) => groupKey(g) === gid) || conv?.group;
      const groupName = conv?.title || group?.name || "Nhóm chat";

      let senderName = msg.senderName || "";
      if (!senderName && msg.sender && typeof msg.sender === "object" && msg.sender.firstName) {
        senderName = memberDisplayName(msg.sender);
      }
      if (!senderName && group?.members) {
        const member = group.members.find((m) => friendKey(m) === senderId);
        if (member) senderName = memberDisplayName(member);
      }
      if (!senderName) {
        const friend = friendsRef.current.find((f) => friendKey(f) === senderId);
        senderName = friend ? friendDisplayName(friend) : "Thành viên";
      }

      const preview = messagePreview(msg);
      const toastLine = `${groupName} - ${senderName}: ${preview}`;

      playNotificationSound(audioRef);

      toast(
        (t) => (
          <button
            type="button"
            onClick={() => {
              navigate(`/group/${gid}`);
              toast.dismiss(t.id);
            }}
            className={toastClass}
          >
            <span className="line-clamp-3 text-sm font-medium text-[#00BFA5]">{toastLine}</span>
            <span className="mt-1.5 text-[10px] text-light/50">Nhấn để mở nhóm</span>
          </button>
        ),
        { duration: 5000, position: "top-right" }
      );
    };

    const onAddedToGroup = (data) => {
      const me = currentUserIdRef.current || resolveCurrentUserId();
      if (!me) return;

      const addedById = String(data?.addedBy?._id || data?.addedBy?.id || "");
      if (addedById === me) return;

      const group = data?.group;
      const gid = group?._id || group?.id;
      if (!gid) return;

      const addedByName = data?.addedByName || memberDisplayName(data?.addedBy) || "Ai đó";
      const groupName = group?.name || "nhóm mới";

      if (!groupsRef.current.some((g) => groupKey(g) === String(gid))) {
        groupsRef.current = [group, ...groupsRef.current];
      }

      playNotificationSound(audioRef);

      toast(
        (t) => (
          <button
            type="button"
            onClick={() => {
              navigate(`/group/${gid}`);
              toast.dismiss(t.id);
            }}
            className={toastClass}
          >
            <span className="text-xs font-semibold text-[#00BFA5]">Được thêm vào nhóm</span>
            <span className="mt-1 line-clamp-2 text-sm text-light/95">
              {addedByName} đã thêm bạn vào nhóm &quot;{groupName}&quot;
            </span>
            <span className="mt-1.5 text-[10px] text-light/50">Nhấn để mở nhóm</span>
          </button>
        ),
        { duration: 6000, position: "top-right" }
      );
    };

    const onConversationActivity = (event) => {
      const msg = event.detail;
      if (!msg) return;
      if (msg.groupId) onIncomingGroup(msg);
      else onIncomingDm(msg);
    };

    window.addEventListener("conversation-activity", onConversationActivity);
    socket.on("added_to_group", onAddedToGroup);

    return () => {
      window.removeEventListener("conversation-activity", onConversationActivity);
      socket.off("added_to_group", onAddedToGroup);
    };
  }, [socket, activeChatFriendId, activeChatGroupId, navigate]);

  return null;
}
