import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MoreHorizontal, Search } from "lucide-react";
import toast from "react-hot-toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import api from "../api";
import ChatWindow from "../components/ChatWindow";
import CreateGroupModal from "../components/CreateGroupModal";
import GroupAvatar from "../components/GroupAvatar";
import UserAvatar from "../components/UserAvatar";
import { getCallingName, getCallingNameFromFullName } from "../utils/displayName";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

function friendDisplayName(friend) {
  const name = `${friend?.firstName || ""} ${friend?.lastName || ""}`.trim();
  return name || friend?.email || "Người dùng";
}

function getSenderId(msg) {
  if (msg?.senderId) return String(msg.senderId);
  const raw = msg?.sender;
  if (!raw) return "";
  if (typeof raw === "object") return String(raw._id || raw.id || "");
  return String(raw);
}

/** Tạo dòng xem trước tin cuối (đồng bộ với server conversations API) */
function buildPreviewFromMessage(msg, meId, { user, peer, group } = {}) {
  const sid = getSenderId(msg);
  const isMe = sid === String(meId);
  let label = "Bạn";

  if (!isMe) {
    if (typeof msg.sender === "object" && (msg.sender?.firstName || msg.sender?.lastName)) {
      label = getCallingName(msg.sender) || "Thành viên";
    } else if (msg.senderName) {
      label = getCallingNameFromFullName(msg.senderName) || msg.senderName;
    } else if (peer?.firstName || peer?.lastName) {
      label = getCallingName(peer) || "Thành viên";
    } else if (group?.members) {
      const member = group.members.find((m) => String(m._id || m.id) === sid);
      label = member ? getCallingName(member) || "Thành viên" : "Thành viên";
    } else {
      label = "Thành viên";
    }
  }

  if (msg.isRecalled) return `${label}: Tin nhắn đã bị thu hồi`;
  if (msg.fileType === "image") return `${label}: đã gửi 1 ảnh`;
  if (msg.fileType === "file") return `${label}: đã gửi tệp đính kèm`;
  const text = (msg.content || "").trim();
  const snippet = text.length > 48 ? `${text.slice(0, 48)}…` : text || "Tin nhắn mới";
  return `${label}: ${snippet}`;
}

function UnreadBadge({ count }) {
  if (!count || count <= 0) return null;
  return (
    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-none text-white shadow-sm">
      {count > 99 ? "99+" : count}
    </span>
  );
}

/**
 * Sắp xếp danh sách đoạn chat theo tin nhắn mới nhất (sort by last message):
 * - lastActivityAt càng mới → index càng nhỏ (lên đầu Sidebar).
 * - Đoạn chat chưa có tin (lastActivityAt null) xếp xuống dưới, tie-break theo tên.
 * - Gọi sau mỗi lần API load hoặc socket conversation-activity cập nhật preview.
 */
function sortConversationsByLastActivity(list) {
  return [...list].sort((a, b) => {
    const ta = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
    const tb = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
    if (tb !== ta) return tb - ta;
    return (a.title || "").localeCompare(b.title || "", "vi");
  });
}

function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const isGroupRoute = location.pathname.startsWith("/group");
  const userId = !isGroupRoute ? params.userId : undefined;
  const groupId = isGroupRoute ? params.groupId : undefined;

  const { user } = useAuth();
  const {
    socket,
    onlineUsers,
    unreadCounts,
    groupUnreadCounts,
    setActiveChatFriendId,
    setActiveChatGroupId,
    markFriendAsRead,
    markGroupAsRead
  } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsRef = useRef(null);

  const currentUserId = useMemo(() => {
    if (user?.id) return String(user.id);
    if (user?._id) return String(user._id);
    const rawUser = localStorage.getItem("auth_user");
    if (!rawUser) return "";
    try {
      const parsedUser = JSON.parse(rawUser);
      return String(parsedUser?.id || parsedUser?._id || "");
    } catch {
      return "";
    }
  }, [user]);

  const loadConversations = useCallback(async (options = {}) => {
    const { silent = false } = options;
    if (!silent) setLoadingList(true);
    try {
      const response = await api.get("/conversations");
      setConversations(sortConversationsByLastActivity(response.data?.conversations || []));
    } catch (err) {
      console.error("loadConversations failed:", err);
      if (!silent) {
        setConversations([]);
        toast.error(err?.response?.data?.message || "Không thể tải danh sách đoạn chat. Kiểm tra server đã chạy.");
      }
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [currentUserId, loadConversations]);

  useEffect(() => {
    const onGroupsUpdated = () => loadConversations({ silent: true });
    window.addEventListener("groups-updated", onGroupsUpdated);
    return () => window.removeEventListener("groups-updated", onGroupsUpdated);
  }, [loadConversations]);

  useEffect(() => {
    if (!actionsOpen) return undefined;
    const close = (e) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target)) {
        setActionsOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [actionsOpen]);

  const onlineUserSet = useMemo(
    () =>
      onlineUsers instanceof Set
        ? onlineUsers
        : new Set(Array.isArray(onlineUsers) ? onlineUsers.map(String) : []),
    [onlineUsers]
  );

  /**
   * Logic gộp danh sách "Đoạn chat" (Messenger-style):
   * - Server trả về cả DM (type: dm) và nhóm (type: group) trong một mảng,
   *   đã sắp xếp theo lastActivityAt (tin mới nhất lên đầu).
   * - Client chỉ lọc theo ô tìm kiếm (tên bạn + tên nhóm), không tách tab.
   * - Mỗi mục mang type + id để điều hướng /chat/:userId hoặc /group/:groupId.
   * - Socket (conversation-activity) cập nhật lastActivityAt → sortConversationsByLastActivity đẩy mục lên đầu.
   */
  const sortedConversations = useMemo(
    () => sortConversationsByLastActivity(conversations),
    [conversations]
  );

  const filteredConversations = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return sortedConversations;
    return sortedConversations.filter((conv) => {
      const title = (conv.title || "").toLowerCase();
      if (title.includes(keyword)) return true;
      if (conv.type === "dm" && conv.peer?.email?.toLowerCase().includes(keyword)) return true;
      return false;
    });
  }, [sortedConversations, searchQuery]);

  const activeChatKey = isGroupRoute && groupId ? `group:${groupId}` : userId ? `dm:${userId}` : null;

  useEffect(() => {
    if (!activeChatKey || loadingList) return;

    const conv = conversations.find(
      (c) => (c.type === "group" ? `group:${c.id}` : `dm:${c.id}`) === activeChatKey
    );

    if (conv?.type === "dm") {
      setSelectedFriend(conv.peer);
      setSelectedGroup(null);
    } else if (conv?.type === "group") {
      setSelectedGroup(conv.group);
      setSelectedFriend(null);
    }
  }, [activeChatKey, conversations, loadingList]);

  useEffect(() => {
    if (isGroupRoute) {
      setActiveChatFriendId(null);
      setActiveChatGroupId(groupId ? String(groupId) : null);
      if (groupId) markGroupAsRead(groupId);
      return;
    }
    setActiveChatGroupId(null);
    setActiveChatFriendId(userId ? String(userId) : null);
    if (userId) markFriendAsRead(userId);
  }, [
    userId,
    groupId,
    isGroupRoute,
    setActiveChatFriendId,
    setActiveChatGroupId,
    markFriendAsRead,
    markGroupAsRead
  ]);

  const bumpConversationFromMessage = useCallback(
    (msg) => {
      const me = currentUserId;
      if (!me) return;

      const msgSenderId = getSenderId(msg);
      let type;
      let convId;

      if (msg.groupId) {
        type = "group";
        convId = String(msg.groupId);
      } else {
        type = "dm";
        convId = msgSenderId === me ? String(msg.receiver) : msgSenderId;
      }
      if (!convId) return;

      setConversations((prev) => {
        const key = type === "group" ? `group:${convId}` : `dm:${convId}`;
        const idx = prev.findIndex((c) => (c.type === "group" ? `group:${c.id}` : `dm:${c.id}`) === key);
        if (idx === -1) {
          loadConversations();
          return prev;
        }

        const existing = prev[idx];
        const peer = existing.peer;
        const group = existing.group;
        const preview = buildPreviewFromMessage(msg, me, { user, peer, group });

        const updated = {
          ...existing,
          lastMessage: {
            preview,
            senderId: msgSenderId,
            createdAt: msg.createdAt || new Date().toISOString()
          },
          lastActivityAt: msg.createdAt || new Date().toISOString()
        };

        const rest = prev.filter((_, i) => i !== idx);
        return sortConversationsByLastActivity([updated, ...rest]);
      });
    },
    [currentUserId, user, loadConversations]
  );

  useEffect(() => {
    const onActivity = (event) => {
      const msg = event.detail;
      if (msg) bumpConversationFromMessage(msg);
    };
    window.addEventListener("conversation-activity", onActivity);
    return () => window.removeEventListener("conversation-activity", onActivity);
  }, [bumpConversationFromMessage]);

  const handleSelectConversation = (conv) => {
    if (conv.type === "dm") {
      markFriendAsRead(conv.id);
      navigate(`/chat/${conv.id}`);
    } else {
      markGroupAsRead(conv.id);
      navigate(`/group/${conv.id}`);
    }
  };

  const handleGroupChange = useCallback((updated) => {
    setSelectedGroup(updated);
    setConversations((prev) =>
      prev.map((c) =>
        c.type === "group" && String(c.id) === String(updated._id)
          ? {
              ...c,
              title: updated.name || c.title,
              group: { ...c.group, ...updated }
            }
          : c
      )
    );
  }, []);

  const handleLeaveGroup = useCallback(() => {
    setSelectedGroup(null);
    loadConversations();
  }, [loadConversations]);

  const handleGroupCreated = (group) => {
    loadConversations();
    socket?.emit("refresh_group_rooms");
    setActionsOpen(false);
    if (group?._id) {
      navigate(`/group/${group._id}`);
    }
  };

  const getUnread = (conv) => {
    if (conv.type === "dm") return unreadCounts[conv.id] || 0;
    return groupUnreadCounts[conv.id] || 0;
  };

  return (
    <div className="flex h-full min-h-0 flex-1 gap-3 p-3 md:gap-4 md:p-4">
      <aside className="flex w-[min(100%,340px)] min-w-[260px] max-w-[36%] flex-col rounded-2xl border border-primary/8 bg-accent/80 p-4 pt-5 shadow-sm backdrop-blur-sm">
        <div className="relative flex items-center justify-between gap-2 pt-1">
          <h2 className="text-2xl font-bold tracking-tight text-[#003B44] md:text-3xl">Đoạn chat</h2>
          <div className="relative" ref={actionsRef}>
            <button
              type="button"
              onClick={() => setActionsOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[#003B44]/70 transition hover:bg-[#003B44]/8 hover:text-[#003B44]"
              aria-label="Tuỳ chọn đoạn chat"
              aria-expanded={actionsOpen}
            >
              <MoreHorizontal size={20} />
            </button>
            {actionsOpen ? (
              <div className="absolute right-0 top-full z-20 mt-1 min-w-[180px] overflow-hidden rounded-xl border border-[#003B44]/12 bg-light py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateGroup(true);
                    setActionsOpen(false);
                  }}
                  className="block w-full px-4 py-2.5 text-left text-sm text-[#003B44] transition hover:bg-[#003B44]/5"
                >
                  Tạo nhóm mới
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-[#003B44]/15 bg-light/90 px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-[#00BFA5]/40">
          <Search size={16} className="shrink-0 text-[#00BFA5]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm tên hoặc nhóm..."
            className="min-w-0 flex-1 bg-transparent text-sm text-[#003B44] outline-none placeholder:text-[#003B44]/40"
          />
        </div>

        <div className="mt-3 flex-1 space-y-0.5 overflow-y-auto pr-0.5">
          {loadingList ? (
            <div className="flex items-center justify-center rounded-2xl border border-primary/5 bg-light px-3 py-8 text-[#003B44]/50">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <p className="rounded-2xl border border-primary/5 bg-light px-3 py-4 text-center text-sm text-[#003B44]/55">
              {conversations.length === 0
                ? "Chưa có đoạn chat. Kết bạn hoặc tạo nhóm để bắt đầu."
                : "Không tìm thấy kết quả"}
            </p>
          ) : (
            filteredConversations.map((conv) => {
              const convKey = conv.type === "group" ? `group:${conv.id}` : `dm:${conv.id}`;
              const selected = activeChatKey === convKey;
              const unread = getUnread(conv);
              const isOnline = conv.type === "dm" && onlineUserSet.has(String(conv.id));
              const preview = conv.lastMessage?.preview || "Chưa có tin nhắn";

              return (
                <button
                  key={convKey}
                  type="button"
                  onClick={() => handleSelectConversation(conv)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-all duration-200 ${
                    selected
                      ? "bg-[#00BFA5]/12 ring-1 ring-[#00BFA5]/30"
                      : "hover:bg-[#003B44]/[0.04]"
                  }`}
                >
                  <div className="relative shrink-0">
                    {conv.type === "dm" ? (
                      <>
                        <UserAvatar user={conv.peer} size="md" className="ring-2 ring-transparent" alt="" />
                        {isOnline ? (
                          <span
                            className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-light bg-green-500"
                            title="Đang online"
                            aria-hidden
                          />
                        ) : null}
                      </>
                    ) : (
                      <GroupAvatar group={conv.group} size="md" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#003B44]">
                      {conv.type === "dm" ? friendDisplayName(conv.peer) : conv.title}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[#003B44]/50">{preview}</p>
                  </div>

                  <UnreadBadge count={unread} />
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-primary/8 bg-light p-4 shadow-sm md:p-5">
        <div className="flex min-h-0 flex-1 flex-col">
          <ChatWindow
            friend={isGroupRoute ? null : selectedFriend}
            group={isGroupRoute ? selectedGroup : null}
            groupId={isGroupRoute ? groupId : undefined}
            currentUserId={currentUserId}
            onGroupChange={handleGroupChange}
            onLeaveGroup={handleLeaveGroup}
          />
        </div>
      </section>

      <CreateGroupModal
        open={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreated={handleGroupCreated}
      />
    </div>
  );
}

export default HomePage;
