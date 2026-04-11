import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, MessageCircle, Search, Send, User } from "lucide-react";
import api from "../api";
import { useAuth } from "../context/AuthContext";

function HomePage() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
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
      } catch (error) {
        setFriends([]);
      } finally {
        setLoadingFriends(false);
      }
    };

    fetchUsers();
  }, [currentUserId]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const getAvatarLetter = (friend) => {
    const base = friend?.firstName || friend?.lastName || friend?.email || "?";
    return base[0]?.toUpperCase() || "?";
  };

  return (
    <main className="min-h-screen bg-slate-100 py-4 pl-2 pr-3 md:py-6 md:pl-3 md:pr-6">
      <div className="mx-auto flex h-[calc(100vh-2rem)] w-full max-w-7xl gap-4">
        <aside className="flex w-1/4 min-w-[280px] flex-col rounded-2xl bg-white p-4 shadow-sm">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Logged in as</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <User size={18} />
              </div>
              <div>
                <p className="font-semibold text-slate-800">{currentUserName}</p>
                <p className="text-xs text-slate-500">{user?.email || "No email"}</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
            <Search size={16} className="text-slate-400" />
            <span className="text-sm text-slate-400">Bạn bè</span>
          </div>

          <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
            {loadingFriends ? (
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">Đang tải danh sách...</p>
            ) : friends.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">Chưa có bạn bè nào.</p>
            ) : (
              friends.map((friend) => (
                <button
                  key={friend.email}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-slate-100"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-700">
                    {getAvatarLetter(friend)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {`${friend.firstName || ""} ${friend.lastName || ""}`.trim() || "Unknown"}
                    </p>
                    <p className="truncate text-xs text-slate-500">{friend.email}</p>
                  </div>
                </button>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            <LogOut size={16} />
            Logout
          </button>
        </aside>

        <section className="flex w-3/4 flex-col rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                <MessageCircle size={30} />
              </div>
              <h2 className="text-2xl font-semibold text-slate-800">Chọn một người bạn để bắt đầu trò chuyện</h2>
              <p className="mt-3 max-w-lg text-sm text-slate-500">
                Danh sách bạn bè nằm ở cột bên trái. Hãy chọn một người để mở cuộc hội thoại.
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
            <input
              type="text"
              placeholder="Nhập tin nhắn..."
              className="w-full rounded-xl bg-slate-100 px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700"
            >
              <Send size={16} />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

export default HomePage;
