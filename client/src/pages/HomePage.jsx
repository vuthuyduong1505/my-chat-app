import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Search, Send, User } from "lucide-react";
import api from "../api";
import { useAuth } from "../context/AuthContext";

function HomePage() {
  const { user } = useAuth();
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(true);

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
    if (!user) return "User";
    return `${user.firstName || ""} ${user.lastName || ""}`.trim() || "User";
  }, [user]);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoadingFriends(true);
      try {
        const response = await api.get("/users");
        const users = response.data?.users || [];
        const filteredUsers = users.filter((friend) => {
          const friendId = friend?._id || friend?.id || "";
          return String(friendId) !== String(currentUserId);
        });
        setFriends(filteredUsers);
      } catch {
        setFriends([]);
      } finally {
        setLoadingFriends(false);
      }
    };

    fetchUsers();
  }, [currentUserId]);

  const getAvatarLetter = (friend) => {
    const base = friend?.firstName || friend?.lastName || friend?.email || "?";
    return base[0]?.toUpperCase() || "?";
  };

  return (
    <div className="flex h-full min-h-0 flex-1 gap-3 p-3 md:gap-4 md:p-4">
      <aside className="flex w-[min(100%,320px)] min-w-[240px] max-w-[32%] flex-col rounded-2xl border border-primary/8 bg-accent/80 p-4 shadow-sm backdrop-blur-sm">
        <div className="rounded-2xl border border-primary/10 bg-light p-4 shadow-sm">
          {/* <p className="text-xs font-semibold uppercase tracking-wide text-primary/50">Đang nhập</p> */}
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

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-primary/10 bg-light/90 px-3 py-2.5 shadow-sm">
          <Search size={16} className="text-secondary" />
          <span className="text-sm font-medium text-primary/70">Bạn bè</span>
        </div>

        <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
          {loadingFriends ? (
            <p className="rounded-2xl border border-primary/5 bg-light px-3 py-3 text-sm text-primary/50">Đang tải danh sách...</p>
          ) : friends.length === 0 ? (
            <p className="rounded-2xl border border-primary/5 bg-light px-3 py-3 text-sm text-primary/50">Chưa có bạn bè nào.</p>
          ) : (
            friends.map((friend) => (
              <button
                key={String(friend._id || friend.id || friend.email)}
                type="button"
                className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-2 py-2 text-left transition-all duration-200 hover:border-secondary/25 hover:bg-secondary/10 hover:shadow-sm"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {getAvatarLetter(friend)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-primary">
                    {`${friend.firstName || ""} ${friend.lastName || ""}`.trim() || "Unknown"}
                  </p>
                  <p className="truncate text-xs text-primary/50">{friend.email}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col rounded-2xl border border-primary/8 bg-light p-4 shadow-sm md:p-5">
        <div className="relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-primary/8 bg-gradient-to-br from-accent via-light to-accent/90 p-6 shadow-inner">
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_top_right,rgba(0,191,165,0.12),transparent_50%)]" />
          <div className="relative flex h-full flex-col items-center justify-center text-center">
            <div className="mb-5 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl bg-primary text-light shadow-lg shadow-primary/25 ring-4 ring-secondary/20 transition-transform duration-300 hover:scale-105">
              <MessageCircle size={34} strokeWidth={1.75} />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-primary md:text-2xl">
              Chọn một người bạn để bắt đầu trò chuyện
            </h2>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-primary/10 bg-accent/50 p-2 pl-3 shadow-sm transition-shadow focus-within:shadow-md focus-within:ring-2 focus-within:ring-secondary/30">
          <input
            type="text"
            placeholder="Nhập tin nhắn..."
            className="min-w-0 flex-1 rounded-xl border-0 bg-light px-4 py-2.5 text-sm text-primary placeholder:text-primary/35 outline-none ring-1 ring-primary/10 transition focus:ring-2 focus:ring-secondary"
          />
          <button
            type="button"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-light shadow-md shadow-primary/20 transition hover:bg-primary/90 hover:shadow-lg"
          >
            <Send size={18} />
          </button>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
