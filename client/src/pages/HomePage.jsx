import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import ChatWindow from "../components/ChatWindow";
import UserAvatar from "../components/UserAvatar";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

function friendDisplayName(friend) {
  const name = `${friend?.firstName || ""} ${friend?.lastName || ""}`.trim();
  return name || friend?.email || "Người dùng";
}

function HomePage() {
  const navigate = useNavigate();
  const { userId } = useParams();
  const { user } = useAuth();
  const { onlineUsers, unreadCounts, setActiveChatFriendId, markFriendAsRead } = useSocket();
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

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

  useEffect(() => {
    const fetchUsers = async () => {
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

    fetchUsers();
  }, [currentUserId]);

  const safeFriends = useMemo(() => (Array.isArray(friends) ? friends : []), [friends]);
  const onlineUserSet = useMemo(
    () => (onlineUsers instanceof Set ? onlineUsers : new Set(Array.isArray(onlineUsers) ? onlineUsers.map(String) : [])),
    [onlineUsers]
  );

  const friendKey = (friend) => String(friend._id || friend.id || friend.email);

  const filteredFriends = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return safeFriends;

    return safeFriends.filter((friend) => {
      const fullName = `${friend.firstName || ""} ${friend.lastName || ""}`.trim().toLowerCase();
      const email = (friend.email || "").toLowerCase();
      return fullName.includes(keyword) || email.includes(keyword);
    });
  }, [safeFriends, searchQuery]);

  useEffect(() => {
    if (loadingFriends) return;

    if (!userId) {
      setSelectedFriend(null);
      return;
    }

    const targetId = String(userId);
    const matchedFriend = safeFriends.find((friend) => friendKey(friend) === targetId) || null;
    setSelectedFriend(matchedFriend);
  }, [userId, loadingFriends, safeFriends]);

  // Đồng bộ cuộc chat đang mở với SocketContext và xóa badge chưa đọc khi người dùng chọn bạn ở Sidebar
  useEffect(() => {
    setActiveChatFriendId(userId ? String(userId) : null);
    if (userId) markFriendAsRead(userId);
  }, [userId, setActiveChatFriendId, markFriendAsRead]);

  const handleSelectFriend = (id) => {
    markFriendAsRead(id);
    navigate(`/chat/${id}`);
  };

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

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-[#003B44]/15 bg-light/90 px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-[#00BFA5]/40">
          <Search size={16} className="shrink-0 text-[#00BFA5]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên hoặc email..."
            className="min-w-0 flex-1 bg-transparent text-sm text-[#003B44] outline-none placeholder:text-[#003B44]/40"
          />
        </div>

        <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
          {loadingFriends ? (
            <div className="flex items-center justify-center rounded-2xl border border-primary/5 bg-light px-3 py-6 text-primary/50">
              <Loader2 size={18} className="animate-spin" />
            </div>
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
                    <p className="truncate text-sm font-medium text-[#003B44]">
                      {friendDisplayName(friend)}
                    </p>
                    <p className="truncate text-xs text-[#003B44]/50">{friend.email}</p>
                  </div>
                  {unread > 0 ? (
                    <span
                      className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-none text-white shadow-sm"
                      aria-label={`${unread} tin nhắn chưa đọc`}
                    >
                      {unread > 99 ? "99+" : unread}
                    </span>
                  ) : null}
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-2xl border border-primary/8 bg-light p-4 shadow-sm md:p-5">
        <div className="flex min-h-0 flex-1 flex-col">
          <ChatWindow friend={selectedFriend} currentUserId={currentUserId} />
        </div>
      </section>
    </div>
  );
}

export default HomePage;
