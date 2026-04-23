import { useEffect, useState } from "react";
import { Loader2, MessageCircle, Search, UserPlus, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api";

function DiscoverPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingIds, setSendingIds] = useState([]);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await api.get("/users/discover", {
          params: search.trim() ? { search: search.trim() } : {}
        });
        setUsers(response.data?.users || []);
      } catch (error) {
        toast.error(error?.response?.data?.message || "Không thể tải danh sách khám phá.");
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [search]);

  const handleSendRequest = async (userId) => {
    setSendingIds((prev) => [...prev, userId]);
    try {
      await api.post(`/users/friend-request/send/${userId}`);
      setUsers((prev) =>
        prev.map((person) =>
          String(person._id || person.id) === String(userId)
            ? { ...person, connectionStatus: "request_sent" }
            : person
        )
      );
      toast.success("Đã gửi lời mời kết bạn.");
      window.dispatchEvent(new Event("social-updated"));
    } catch (error) {
      toast.error(error?.response?.data?.message || "Gửi lời mời thất bại.");
    } finally {
      setSendingIds((prev) => prev.filter((id) => id !== userId));
    }
  };

  const getAvatarText = (user) => {
    const base = user?.firstName || user?.lastName || user?.email || "?";
    return base.charAt(0).toUpperCase();
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-accent/40 p-4 md:p-6">
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/10 bg-light px-4 py-3 shadow-sm">
        <Search size={18} className="text-secondary" />
        <input
          type="text"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm kiếm theo tên hoặc email..."
          className="w-full bg-transparent text-sm text-primary outline-none placeholder:text-primary/45"
        />
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="animate-pulse rounded-2xl border border-primary/10 bg-light p-4 shadow-sm">
              <div className="mb-3 h-10 w-10 rounded-full bg-primary/10" />
              <div className="mb-2 h-3 w-2/3 rounded bg-primary/10" />
              <div className="h-3 w-1/2 rounded bg-primary/10" />
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-primary/15 bg-light/70 p-10 text-center">
          <Users size={34} className="text-secondary" />
          <p className="text-sm text-primary/70">Không tìm thấy người dùng phù hợp.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {users.map((person) => {
            const personId = person?._id || person?.id;
            const isSending = sendingIds.includes(personId);
            const status = person.connectionStatus || "none";

            const renderAction = () => {
              if (status === "friend") {
                return (
                  <button
                    type="button"
                    onClick={() => navigate("/")}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-light transition hover:bg-primary/90"
                  >
                    <MessageCircle size={16} />
                    Nhắn tin
                  </button>
                );
              }

              if (status === "request_sent") {
                return (
                  <button
                    type="button"
                    disabled
                    className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium text-primary/60"
                  >
                    Đã gửi yêu cầu
                  </button>
                );
              }

              if (status === "request_received") {
                return (
                  <button
                    type="button"
                    onClick={() => navigate("/friends?tab=requests")}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-light transition hover:bg-primary/90"
                  >
                    Phản hồi ngay
                  </button>
                );
              }

              return (
                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => handleSendRequest(personId)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-secondary px-3 py-2 text-sm font-medium text-primary transition hover:bg-secondary/90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSending ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />}
                  Kết bạn
                </button>
              );
            };

            return (
              <div key={personId} className="rounded-2xl border border-primary/10 bg-light p-4 shadow-sm transition hover:shadow-md">
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                    {getAvatarText(person)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-primary">
                      {`${person.firstName || ""} ${person.lastName || ""}`.trim() || "Không xác định"}
                    </p>
                    <p className="truncate text-xs text-primary/55">{person.email}</p>
                  </div>
                </div>

                <span className="mb-3 inline-flex items-center rounded-full bg-secondary/15 px-2.5 py-1 text-xs font-medium text-primary">
                  {person.mutualFriendsCount || 0} bạn chung
                </span>

                {renderAction()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default DiscoverPage;
