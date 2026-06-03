import React, { useState, useEffect } from "react";
import { X, Edit2, Loader2 } from "lucide-react";
import UserAvatar from "./common/UserAvatar";

/** Modal chỉnh sửa biệt danh */
function NicknameModal({ open, onClose, participants, nicknames, onSave }) {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setEditValue("");
    }
  }, [open]);

  if (!open) return null;

  const handleStartEdit = (user) => {
    const id = String(user._id || user.id);
    const existing = nicknames.find((n) => String(n.user) === id);
    setEditingId(id);
    setEditValue(existing?.nickname || "");
  };

  const handleSave = async (user) => {
    setSubmitting(true);
    try {
      await onSave(String(user._id || user.id), editValue);
      setEditingId(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="modal-backdrop-in absolute inset-0 bg-[#003B44]/40 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-panel-in relative flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl shadow-[#003B44]/25 ring-1 ring-[#003B44]/8">
        <div className="flex shrink-0 items-center justify-between border-b border-[#003B44]/10 bg-light px-5 py-4">
          <h2 className="text-lg font-semibold text-[#003B44]">Chỉnh sửa biệt danh</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[#003B44]/60 transition hover:bg-[#003B44]/8 hover:text-[#003B44]"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {participants.map((user) => {
            const id = String(user._id || user.id);
            const existing = nicknames.find((n) => String(n.user) === id);
            const currentNickname = existing?.nickname || "";
            const isEditing = editingId === id;

            return (
              <div key={id} className="flex items-center gap-3 rounded-xl p-3 hover:bg-[#003B44]/5">
                <UserAvatar user={user} size="md" />
                <div className="min-w-0 flex-1">
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        placeholder="Nhập biệt danh..."
                        className="w-full rounded-lg border border-[#003B44]/20 bg-white px-3 py-1.5 text-sm text-[#003B44] outline-none focus:border-[#00BFA5] focus:ring-1 focus:ring-[#00BFA5]"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSave(user);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                      />
                      <button
                        onClick={() => handleSave(user)}
                        disabled={submitting}
                        className="shrink-0 rounded-lg bg-[#00BFA5] px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-[#00A891] disabled:opacity-50"
                      >
                        {submitting ? <Loader2 size={16} className="animate-spin" /> : "Lưu"}
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="truncate text-sm font-semibold text-[#003B44]">
                        {currentNickname || `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email}
                      </p>
                      {currentNickname && (
                        <p className="truncate text-xs text-[#003B44]/60">
                          {`${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email}
                        </p>
                      )}
                    </>
                  )}
                </div>
                {!isEditing && (
                  <button
                    onClick={() => handleStartEdit(user)}
                    className="shrink-0 rounded-full p-2 text-[#003B44]/60 transition hover:bg-[#003B44]/8 hover:text-[#00BFA5]"
                    title="Đổi biệt danh"
                  >
                    <Edit2 size={16} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default NicknameModal;
