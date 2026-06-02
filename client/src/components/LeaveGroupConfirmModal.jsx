import React from "react";
import { Loader2 } from "lucide-react";

/**
 * Modal xác nhận rời nhóm — thay window.confirm.
 */
function LeaveGroupConfirmModal({ open, onClose, onConfirm, submitting }) {
  if (!open) return null;

  return (
    <div
      className="modal-backdrop-in fixed inset-0 z-[70] flex items-center justify-center bg-[#003B44]/45 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-group-title"
      aria-describedby="leave-group-desc"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="modal-panel-in w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl shadow-[#003B44]/25 ring-1 ring-[#003B44]/8">
        <h2 id="leave-group-title" className="text-lg font-semibold text-[#003B44]">
          Xác nhận rời nhóm
        </h2>
        <p id="leave-group-desc" className="mt-3 text-sm leading-relaxed text-[#003B44]/60">
          Bạn có chắc chắn muốn rời khỏi nhóm này không? Hành động này không thể hoàn tác.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-2xl border border-[#003B44]/10 bg-[#f3f4f6] py-3 text-sm font-medium text-gray-500 transition hover:bg-gray-200 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[#e5e7eb] py-3 text-sm font-semibold text-gray-700 transition hover:bg-[#d1d5db] disabled:opacity-50"
          >
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}
            Rời nhóm
          </button>
        </div>
      </div>
    </div>
  );
}

export default LeaveGroupConfirmModal;
