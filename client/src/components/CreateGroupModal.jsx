import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Users, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "../api";
import UserAvatar from "./UserAvatar";

function friendLabel(friend) {
  const name = `${friend?.firstName || ""} ${friend?.lastName || ""}`.trim();
  return name || friend?.email || "Bạn bè";
}

function CreateGroupModal({ open, onClose, onCreated }) {
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [name, setName] = useState("");
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return undefined;

    const load = async () => {
      setLoadingFriends(true);
      try {
        const res = await api.get("/users/friends");
        setFriends(res.data?.friends || []);
      } catch {
        setFriends([]);
        toast.error("Không thể tải danh sách bạn bè.");
      } finally {
        setLoadingFriends(false);
      }
    };

    load();
    return () => {
      setName("");
      setMemberSearch("");
      setSelectedIds([]);
    };
  }, [open]);

  /**
   * Lọc thành viên trong Modal tạo nhóm:
   * - Chuẩn hóa từ khóa (trim + lowercase) khi người dùng gõ ô tìm kiếm.
   * - So khớp với họ tên đầy đủ và email của từng bạn bè.
   * - Chỉ render danh sách đã lọc; ô tìm trống → hiện toàn bộ bạn bè.
   */
  const filteredFriends = useMemo(() => {
    const keyword = memberSearch.trim().toLowerCase();
    if (!keyword) return friends;
    return friends.filter((friend) => {
      const fullName = `${friend.firstName || ""} ${friend.lastName || ""}`.trim().toLowerCase();
      const email = (friend.email || "").toLowerCase();
      return fullName.includes(keyword) || email.includes(keyword);
    });
  }, [friends, memberSearch]);

  const toggleMember = (id) => {
    const key = String(id);
    setSelectedIds((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  };

  const canSubmit = useMemo(() => name.trim().length > 0 && !submitting, [name, submitting]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const res = await api.post("/groups", {
        name: name.trim(),
        memberIds: selectedIds
      });
      toast.success("Tạo nhóm thành công.");
      onCreated?.(res.data?.group);
      onClose();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Không thể tạo nhóm.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#003B44]/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[min(90vh,640px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[#00BFA5]/25 bg-light shadow-xl">
        <div className="flex items-center justify-between border-b border-[#003B44]/10 px-4 py-3">
          <div className="flex items-center gap-2 text-[#003B44]">
            <Users size={18} className="text-[#00BFA5]" />
            <h2 className="font-semibold">Tạo nhóm chat</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#003B44]/60 transition hover:bg-[#003B44]/10"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-3 overflow-y-auto px-4 py-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#003B44]/70">Tên nhóm</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Nhóm dự án, Lớp học..."
                maxLength={120}
                className="w-full rounded-xl border border-[#003B44]/15 bg-white px-3 py-2.5 text-sm text-[#003B44] shadow-sm outline-none transition focus:ring-2 focus:ring-[#00BFA5]/40"
              />
            </div>

            <div className="flex min-h-0 flex-col">
              <p className="mb-2 text-xs font-medium text-[#003B44]/70">Chọn thành viên (bạn bè)</p>

              <div className="mb-2 flex items-center gap-2 rounded-xl border border-[#003B44]/15 bg-white/90 px-3 py-2 shadow-sm focus-within:ring-2 focus-within:ring-[#00BFA5]/40">
                <Search size={16} className="shrink-0 text-[#00BFA5]" aria-hidden />
                <input
                  type="search"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Tìm theo tên hoặc email..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-[#003B44] outline-none placeholder:text-[#003B44]/40"
                />
              </div>

              {loadingFriends ? (
                <div className="flex h-56 items-center justify-center text-[#003B44]/50">
                  <Loader2 size={20} className="animate-spin" />
                </div>
              ) : friends.length === 0 ? (
                <p className="flex h-56 items-center justify-center rounded-xl border border-dashed border-[#003B44]/15 px-3 text-center text-sm text-[#003B44]/50">
                  Bạn chưa có bạn bè để thêm vào nhóm.
                </p>
              ) : filteredFriends.length === 0 ? (
                <p className="flex h-56 items-center justify-center rounded-xl border border-dashed border-[#003B44]/15 px-3 text-center text-sm text-[#003B44]/50">
                  Không tìm thấy bạn bè phù hợp
                </p>
              ) : (
                <ul className="h-56 space-y-1 overflow-y-auto rounded-xl border border-[#003B44]/10 bg-[#003B44]/[0.02] p-1 pr-0.5">
                  {filteredFriends.map((friend) => {
                    const id = String(friend._id || friend.id);
                    const checked = selectedIds.includes(id);
                    return (
                      <li key={id}>
                        <label
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border px-2 py-2 transition ${
                            checked
                              ? "border-[#00BFA5]/40 bg-[#00BFA5]/10"
                              : "border-transparent hover:bg-[#003B44]/5"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleMember(id)}
                            className="accent-[#00BFA5]"
                          />
                          <UserAvatar user={friend} size="sm" alt="" />
                          <span className="min-w-0 flex-1 truncate text-sm text-[#003B44]">{friendLabel(friend)}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="flex gap-2 border-t border-[#003B44]/10 px-4 py-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-[#003B44]/15 py-2.5 text-sm font-medium text-[#003B44] transition hover:bg-[#003B44]/5"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#003B44] py-2.5 text-sm font-medium text-[#00BFA5] transition hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              Tạo nhóm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateGroupModal;
