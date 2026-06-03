import React, { useState, useEffect, useMemo } from "react";
import { UserPlus, Search, X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "../api";
import UserAvatar from "./common/UserAvatar";
import { getCallingName } from "../utils/displayName";

function memberDisplayLabel(member) {
  const name = `${member?.firstName || ""} ${member?.lastName || ""}`.trim();
  return getCallingName(member) || name || member?.email || "Thành viên";
}

/** Modal chọn bạn bè chưa có trong nhóm để thêm thành viên */
function AddGroupMembersModal({ open, onClose, groupId, existingMemberIds, onAdded }) {
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const existingSet = useMemo(() => new Set(existingMemberIds.map(String)), [existingMemberIds]);

  useEffect(() => {
    if (!open) return undefined;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get("/users/friends");
        setFriends(res.data?.friends || []);
      } catch {
        setFriends([]);
        toast.error("Không thể tải danh sách bạn bè.");
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => {
      setSearch("");
      setSelectedIds([]);
    };
  }, [open]);

  const availableFriends = useMemo(
    () => friends.filter((f) => !existingSet.has(String(f._id || f.id))),
    [friends, existingSet]
  );

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    if (!kw) return availableFriends;
    return availableFriends.filter((f) => {
      const full = `${f.firstName || ""} ${f.lastName || ""}`.trim().toLowerCase();
      return full.includes(kw) || (f.email || "").toLowerCase().includes(kw);
    });
  }, [availableFriends, search]);

  const toggle = (id) => {
    const key = String(id);
    setSelectedIds((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  };

  const handleSubmit = async () => {
    if (!selectedIds.length) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/groups/${groupId}/add-members`, { memberIds: selectedIds });
      toast.success("Đã thêm thành viên.");
      onAdded?.(res.data?.group);
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Không thể thêm thành viên.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#003B44]/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[min(85vh,520px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[#00BFA5]/25 bg-light shadow-xl">
        <div className="flex items-center justify-between border-b border-[#003B44]/10 px-4 py-3">
          <div className="flex items-center gap-2 text-[#003B44]">
            <UserPlus size={18} className="text-[#00BFA5]" />
            <h2 className="font-semibold">Thêm người vào nhóm</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-[#003B44]/60 hover:bg-[#003B44]/10" aria-label="Đóng">
            <X size={18} />
          </button>
        </div>
        <div className="px-4 pt-3">
          <div className="mb-2 flex items-center gap-2 rounded-xl border border-[#003B44]/15 bg-white px-3 py-2">
            <Search size={16} className="shrink-0 text-[#00BFA5]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm bạn bè..."
              className="min-w-0 flex-1 bg-transparent text-sm text-[#003B44] outline-none"
            />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="animate-spin text-[#00BFA5]" size={22} />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-[#003B44]/50">Không còn bạn bè để thêm.</p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((friend) => {
                const id = String(friend._id || friend.id);
                const checked = selectedIds.includes(id);
                return (
                  <li key={id}>
                    <label
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-2 py-2 transition ${checked ? "border-[#00BFA5]/40 bg-[#00BFA5]/10" : "border-transparent hover:bg-[#003B44]/5"
                        }`}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggle(id)} className="accent-[#00BFA5]" />
                      <UserAvatar user={friend} size="sm" alt="" />
                      <span className="truncate text-sm text-[#003B44]">{memberDisplayLabel(friend)}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex gap-2 border-t border-[#003B44]/10 px-4 py-3">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-[#003B44]/15 py-2.5 text-sm text-[#003B44]">
            Hủy
          </button>
          <button
            type="button"
            disabled={!selectedIds.length || submitting}
            onClick={handleSubmit}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#003B44] py-2.5 text-sm font-medium text-[#00BFA5] disabled:opacity-50"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
            Thêm
          </button>
        </div>
      </div>
    </div>
  );
}

export default AddGroupMembersModal;
