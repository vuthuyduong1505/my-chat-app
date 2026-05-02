import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import api from "../api";
import ChatWindow from "../components/ChatWindow";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

function HomePage() {
  const { user } = useAuth();
  const { onlineUsers } = useSocket();
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [selectedFriend, setSelectedFriend] = useState(null);

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

  const getAvatarLetter = (friend) => {
    const base = friend?.firstName || friend?.lastName || friend?.email || "?";
    return base[0]?.toUpperCase() || "?";
  };

  const friendKey = (friend) => String(friend._id || friend.id || friend.email);

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

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-primary/10 bg-light/90 px-3 py-2.5 shadow-sm">
          <Search size={16} className="text-secondary" />
          <span className="text-sm font-medium text-primary/70">Bạn bè</span>
        </div>

        <div className="mt-3 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
          {loadingFriends ? (
            <div className="flex items-center justify-center rounded-2xl border border-primary/5 bg-light px-3 py-6 text-primary/50">
              <Loader2 size={18} className="animate-spin" />
            </div>
          ) : friends.length === 0 ? (
            <p className="rounded-2xl border border-primary/5 bg-light px-3 py-3 text-sm text-primary/50">Chưa có bạn bè nào.</p>
          ) : (
            friends.map((friend) => {
              const id = friendKey(friend);
              const selected = selectedFriend && friendKey(selectedFriend) === id;
              const isOnline = onlineUsers.has(String(id));
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedFriend(friend)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-2 py-2 text-left transition-all duration-200 ${
                    selected
                      ? "border-secondary/40 bg-secondary/15 shadow-sm ring-2 ring-secondary/25"
                      : "border-transparent hover:border-secondary/25 hover:bg-secondary/10 hover:shadow-sm"
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary ring-2 ring-transparent">
                      {getAvatarLetter(friend)}
                    </div>
                    {isOnline ? (
                      <span
                        className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-light"
                        title="Đang online"
                        aria-hidden
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-primary">
                      {`${friend.firstName || ""} ${friend.lastName || ""}`.trim() || "Không xác định"}
                    </p>
                    <p className="truncate text-xs text-primary/50">{friend.email}</p>
                  </div>
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
