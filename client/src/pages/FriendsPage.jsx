import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, MessageCircle, UserMinus, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api";

function FriendsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") === "requests" ? "requests" : "friends");
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [loadingPending, setLoadingPending] = useState(true);
  const [processingId, setProcessingId] = useState("");

  const pendingCount = useMemo(() => pendingRequests.length, [pendingRequests]);

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

  const loadPendingRequests = async () => {
    setLoadingPending(true);
    try {
      const response = await api.get("/users/friend-requests/pending");
      setPendingRequests(response.data?.requests || []);
    } catch {
      setPendingRequests([]);
      toast.error("Không thể tải lời mời kết bạn.");
    } finally {
      setLoadingPending(false);
    }
  };

  useEffect(() => {
    loadFriends();
    loadPendingRequests();
  }, []);

  useEffect(() => {
    if (searchParams.get("tab") === "requests") {
      setActiveTab("requests");
    }
  }, [searchParams]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent("pending-requests-changed", { detail: pendingCount }));
  }, [pendingCount]);

  const handleRespond = async (requestId, action) => {
    setProcessingId(requestId);
    try {
      await api.post(`/users/friend-request/respond/${requestId}`, { action });
      setPendingRequests((prev) => prev.filter((request) => request._id !== requestId));
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

  const getAvatarText = (item) => {
    const base = item?.firstName || item?.lastName || item?.email || "?";
    return base.charAt(0).toUpperCase();
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-accent/40 p-4 md:p-6">
      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-primary/10 bg-light p-1.5 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("friends")}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
            activeTab === "friends" ? "bg-primary text-light" : "text-primary/75 hover:bg-primary/5"
          }`}
        >
          Danh sách bạn bè
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("requests")}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${
            activeTab === "requests" ? "bg-primary text-light" : "text-primary/75 hover:bg-primary/5"
          }`}
        >
          Lời mời kết bạn {pendingCount > 0 ? `(${pendingCount})` : ""}
        </button>
      </div>

      {activeTab === "friends" ? (
        loadingFriends ? (
          <div className="flex flex-1 items-center justify-center text-primary/65">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : friends.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-primary/15 bg-light/70 p-10 text-center">
            <Users size={34} className="text-secondary" />
            <p className="text-sm text-primary/70">Bạn chưa có bạn bè.</p>
          </div>
        ) : (
          <div className="space-y-3 overflow-y-auto pr-1">
            {friends.map((friend) => {
              const friendId = friend?._id || friend?.id;
              const isProcessing = processingId === friendId;
              return (
                <div key={friendId} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/10 bg-light p-4 shadow-sm">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                      {getAvatarText(friend)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-primary">
                        {`${friend.firstName || ""} ${friend.lastName || ""}`.trim() || "Không xác định"}
                      </p>
                      <p className="truncate text-xs text-primary/55">{friend.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate("/")}
                      className="inline-flex items-center gap-1 rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-primary transition hover:bg-secondary/90"
                    >
                      <MessageCircle size={14} />
                      Nhắn tin
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUnfriend(friendId)}
                      disabled={isProcessing}
                      className="inline-flex items-center gap-1 rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/15 disabled:cursor-not-allowed"
                    >
                      {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <UserMinus size={14} />}
                      Hủy kết bạn
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : loadingPending ? (
        <div className="flex flex-1 items-center justify-center text-primary/65">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : pendingRequests.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-primary/15 bg-light/70 p-10 text-center">
          <Users size={34} className="text-secondary" />
          <p className="text-sm text-primary/70">Không có lời mời nào đang chờ.</p>
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto pr-1">
          {pendingRequests.map((request) => {
            const sender = request.sender || {};
            const isProcessing = processingId === request._id;

            return (
              <div key={request._id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary/10 bg-light p-4 shadow-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                    {getAvatarText(sender)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-primary">
                      {`${sender.firstName || ""} ${sender.lastName || ""}`.trim() || "Không xác định"}
                    </p>
                    <p className="truncate text-xs text-primary/55">{sender.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleRespond(request._id, "accept")}
                    className="inline-flex items-center gap-1 rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-primary transition hover:bg-secondary/90 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Chấp nhận
                  </button>
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleRespond(request._id, "decline")}
                    className="inline-flex items-center gap-1 rounded-xl bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/15 disabled:cursor-not-allowed"
                  >
                    <X size={14} />
                    Từ chối
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default FriendsPage;
