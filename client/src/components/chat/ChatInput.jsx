import React, { useRef } from "react";
import { Loader2, Paperclip, Send, X, Plus, FileText } from "lucide-react";
import { replyAuthorName, replyContentLabel } from "./chatUtils";

export function AttachmentPreviewStrip({ attachments, onRemove, onAddMore, disabled }) {
  if (attachments.length === 0) return null;

  return (
    <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
      {attachments.map((item) => (
        <div key={item.id} className="group relative h-16 w-16 shrink-0">
          <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-[#003B44]/15 bg-[#003B44]/5 shadow-sm">
            {item.isImage && item.previewUrl ? (
              <img src={item.previewUrl} alt={item.fileName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 px-1">
                <FileText size={20} className="text-[#003B44]" />
                <span className="line-clamp-2 w-full text-center text-[8px] leading-tight text-[#003B44]/70">
                  {item.fileName}
                </span>
              </div>
            )}
            {item.status === "uploading" ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#003B44]/70">
                <Loader2 size={18} className="animate-spin text-[#00BFA5]" />
                <span className="mt-0.5 text-[10px] font-semibold tabular-nums text-light">{item.progress}%</span>
              </div>
            ) : null}
            {item.status === "error" ? (
              <div className="absolute inset-0 flex items-center justify-center bg-red-600/50 text-[10px] font-medium text-light">
                Lỗi
              </div>
            ) : null}
          </div>
          {item.status === "queued" || item.status === "error" ? (
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              disabled={disabled}
              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#003B44]/85 text-light opacity-0 shadow transition group-hover:opacity-100 hover:bg-[#003B44] disabled:opacity-40"
              aria-label="Xóa tệp đính kèm"
            >
              <X size={12} />
            </button>
          ) : null}
        </div>
      ))}
      <button
        type="button"
        onClick={onAddMore}
        disabled={disabled}
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-[#00BFA5]/45 bg-[#003B44]/5 text-[#00BFA5] transition hover:border-[#00BFA5] hover:bg-[#003B44]/10 disabled:opacity-40"
        aria-label="Thêm tệp đính kèm"
      >
        <Plus size={22} strokeWidth={2} />
      </button>
    </div>
  );
}

/**
 * Component ChatInput
 * Chứa khung nhập tin nhắn, đính kèm tệp tin, xử lý onPaste ảnh,
 * và hiển thị xem trước khi trả lời (Reply Preview).
 */
function ChatInput({
  connected,
  sending,
  attachments,
  replyTarget,
  draft,
  setDraft,
  canSend,
  send,
  handleChooseFile,
  removeQueuedAttachment,
  handlePaste,
  setReplyTarget,
  currentUserId,
  friend,
  memberMap
}) {
  const fileInputRef = useRef(null);

  const openFilePicker = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="relative z-10 shrink-0 border-t border-primary/10 bg-light/90 p-3 backdrop-blur-sm md:p-4">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleChooseFile}
      />

      <AttachmentPreviewStrip
        attachments={attachments}
        onRemove={removeQueuedAttachment}
        onAddMore={openFilePicker}
        disabled={sending || !connected}
      />

      {replyTarget ? (
        <div className="mb-2 flex items-start gap-2 rounded-xl border-l-4 border-[#00BFA5] bg-[#003B44]/[0.06] px-3 py-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-[#00BFA5]">
              Đang trả lời {replyAuthorName(replyTarget, currentUserId, { friend, memberMap })}
            </p>
            <p className="mt-0.5 truncate text-xs text-[#003B44]/55">
              {replyContentLabel(replyTarget)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReplyTarget(null)}
            className="shrink-0 rounded-lg p-1 text-[#003B44]/50 transition hover:bg-[#003B44]/10 hover:text-[#003B44]"
            aria-label="Hủy trả lời"
          >
            <X size={16} />
          </button>
        </div>
      ) : null}

      <div className="flex items-center gap-2 rounded-2xl border border-[#003B44]/15 bg-accent/50 p-2 pl-2 shadow-sm focus-within:shadow-md focus-within:ring-2 focus-within:ring-[#00BFA5]/40">
        <button
          type="button"
          onClick={openFilePicker}
          disabled={!connected || sending}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#003B44] text-[#00BFA5] transition hover:opacity-90 disabled:opacity-50"
          aria-label="Đính kèm file"
        >
          <Paperclip size={16} />
        </button>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={connected ? "Nhập tin nhắn" : "Đang kết nối máy chủ…"}
          disabled={!connected || sending}
          className="min-w-0 flex-1 rounded-xl border-0 bg-light px-4 py-2.5 text-sm text-primary placeholder:text-primary/35 outline-none ring-1 ring-[#003B44]/15 transition focus:ring-2 focus:ring-[#00BFA5] disabled:opacity-60"
        />
        <button
          type="button"
          onClick={send}
          disabled={!connected || sending || !canSend}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#003B44] text-[#00BFA5] shadow-md transition hover:opacity-90 disabled:opacity-40"
          aria-label="Gửi"
        >
          {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  );
}

export default ChatInput;
