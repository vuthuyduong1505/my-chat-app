import { useEffect, useState } from "react";
import { Loader2, MessageCircle, Search, UserPlus, Users, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../api";
import { useSocket } from "../context/SocketContext";

function DiscoverPage() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingIds, setSendingIds] = useState([]);

  // States phân trang & gợi ý thông minh
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isRecommendation, setIsRecommendation] = useState(false);
  const [isNewest, setIsNewest] = useState(false);

  // Reset về trang 1 khi từ khóa tìm kiếm thay đổi
  useEffect(() => {
    setPage(1);
  }, [search]);

  const fetchDiscoverUsers = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await api.get("/users/discover", {
        params: {
          ...(search.trim() ? { search: search.trim(), page } : {})
        }
      });
      setUsers(response.data?.users || []);
      setIsRecommendation(response.data?.isRecommendation || false);
      setIsNewest(response.data?.isNewest || false);
      setTotalPages(response.data?.totalPages || 1);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Không thể tải danh sách khám phá.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Debounced nạp danh sách khi gõ tìm kiếm hoặc chuyển trang
  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchDiscoverUsers(true);
    }, 300);

    return () => clearTimeout(timeout);
  }, [search, page]);

  // Tự động làm mới danh sách (chạy ngầm mượt mà) khi có thay đổi xã hội (hủy kết bạn, gửi/chấp nhận lời mời)
  useEffect(() => {
    const handleSocialUpdate = () => {
      fetchDiscoverUsers(false);
    };
    window.addEventListener("social-updated", handleSocialUpdate);
    return () => window.removeEventListener("social-updated", handleSocialUpdate);
  }, [search, page]);

  // Lắng nghe sự kiện người khác chấp nhận kết bạn thời gian thực
  useEffect(() => {
    if (!socket) return undefined;

    const onFriendRequestAccepted = (data) => {
      const peer = data.user;
      const peerName = `${peer.firstName || ""} ${peer.lastName || ""}`.trim() || peer.email;
      toast.success(`${peerName} đã chấp nhận lời mời kết bạn!`);
      
      // Cập nhật ngay connectionStatus thành 'friend' trong danh sách gợi ý mà không cần F5
      setUsers((prev) =>
        prev.map((person) =>
          String(person._id || person.id) === String(peer._id || peer.id)
            ? { ...person, connectionStatus: "friend" }
            : person
        )
      );

      // Đồng bộ hóa danh sách bạn bè toàn cục
      window.dispatchEvent(new Event("social-updated"));
    };

    socket.on("friend_request_accepted", onFriendRequestAccepted);
    return () => {
      socket.off("friend_request_accepted", onFriendRequestAccepted);
    };
  }, [socket]);

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

  const handleCancelRequest = async (userId) => {
    setSendingIds((prev) => [...prev, userId]);
    try {
      await api.delete(`/users/friend-request/cancel/${userId}`);
      setUsers((prev) =>
        prev.map((person) =>
          String(person._id || person.id) === String(userId)
            ? { ...person, connectionStatus: "none" }
            : person
        )
      );
      toast.success("Đã hủy yêu cầu kết bạn.");
      window.dispatchEvent(new Event("social-updated"));
    } catch (error) {
      toast.error(error?.response?.data?.message || "Không thể hủy yêu cầu.");
    } finally {
      setSendingIds((prev) => prev.filter((id) => id !== userId));
    }
  };

  const getAvatarText = (user) => {
    const base = user?.firstName || user?.lastName || user?.email || "?";
    return base.charAt(0).toUpperCase();
  };

  const getHeaderTitle = () => {
    if (search.trim()) return "Kết quả tìm kiếm";
    if (isRecommendation) return "Gợi ý kết bạn";
    if (isNewest) return "Thành viên mới nhất";
    return "Gợi ý kết bạn";
  };

  const getHeaderDesc = () => {
    if (search.trim()) return `Tìm thấy ${users.length} thành viên phù hợp`;
    if (isRecommendation) return "Những người bạn có thể biết dựa trên mạng lưới bạn bè chung";
    if (isNewest) return "Hệ thống chưa tìm thấy bạn chung, hãy kết nối với những thành viên mới gia nhập";
    return "";
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f0f4f6] p-4 md:p-6 overflow-y-auto">
      {/* Khung tìm kiếm ở trên cùng */}
      <div className="mb-6 flex flex-col gap-2">
        <label className="text-[11px] font-bold uppercase tracking-wider text-[#003B44]/65">
        </label>
        <div className="flex items-center gap-3 rounded-2xl border border-[#003B44]/12 bg-white px-4 py-3.5 shadow-sm transition focus-within:border-[#00BFA5]/50 focus-within:ring-2 focus-within:ring-[#00BFA5]/15">
          <Search size={18} className="text-[#00BFA5]" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm kiếm theo tên hoặc email..."
            className="w-full bg-transparent text-sm text-primary outline-none placeholder:text-primary/35"
          />
        </div>
      </div>

      {/* Header động theo ngữ cảnh */}
      {!loading && (
        <div className="mb-4">
          <h2 className="text-lg font-extrabold text-[#003B44] tracking-tight">{getHeaderTitle()}</h2>
          <p className="text-xs text-[#003B44]/55 mt-0.5">{getHeaderDesc()}</p>
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="animate-pulse rounded-2xl border border-[#003B44]/8 bg-white p-5 shadow-sm">
              <div className="mb-3 h-12 w-12 rounded-full bg-primary/10" />
              <div className="mb-2 h-4 w-2/3 rounded bg-primary/10" />
              <div className="mb-4 h-3.5 w-1/2 rounded bg-primary/10" />
              <div className="h-10 w-full rounded bg-primary/10" />
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        /* Empty State đẹp mắt */
        <div className="flex flex-1 flex-col items-center justify-center p-12 text-center rounded-2xl bg-white/60 border border-dashed border-[#003B44]/15">
          <div className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[#003B44]/5 text-[#003B44]/40">
            <Search size={44} strokeWidth={1.5} className="text-[#00BFA5]" />
            <div className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md">
              <X size={14} className="text-red-500" strokeWidth={2.5} />
            </div>
          </div>
          <h3 className="text-base font-bold text-[#003B44]">Không tìm thấy kết quả</h3>
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-[#003B44]/50">
            Chúng tôi không tìm thấy thành viên nào phù hợp với từ khóa <span className="font-semibold text-[#003B44]">"{search}"</span>. Vui lòng kiểm tra lại chính tả hoặc thử bằng từ khóa khác.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {users.map((person) => {
              const personId = person?._id || person?.id;
              const isSending = sendingIds.includes(personId);
              const status = person.connectionStatus || "none";

              const renderAction = () => {
                if (status === "friend") {
                  return (
                    <button
                      type="button"
                      onClick={() => navigate(`/chat/${personId}`)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#003B44] px-3 py-2.5 text-sm font-semibold text-[#00BFA5] transition hover:bg-[#002a30] active:scale-98 shadow-sm"
                    >
                      <MessageCircle size={15} />
                      Nhắn tin
                    </button>
                  );
                }

                if (status === "request_sent") {
                  const isProcessing = sendingIds.includes(personId);
                  return (
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleCancelRequest(personId)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 border border-red-200 px-3 py-2.5 text-sm font-semibold text-red-500 transition hover:bg-red-100 active:scale-98 disabled:opacity-50"
                    >
                      {isProcessing ? <Loader2 size={15} className="animate-spin text-red-500" /> : <X size={15} />}
                      Hủy yêu cầu
                    </button>
                  );
                }

                if (status === "request_received") {
                  return (
                    <button
                      type="button"
                      onClick={() => navigate("/friends?tab=requests")}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00BFA5] px-3 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 active:scale-98 shadow-sm"
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
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-white border border-[#00BFA5] px-3 py-2.5 text-sm font-semibold text-[#00BFA5] transition hover:bg-[#00BFA5]/5 active:scale-98"
                  >
                    {isSending ? <Loader2 size={15} className="animate-spin text-[#00BFA5]" /> : <UserPlus size={15} />}
                    Kết bạn
                  </button>
                );
              };

              return (
                <div
                  key={personId}
                  className="group flex flex-col justify-between rounded-2xl border border-[#003B44]/8 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5"
                >
                  <div>
                    <div className="mb-4 flex items-center gap-3.5">
                      {person.avatar ? (
                        <img
                          src={person.avatar}
                          alt=""
                          className="h-12 w-12 rounded-full object-cover ring-2 ring-[#00BFA5]/20"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#003B44]/8 font-bold text-[#003B44] ring-2 ring-[#003B44]/5">
                          {getAvatarText(person)}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-[#003B44] leading-snug group-hover:text-[#00BFA5] transition-colors">
                          {`${person.firstName || ""} ${person.lastName || ""}`.trim() || "Thành viên"}
                        </p>
                        <p className="truncate text-xs text-[#003B44]/50 mt-0.5">{person.email}</p>
                      </div>
                    </div>

                    {/* Hiển thị số lượng bạn chung nổi bật */}
                    <div className="mb-4 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#003B44]/6 px-3 py-1 text-[11px] font-bold text-[#003B44]">
                        <Users size={12} className="text-[#00BFA5]" />
                        {person.mutualFriendsCount || 0} bạn chung
                      </span>
                      {isNewest && (
                        <span className="rounded-md bg-[#00BFA5]/12 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#00BFA5]">
                          Mới
                        </span>
                      )}
                    </div>
                  </div>

                  {renderAction()}
                </div>
              );
            })}
          </div>

          {/* Phân trang khi tìm kiếm */}
          {search.trim() && totalPages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3 pb-6">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page === 1}
                className="flex h-9 items-center justify-center rounded-xl border border-[#003B44]/15 bg-white px-4 text-xs font-semibold text-[#003B44] transition hover:bg-[#003B44]/5 disabled:opacity-40 disabled:hover:bg-white"
              >
                Trước
              </button>
              <span className="text-xs font-bold text-[#003B44]/75">
                Trang {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page === totalPages}
                className="flex h-9 items-center justify-center rounded-xl border border-[#003B44]/15 bg-white px-4 text-xs font-semibold text-[#003B44] transition hover:bg-[#003B44]/5 disabled:opacity-40 disabled:hover:bg-white"
              >
                Sau
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default DiscoverPage;
