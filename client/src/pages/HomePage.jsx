import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Search, Users } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import ChatWindow from "../components/ChatWindow";
import CreateGroupModal from "../components/CreateGroupModal";
import UserAvatar from "../components/UserAvatar";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

function friendDisplayName(friend) {
  const name = `${friend?.firstName || ""} ${friend?.lastName || ""}`.trim();
  return name || friend?.email || "Người dùng";
}

/** Badge đỏ thống nhất cho tin chưa đọc (bạn bè & nhóm) */
function UnreadBadge({ count }) {
  if (!count || count <= 0) return null;
  return (
    <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-none text-white shadow-sm">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function HomePage({ mode = "chat" }) {
  const navigate = useNavigate();
  const { userId, groupId } = useParams();
  const isGroupMode = mode === "group";
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
  const [friends, setFriends] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateGroup, setShowCreateGroup] = useState(false);

  const currentUserId = useMemo(() => {
    if (user?.id) return user.id;
    if (user?._id) return user._id;
    const rawUser = localStorage.getItem("auth_user");
    if (!rawUser) return "";
    try {
      const parsedUser = JSON.parse(rawUser);
      return parsedUser?.id || parsedUser?._id || "";
    } catch {
      return "";
    }
  }, [user]);

  const currentUserName = useMemo(() => {
    if (!user) return "Người dùng";
    return `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Người dùng";
  }, [user]);

  const loadFriends = async () => {
    setLoadingFriends(true);
    try {
      const response = await api.get("/users/friends");
      setFriends(response.data?.friends || []);
    } catch {
      setFriends([]);
    } finally {
      setLoadingFriends(false);
    }
  };

  const loadGroups = async () => {
    setLoadingGroups(true);
    try {
      const response = await api.get("/groups");
      setGroups(response.data?.groups || []);
    } catch {
      setGroups([]);
    } finally {
      setLoadingGroups(false);
    }
  };

  useEffect(() => {
    loadFriends();
    loadGroups();
  }, [currentUserId]);

  useEffect(() => {
    const onGroupsUpdated = () => loadGroups();
    window.addEventListener("groups-updated", onGroupsUpdated);
    return () => window.removeEventListener("groups-updated", onGroupsUpdated);
  }, []);

  const safeFriends = useMemo(() => (Array.isArray(friends) ? friends : []), [friends]);
  const safeGroups = useMemo(() => (Array.isArray(groups) ? groups : []), [groups]);
  const onlineUserSet = useMemo(
    () => (onlineUsers instanceof Set ? onlineUsers : new Set(Array.isArray(onlineUsers) ? onlineUsers.map(String) : [])),
    [onlineUsers]
  );

  const friendKey = (friend) => String(friend._id || friend.id || friend.email);
  const groupKey = (group) => String(group._id || group.id);

  const filteredFriends = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return safeFriends;
    return safeFriends.filter((friend) => {
      const fullName = `${friend.firstName || ""} ${friend.lastName || ""}`.trim().toLowerCase();
      const email = (friend.email || "").toLowerCase();
      return fullName.includes(keyword) || email.includes(keyword);
    });
  }, [safeFriends, searchQuery]);

  const filteredGroups = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return safeGroups;
    return safeGroups.filter((g) => (g.name || "").toLowerCase().includes(keyword));
  }, [safeGroups, searchQuery]);

  const totalFriendUnread = useMemo(
    () => Object.values(unreadCounts).reduce((sum, n) => sum + (n || 0), 0),
    [unreadCounts]
  );
  const totalGroupUnread = useMemo(
    () => Object.values(groupUnreadCounts).reduce((sum, n) => sum + (n || 0), 0),
    [groupUnreadCounts]
  );

  useEffect(() => {
    if (loadingFriends || isGroupMode) return;
    if (!userId) {
      setSelectedFriend(null);
      return;
    }
    const matched = safeFriends.find((friend) => friendKey(friend) === String(userId)) || null;
    setSelectedFriend(matched);
  }, [userId, loadingFriends, safeFriends, isGroupMode]);

  useEffect(() => {
    if (loadingGroups || !isGroupMode) return;
    if (!groupId) {
      setSelectedGroup(null);
      return;
    }
    const matched = safeGroups.find((g) => groupKey(g) === String(groupId)) || null;
    setSelectedGroup(matched);
  }, [groupId, loadingGroups, safeGroups, isGroupMode]);

  useEffect(() => {
    if (isGroupMode) {
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
    isGroupMode,
    setActiveChatFriendId,
    setActiveChatGroupId,
    markFriendAsRead,
    markGroupAsRead
  ]);

  const handleSelectFriend = (id) => {
    markFriendAsRead(id);
    navigate(`/chat/${id}`);
  };

  const handleSelectGroup = (id) => {
    markGroupAsRead(id);
    navigate(`/group/${id}`);
  };

  const handleGroupCreated = (group) => {
    loadGroups();
    socket?.emit("refresh_group_rooms");
    if (group?._id) {
      navigate(`/group/${group._id}`);
    }
  };

  const sidebarLoading = isGroupMode ? loadingGroups : loadingFriends;

  return (
    <div className="flex h-full min-h-0 flex-1 gap-3 p-3 md:gap-4 md:p-4">
      <aside className="flex w-[min(100%,320px)] min-w-[240px] max-w-[32%] flex-col rounded-2xl border border-primary/8 bg-accent/80 p-4 shadow-sm backdrop-blur-sm">
        <div className="rounded-2xl border border-primary/10 bg-light p-4 shadow-sm">
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-secondary/15 text-sm font-bold text-primary ring-2 ring-secondary/30">
              {currentUserName[0]?.toUpperCase() || "U"}
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-primary">{currentUserName}</p>
              <p className="truncate text-xs text-primary/55">{user?.email || "—"}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex rounded-2xl border border-[#003B44]/15 bg-light/90 p-1 shadow-sm">
          <button
            type="button"
            onClick={() => navigate("/chat")}
            className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition ${
              !isGroupMode ? "bg-[#003B44] text-[#00BFA5]" : "text-[#003B44]/65 hover:bg-[#003B44]/5"
            }`}
          >
            Bạn bè
            {isGroupMode && totalFriendUnread > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {totalFriendUnread > 99 ? "99+" : totalFriendUnread}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => navigate("/group")}
            className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition ${
              isGroupMode ? "bg-[#003B44] text-[#00BFA5]" : "text-[#003B44]/65 hover:bg-[#003B44]/5"
            }`}
          >
            Nhóm chat
            {!isGroupMode && totalGroupUnread > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {totalGroupUnread > 99 ? "99+" : totalGroupUnread}
              </span>
            ) : null}
          </button>
        </div>

        {isGroupMode ? (
          <button
            type="button"
            onClick={() => setShowCreateGroup(true)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#003B44] py-2.5 text-sm font-medium text-[#00BFA5] shadow-sm transition hover:opacity-90"
          >
            <Plus size={16} />
            Tạo nhóm
          </button>
        ) : null}

        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-[#003B44]/15 bg-light/90 px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-[#00BFA5]/40">
          <Search size={16} className="shrink-0 text-[#00BFA5]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={isGroupMode ? "Tìm tên nhóm..." : "Tìm theo tên hoặc email..."}
            className="min-w-0 flex-1 bg-transparent text-sm text-[#003B44] outline-none placeholder:text-[#003B44]/40"
          />
        </div>

        <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
          {sidebarLoading ? (
            <div className="flex items-center justify-center rounded-2xl border border-primary/5 bg-light px-3 py-6 text-primary/50">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : isGroupMode ? (
            filteredGroups.length === 0 ? (
              <p className="rounded-2xl border border-primary/5 bg-light px-3 py-3 text-sm text-[#003B44]/55">
                {safeGroups.length === 0 ? "Chưa có nhóm nào. Nhấn Tạo nhóm để bắt đầu." : "Không tìm thấy nhóm"}
              </p>
            ) : (
              filteredGroups.map((group) => {
                const id = groupKey(group);
                const selected = selectedGroup && groupKey(selectedGroup) === id;
                const count = group.memberCount || group.members?.length || 0;
                const unread = groupUnreadCounts[id] || 0;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleSelectGroup(id)}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-2 py-2 text-left transition-all duration-200 ${
                      selected
                        ? "border-[#00BFA5]/40 bg-[#00BFA5]/15 shadow-sm ring-2 ring-[#00BFA5]/25"
                        : "border-transparent hover:border-[#00BFA5]/25 hover:bg-[#003B44]/5 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#003B44]/10 text-[#00BFA5]">
                      {group.avatar ? (
                        <img src={group.avatar} alt="" className="h-full w-full rounded-full object-cover" />
                      ) : (
                        <Users size={18} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#003B44]">{group.name}</p>
                      <p className="truncate text-xs text-[#003B44]/50">{count} thành viên</p>
                    </div>
                    <UnreadBadge count={unread} />
                  </button>
                );
              })
            )
          ) : safeFriends.length === 0 ? (
            <p className="rounded-2xl border border-primary/5 bg-light px-3 py-3 text-sm text-primary/50">Chưa có bạn bè nào.</p>
          ) : filteredFriends.length === 0 ? (
            <p className="rounded-2xl border border-primary/5 bg-light px-3 py-3 text-sm text-[#003B44]/55">
              Không tìm thấy bạn bè
            </p>
          ) : (
            filteredFriends.map((friend) => {
              const id = friendKey(friend);
              const selected = selectedFriend && friendKey(selectedFriend) === id;
              const isOnline = onlineUserSet.has(String(id));
              const unread = unreadCounts[id] || 0;

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelectFriend(id)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-2 py-2 text-left transition-all duration-200 ${
                    selected
                      ? "border-[#00BFA5]/40 bg-[#00BFA5]/15 shadow-sm ring-2 ring-[#00BFA5]/25"
                      : "border-transparent hover:border-[#00BFA5]/25 hover:bg-[#003B44]/5 hover:shadow-sm"
                  }`}
                >
                  <div className="relative shrink-0">
                    <UserAvatar user={friend} size="sm" className="ring-2 ring-transparent" alt="" />
                    {isOnline ? (
                      <span
                        className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-light"
                        title="Đang online"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[#003B44]">{friendDisplayName(friend)}</p>
                    <p className="truncate text-xs text-[#003B44]/50">{friend.email}</p>
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
            friend={isGroupMode ? null : selectedFriend}
            group={isGroupMode ? selectedGroup : null}
            currentUserId={currentUserId}
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
