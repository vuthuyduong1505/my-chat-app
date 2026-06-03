import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, MessageCircle, UserMinus, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api";
import { useSocket } from "../context/SocketContext";
import { useAuth } from "../context/AuthContext";
import UserAvatar from "../components/common/UserAvatar";

/**
 * GIẢI THÍCH: PHÂN LOẠI LỜI MỜI DỰA TRÊN VAI TRÒ SENDER VÀ RECEIVER
 * 
 * Lời mời kết bạn (FriendRequest) được lưu dưới cấu trúc chứa thông tin hai phía:
 * - sender (Người gửi): Người chủ động bấm nút "Kết bạn".
 * - receiver (Người nhận): Người nhận được thông báo kết bạn.
 * 
 * Để hiển thị phân loại Lời mời trên giao diện trang Bạn bè một cách chính xác:
 * 1. Lời mời đã nhận (Received Requests):
 *    - Điều kiện: ID của trường `receiver` (người nhận) trùng khớp với ID của người dùng hiện tại (`myId`).
 *    - Hiển thị: Thông tin của `sender` (người đã gửi lời mời cho ta) và hai nút hành động "Chấp nhận" / "Từ chối".
 * 
 * 2. Lời mời đã gửi (Sent Requests):
 *    - Điều kiện: ID của trường `sender` (người gửi) trùng khớp với ID của người dùng hiện tại (`myId`).
 *    - Hiển thị: Thông tin của `receiver` (người ta đang chờ đồng ý) và nút hành động "Hủy yêu cầu".
 */

function FriendsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  // Khai thác danh sách lời mời global dùng chung từ SocketContext để đồng bộ thời gian thực chéo trang
  const { friendRequests, setFriendRequests, loadFriendRequests } = useSocket();

  const [activeTab, setActiveTab] = useState(searchParams.get("tab") === "requests" ? "requests" : "friends");
  const [subTab, setSubTab] = useState("received"); // received | sent
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [processingId, setProcessingId] = useState("");

  const myId = useMemo(() => String(user?.id || user?._id || ""), [user]);

  // Phân loại lời mời đã nhận (Received) dựa trên vai trò của người nhận (receiver)
  const receivedRequests = useMemo(() => {
    return (friendRequests || []).filter(
      (r) => String(r.receiver?._id || r.receiver || "") === myId
    );
  }, [friendRequests, myId]);

  // Phân loại lời mời đã gửi (Sent) dựa trên vai trò của người gửi (sender)
  const sentRequests = useMemo(() => {
    return (friendRequests || []).filter(
      (r) => String(r.sender?._id || r.sender || "") === myId
    );
  }, [friendRequests, myId]);

  const pendingCount = useMemo(() => receivedRequests.length, [receivedRequests]);

  const loadFriends = async () => {
    setLoadingFriends(true);
    try {
      const response = await api.get("/users/friends");
      setFriends(response.data?.friends || []);
    } catch {
      setFriends([]);
      toast.error("Không thể tải danh sách bạn bè.");
    } finally {
      setLoadingFriends(false);
    }
  };

  useEffect(() => {
    loadFriends();
    if (loadFriendRequests) {
      loadFriendRequests(); // Nạp danh sách lời mời toàn cục
    }
  }, []);

  useEffect(() => {
    if (searchParams.get("tab") === "requests") {
      setActiveTab("requests");
    }
  }, [searchParams]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("pending-requests-changed", { detail: pendingCount }));
  }, [pendingCount]);

  // Nạp lại danh sách bạn bè khi có cập nhật xã hội từ trang khác
  useEffect(() => {
    const handleSocialUpdate = () => {
      loadFriends();
    };
    window.addEventListener("social-updated", handleSocialUpdate);
    return () => window.removeEventListener("social-updated", handleSocialUpdate);
  }, []);

  const handleRespond = async (requestId, action) => {
    setProcessingId(requestId);
    try {
      await api.post(`/users/friend-request/respond/${requestId}`, { action });
      
      // Xóa lời mời đã phản hồi khỏi danh sách global
      if (setFriendRequests) {
        setFriendRequests((prev) => prev.filter((request) => request._id !== requestId));
      }

      if (action === "accept") {
        toast.success("Đã chấp nhận lời mời kết bạn.");
        await loadFriends();
      } else {
        toast("Đã từ chối lời mời kết bạn.");
      }
      window.dispatchEvent(new Event("social-updated"));
    } catch (error) {
      toast.error(error?.response?.data?.message || "Không thể xử lý lời mời.");
    } finally {
      setProcessingId("");
    }
  };

  const handleCancelSentRequest = async (targetUserId) => {
    setProcessingId(targetUserId);
    try {
      await api.delete(`/users/friend-request/cancel/${targetUserId}`);
      
      // Cập nhật ngay trong global state mà không cần load lại API
      if (setFriendRequests) {
        setFriendRequests((prev) =>
          prev.filter((r) => String(r.receiver?._id || r.receiver) !== String(targetUserId))
        );
      }
      toast.success("Đã hủy yêu cầu kết bạn.");
      window.dispatchEvent(new Event("social-updated"));
    } catch (error) {
      toast.error(error?.response?.data?.message || "Không thể hủy yêu cầu.");
    } finally {
      setProcessingId("");
    }
  };

  const handleUnfriend = async (friendId) => {
    setProcessingId(friendId);
    try {
      await api.delete(`/users/friends/${friendId}`);
      setFriends((prev) => prev.filter((friend) => (friend._id || friend.id) !== friendId));
      toast.success("Đã hủy kết bạn.");
      window.dispatchEvent(new Event("social-updated"));
    } catch (error) {
      toast.error(error?.response?.data?.message || "Không thể hủy kết bạn.");
    } finally {
      setProcessingId("");
    }
  };



  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f0f4f6] p-4 md:p-6 overflow-y-auto">
      {/* Tabs Menu chính */}
      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-[#003B44]/10 bg-white p-1.5 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("friends")}
          className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            activeTab === "friends" ? "bg-[#003B44] text-[#00BFA5]" : "text-[#003B44]/75 hover:bg-[#003B44]/5"
          }`}
        >
          Danh sách bạn bè
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("requests")}
          className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            activeTab === "requests" ? "bg-[#003B44] text-[#00BFA5]" : "text-[#003B44]/75 hover:bg-[#003B44]/5"
          }`}
        >
          Lời mời kết bạn {pendingCount > 0 ? `(${pendingCount})` : ""}
        </button>
      </div>

      {/* Sub-tabs cho Lời mời kết bạn */}
      {activeTab === "requests" && (
        <div className="mb-4 flex gap-2 border-b border-[#003B44]/8 pb-2">
          <button
            type="button"
            onClick={() => setSubTab("received")}
            className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all duration-150 ${
              subTab === "received"
                ? "bg-[#003B44] text-[#00BFA5] shadow-sm"
                : "bg-white text-[#003B44] border border-[#003B44]/12 hover:bg-[#003B44]/5"
            }`}
          >
            Đã nhận {receivedRequests.length > 0 ? `(${receivedRequests.length})` : ""}
          </button>
          <button
            type="button"
            onClick={() => setSubTab("sent")}
            className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all duration-150 ${
              subTab === "sent"
                ? "bg-[#003B44] text-[#00BFA5] shadow-sm"
                : "bg-white text-[#003B44] border border-[#003B44]/12 hover:bg-[#003B44]/5"
            }`}
          >
            Đã gửi {sentRequests.length > 0 ? `(${sentRequests.length})` : ""}
          </button>
        </div>
      )}

      {/* Khối hiển thị chính */}
      <div className="flex-1 min-h-0">
        {activeTab === "friends" ? (
          loadingFriends ? (
            <div className="flex h-48 items-center justify-center text-primary/65">
              <Loader2 size={24} className="animate-spin text-[#00BFA5]" />
            </div>
          ) : friends.length === 0 ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#003B44]/15 bg-white/60 p-10 text-center">
              <Users size={36} className="text-[#00BFA5]" />
              <p className="text-sm font-semibold text-[#003B44]/75">Bạn chưa có người bạn nào trong danh sách.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {friends.map((friend) => {
                const friendId = friend?._id || friend?.id;
                const isProcessing = processingId === friendId;
                return (
                  <div key={friendId} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#003B44]/8 bg-white p-4 shadow-sm hover:shadow-md transition duration-200">
                    <div className="flex min-w-0 items-center gap-3">
                      <UserAvatar
                        user={friend}
                        size="md"
                        className="ring-2 ring-[#00BFA5]/20"
                        alt=""
                      />
                      <div className="min-w-0">
                        <p className="truncate font-bold text-[#003B44]">
                          {`${friend.firstName || ""} ${friend.lastName || ""}`.trim() || "Thành viên"}
                        </p>
                        <p className="truncate text-xs text-[#003B44]/55 mt-0.5">{friend.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate(`/chat/${friendId}`)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#003B44] px-3.5 py-2 text-xs font-semibold text-[#00BFA5] transition hover:opacity-90 active:scale-95"
                      >
                        <MessageCircle size={14} />
                        Nhắn tin
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUnfriend(friendId)}
                        disabled={isProcessing}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#003B44]/6 px-3.5 py-2 text-xs font-semibold text-[#003B44] transition hover:bg-[#003B44]/10 disabled:cursor-not-allowed"
                      >
                        {isProcessing ? <Loader2 size={14} className="animate-spin text-[#003B44]" /> : <UserMinus size={14} />}
                        Hủy bạn
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* TRANG LỜI MỜI KẾT BẠN */
          subTab === "received" ? (
            receivedRequests.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#003B44]/15 bg-white/60 p-10 text-center transition-all duration-200">
                <Users size={36} className="text-[#00BFA5]" />
                <p className="text-sm font-semibold text-[#003B44]/75">Chưa có lời mời nào đã nhận.</p>
              </div>
            ) : (
              <div className="space-y-3 transition-all duration-200">
                {receivedRequests.map((request) => {
                  const sender = request.sender || {};
                  const isProcessing = processingId === request._id;

                  return (
                    <div key={request._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#003B44]/8 bg-white p-4 shadow-sm hover:shadow-md transition duration-200">
                      <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar
                          user={sender}
                          size="md"
                          className="ring-2 ring-[#00BFA5]/20"
                          alt=""
                        />
                        <div className="min-w-0">
                          <p className="truncate font-bold text-[#003B44]">
                            {`${sender.firstName || ""} ${sender.lastName || ""}`.trim() || "Thành viên"}
                          </p>
                          <p className="truncate text-xs text-[#003B44]/55 mt-0.5">{sender.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleRespond(request._id, "accept")}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#00BFA5] px-3.5 py-2 text-xs font-semibold text-white transition hover:opacity-90 active:scale-95 disabled:cursor-not-allowed"
                        >
                          {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          Chấp nhận
                        </button>
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleRespond(request._id, "decline")}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#003B44]/6 px-3.5 py-2 text-xs font-semibold text-[#003B44] transition hover:bg-[#003B44]/10 disabled:cursor-not-allowed"
                        >
                          <X size={14} />
                          Từ chối
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* LỜI MỜI ĐÃ GỬI (Sent Requests) */
            sentRequests.length === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#003B44]/15 bg-white/60 p-10 text-center transition-all duration-200">
                <Users size={36} className="text-[#00BFA5]" />
                <p className="text-sm font-semibold text-[#003B44]/75">Chưa có lời mời nào đã gửi.</p>
              </div>
            ) : (
              <div className="space-y-3 transition-all duration-200">
                {sentRequests.map((request) => {
                  const receiver = request.receiver || {};
                  const receiverId = receiver._id || receiver.id || String(request.receiver);
                  const isProcessing = processingId === receiverId;

                  return (
                    <div key={request._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#003B44]/8 bg-white p-4 shadow-sm hover:shadow-md transition duration-200">
                      <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar
                          user={receiver}
                          size="md"
                          className="ring-2 ring-[#00BFA5]/20"
                          alt=""
                        />
                        <div className="min-w-0">
                          <p className="truncate font-bold text-[#003B44]">
                            {`${receiver.firstName || ""} ${receiver.lastName || ""}`.trim() || "Thành viên"}
                          </p>
                          <p className="truncate text-xs text-[#003B44]/55 mt-0.5">{receiver.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleCancelSentRequest(receiverId)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 border border-red-200 px-3.5 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-100 active:scale-95 disabled:opacity-50"
                        >
                          {isProcessing ? <Loader2 size={14} className="animate-spin text-red-500" /> : <X size={14} />}
                          Hủy yêu cầu
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )
        )}
      </div>
    </div>
  );
}

export default FriendsPage;
