import React, { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

/**
 * Modal đổi tên nhóm — thay thế window.prompt.
 */
function RenameGroupModal({ open, initialName, onClose, onConfirm, submitting }) {
  const [name, setName] = useState(initialName || "");

  useEffect(() => {
    if (open) setName(initialName || "");
  }, [open, initialName]);

  if (!open) return null;

  const trimmed = name.trim();
  const canConfirm = trimmed.length > 0 && trimmed !== (initialName || "").trim() && !submitting;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canConfirm) return;
    onConfirm(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-[#003B44]/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rename-group-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl shadow-[#003B44]/20 ring-1 ring-[#003B44]/8">
        <div className="border-b border-[#003B44]/8 px-6 py-5">
          <h2 id="rename-group-title" className="text-lg font-semibold text-[#003B44]">
            Đổi tên nhóm
          </h2>
          <p className="mt-1 text-sm text-[#003B44]/50">Tên mới sẽ hiển thị với mọi thành viên.</p>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5">
          <label className="mb-2 block text-xs font-medium text-[#003B44]/70" htmlFor="rename-group-input">
            Tên nhóm
          </label>
          <input
            id="rename-group-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            autoFocus
            placeholder="Nhập tên nhóm..."
            className="w-full rounded-2xl border border-[#003B44]/12 bg-[#f8fafb] px-4 py-3 text-sm text-[#003B44] shadow-inner outline-none transition focus:border-[#00BFA5]/50 focus:bg-white focus:ring-2 focus:ring-[#00BFA5]/30"
          />
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-2xl border border-[#003B44]/12 py-3 text-sm font-medium text-[#003B44]/70 transition hover:bg-[#003B44]/5 disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!canConfirm}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#003B44] py-3 text-sm font-medium text-[#00BFA5] transition hover:opacity-90 disabled:opacity-45"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
              Xác nhận
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default RenameGroupModal;
