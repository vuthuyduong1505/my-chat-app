import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, Loader2, MessageCircle, Paperclip, Send, X } from "lucide-react";
import toast from "react-hot-toast";
import api from "../api";
import UserAvatar from "./UserAvatar";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 (CN) -> 6 (T7)
  const distanceToMonday = day === 0 ? 6 : day - 1;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - distanceToMonday);
  return d;
}

function isSameDate(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatVietnameseChatTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";

    const now = new Date();
    const hhmm = d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

    if (isSameDate(d, now)) return hhmm;

    const startOfCurrentWeek = getStartOfWeek(now);
    const startOfMessageWeek = getStartOfWeek(d);
    if (startOfCurrentWeek.getTime() === startOfMessageWeek.getTime()) {
      const weekdays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
      return `${hhmm} ${weekdays[d.getDay()]}`;
    }

    if (d.getFullYear() === now.getFullYear()) {
      return `${hhmm}, ${d.getDate()} thg ${d.getMonth() + 1}`;
    }

    return `${hhmm}, ${d.getDate()} thg ${d.getMonth() + 1}, ${d.getFullYear()}`;
  } catch {
    return "";
  }
}

function formatHoverTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

/** Tải file qua Blob; dùng URL Cloudinary gốc và fileName UTF-8 từ backend. */
async function downloadFile(url, fileName) {
  const safeName = (fileName || "tep-dinh-kem").trim();
  const fileUrl = String(url || "").trim();

  if (!fileUrl) {
    toast.error("Không có đường dẫn file.");
    return;
  }

  try {
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error("Tải file thất bại");

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = safeName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch {
    try {
      const link = document.createElement("a");
      link.href = fileUrl;
      link.download = safeName;
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      toast.error("Không thể tải file. Vui lòng thử lại.");
    }
  }
}

function FileAttachmentBubble({ url, fileName, variant = "received" }) {
  const isMine = variant === "mine";
  const displayName = fileName || "Tệp đính kèm";

  return (
    <button
      type="button"
      onClick={() => downloadFile(url, displayName)}
      className={`flex w-full min-w-[168px] max-w-[260px] cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 ${
        isMine
          ? "bg-[#002a30] hover:bg-[#004a54] active:bg-[#003B44]"
          : "bg-[#e4eaec] hover:bg-[#d5e0e4] active:bg-[#c8d6db]"
      }`}
      aria-label={`Tải xuống ${displayName}`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
          isMine ? "bg-[#00BFA5]/20" : "bg-[#003B44]/12"
        }`}
      >
        <FileText size={18} className={isMine ? "text-[#00BFA5]" : "text-[#003B44]"} />
      </div>
      <p
        className={`min-w-0 flex-1 truncate text-sm font-medium leading-tight ${
          isMine ? "text-light/95" : "text-[#003B44]"
        }`}
        title={displayName}
      >
        {displayName}
      </p>
    </button>
  );
}

function MessageRow({ message, isMine, hoverTime, onOpenImage, user, friend }) {
  const hasImage = message.fileType === "image" && message.fileUrl;
  const hasFile = message.fileType === "file" && message.fileUrl;
  const hasText = Boolean(message.content?.trim());
  const pendingClass = message.pending ? "opacity-90" : "";

  if (!hasImage && !hasFile && !hasText) return null;

  const bubbleClass = isMine
    ? `min-w-0 max-w-full rounded-3xl rounded-br-2xl bg-primary px-3.5 py-2.5 text-sm text-light shadow-sm ${pendingClass}`
    : `min-w-0 max-w-full rounded-3xl rounded-bl-2xl bg-gray-100 px-3.5 py-2.5 text-sm text-primary shadow-sm ${pendingClass}`;

  const avatar = isMine ? (
    <UserAvatar user={user} size="xs" className="shrink-0 ring-1 ring-primary/15" alt="" />
  ) : (
    <UserAvatar user={friend} size="xs" className="shrink-0 ring-1 ring-primary/15" alt="" />
  );

  const hoverTimeAside = hoverTime ? (
    <span className="shrink-0 self-end pb-1 text-[10px] leading-none tabular-nums text-primary/35 opacity-0 transition-opacity duration-150 group-hover/message-row:opacity-100">
      {hoverTime}
    </span>
  ) : null;

  const contentColumn = (
    <div className={`flex min-w-0 max-w-[80%] flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}>
      {hasImage ? (
        <button
          type="button"
          onClick={() => onOpenImage(message.fileUrl)}
          className={`block overflow-hidden rounded-2xl border border-primary/5 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00BFA5]/50 ${pendingClass}`}
          aria-label="Mở ảnh lớn"
        >
          <img
            src={message.fileUrl}
            alt={message.fileName || "Ảnh đính kèm"}
            className="max-h-[300px] max-w-full object-contain"
          />
        </button>
      ) : null}
      {hasFile ? (
        <FileAttachmentBubble
          url={message.fileUrl}
          fileName={message.fileName}
          variant={isMine ? "mine" : "received"}
        />
      ) : null}
      {hasText ? (
        <div className={bubbleClass}>
          <p className="break-all whitespace-pre-wrap [overflow-wrap:anywhere] leading-snug">{message.content}</p>
        </div>
      ) : null}
    </div>
  );

  if (isMine) {
    return (
      <div className="ml-auto flex w-full min-w-0 max-w-[min(92%,480px)] items-end justify-end gap-2">
        {hoverTimeAside}
        {contentColumn}
        {avatar}
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 max-w-[min(92%,480px)] items-end justify-start gap-2">
      {avatar}
      {contentColumn}
      {hoverTimeAside}
    </div>
  );
}

function ChatWindow({ friend, currentUserId }) {
  const { user } = useAuth();
  const { socket, connected, onlineUsers } = useSocket();
  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [lightboxUrl, setLightboxUrl] = useState("");
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  const friendId = useMemo(() => {
    if (!friend) return null;
    return String(friend._id || friend.id || "");
  }, [friend]);

  const friendName = useMemo(() => {
    if (!friend) return "";
    const n = `${friend?.firstName || ""} ${friend?.lastName || ""}`.trim();
    return n || friend?.email || "Bạn bè";
  }, [friend]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!friendId || loadingHistory) return undefined;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "auto" });
      });
    });
    return () => cancelAnimationFrame(id);
  }, [friendId, loadingHistory]);

  useEffect(() => {
    if (!friendId) {
      setMessages([]);
      return undefined;
    }

    let cancelled = false;
    const load = async () => {
      setLoadingHistory(true);
      try {
        const res = await api.get(`/chat/${friendId}`);
        if (!cancelled) setMessages(res.data?.messages || []);
      } catch {
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [friendId]);

  useEffect(() => {
    if (!socket || !friendId) return undefined;

    const join = () => {
      socket.emit("join_chat", { friendId });
    };

    join();
    socket.on("connect", join);

    return () => {
      socket.off("connect", join);
      socket.emit("leave_chat", { friendId });
    };
  }, [socket, friendId]);

  useEffect(() => {
    if (!socket || !friendId || !currentUserId) return undefined;

    const onNew = (msg) => {
      const me = String(currentUserId);
      const fid = String(friendId);
      const inConv =
        (msg.sender === me && msg.receiver === fid) || (msg.sender === fid && msg.receiver === me);
      if (!inConv) return;

      setMessages((prev) => {
        if (msg.tempId) {
          const idx = prev.findIndex((m) => m.tempId === msg.tempId);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = { ...msg, pending: false };
            return next;
          }
        }
        if (prev.some((m) => String(m._id) === String(msg._id))) return prev;
        return [...prev, msg];
      });
    };

    socket.on("new_message", onNew);
    return () => {
      socket.off("new_message", onNew);
    };
  }, [socket, friendId, currentUserId]);

  const send = () => {
    const text = draft.trim();
    if ((!text && !attachment?.fileUrl) || uploading || !socket?.connected || !friendId || !currentUserId) return;

    const tempId = `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const optimistic = {
      _id: tempId,
      tempId,
      sender: String(currentUserId),
      receiver: friendId,
      content: text,
      fileUrl: attachment?.fileUrl || "",
      fileType: attachment?.fileType || "",
      fileName: attachment?.fileName || "",
      createdAt: new Date().toISOString(),
      pending: true
    };

    setMessages((prev) => [...prev, optimistic]);
    socket.emit("send_message", {
      receiverId: friendId,
      content: text,
      fileUrl: attachment?.fileUrl || "",
      fileType: attachment?.fileType || "",
      fileName: attachment?.fileName || "",
      tempId
    });
    setDraft("");
    setAttachment(null);
    setUploadProgress(0);
  };

  const uploadAttachment = async (file) => {
    if (!file || !friendId) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/chat/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (event) => {
          if (!event.total) return;
          setUploadProgress(Math.round((event.loaded * 100) / event.total));
        }
      });
      setAttachment({
        fileUrl: res.data?.fileUrl || "",
        fileType: res.data?.fileType || "file",
        fileName: res.data?.fileName || "attachment"
      });
    } catch {
      setAttachment(null);
      setUploadProgress(0);
      toast.error("Tải tệp lên thất bại. Vui lòng thử lại.");
    } finally {
      setUploading(false);
    }
  };

  const handleChooseFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await uploadAttachment(file);
  };

  const handlePaste = async (event) => {
    // Trình duyệt sẽ đặt ảnh chụp/ảnh copy vào clipboard dưới dạng File trong clipboardData.items.
    // Khi phát hiện item là ảnh, ta chặn thao tác paste text mặc định để tránh ký tự rác,
    // sau đó upload ảnh ngay để tạo preview trước khi người dùng bấm gửi.
    const clipboardItems = Array.from(event.clipboardData?.items || []);
    const imageItem = clipboardItems.find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;

    const pastedImageFile = imageItem.getAsFile();
    if (!pastedImageFile) return;

    event.preventDefault();
    await uploadAttachment(pastedImageFile);
  };

  const onlineUserSet = useMemo(
    () => (onlineUsers instanceof Set ? onlineUsers : new Set(Array.isArray(onlineUsers) ? onlineUsers.map(String) : [])),
    [onlineUsers]
  );
  const friendIsOnline = Boolean(friendId && onlineUserSet.has(String(friendId)));

  useEffect(() => {
    setDraft("");
    setAttachment(null);
    setUploadProgress(0);
  }, [friendId]);

  if (!friend || !friendId) {
    return (
      <div className="relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-primary/8 bg-gradient-to-br from-accent via-light to-accent/90 p-6 shadow-inner">
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_top_right,rgba(0,191,165,0.12),transparent_50%)]" />
        <div className="relative flex h-full flex-col items-center justify-center text-center">
          <div className="mb-5 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl bg-primary text-light shadow-lg shadow-primary/25 ring-4 ring-secondary/20 transition-transform duration-300 hover:scale-105">
            <MessageCircle size={34} strokeWidth={1.75} />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-primary md:text-2xl">
            Chọn một người bạn để bắt đầu trò chuyện
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-primary/8 bg-gradient-to-br from-accent via-light to-accent/90 shadow-inner">
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_top_right,rgba(0,191,165,0.08),transparent_55%)]" />

      <header className="relative z-10 flex shrink-0 items-center gap-3 border-b border-primary/10 bg-light/95 px-4 py-3 backdrop-blur-sm md:px-5">
        <UserAvatar user={friend} size="md" className="ring-2 ring-secondary/25" alt="" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-primary">{friendName}</p>
          <p className="truncate text-xs text-primary/50">
            {!connected
              ? "Đang kết nối máy chủ…"
              : friendIsOnline
                ? "Đang hoạt động"
                : "Offline"}
          </p>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 md:px-5">
          {loadingHistory ? (
            <div className="flex justify-center py-10 text-primary/45">
              <Loader2 className="animate-spin" size={22} />
            </div>
          ) : messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-primary/45">Chưa có tin nhắn nào</p>
          ) : (
            messages.map((m, index) => {
              const isMine = String(m.sender) === String(currentUserId);
              const previousMessage = index > 0 ? messages[index - 1] : null;
              const currentDate = new Date(m.createdAt);
              const previousDate = previousMessage ? new Date(previousMessage.createdAt) : null;

              const hasValidCurrentDate = !Number.isNaN(currentDate.getTime());
              const hasValidPreviousDate = previousDate && !Number.isNaN(previousDate.getTime());
              const isFirstMessage = index === 0;
              const isNewDay =
                hasValidCurrentDate && hasValidPreviousDate ? !isSameDate(currentDate, previousDate) : false;
              const isOverThirtyMinutes =
                hasValidCurrentDate && hasValidPreviousDate
                  ? currentDate.getTime() - previousDate.getTime() > 30 * 60 * 1000
                  : false;
              const shouldShowTimestampSeparator = isFirstMessage || isNewDay || isOverThirtyMinutes;
              const separatorText = formatVietnameseChatTime(m.createdAt);
              const hoverTime = formatHoverTime(m.createdAt);

              return (
                <div key={String(m._id)}>
                  {shouldShowTimestampSeparator && separatorText ? (
                    <div className="my-4 text-center text-[11px] text-primary/40">{separatorText}</div>
                  ) : null}

                  <div className={`group/message-row flex w-full ${isMine ? "justify-end" : "justify-start"}`}>
                    <MessageRow
                      message={m}
                      isMine={isMine}
                      hoverTime={hoverTime}
                      onOpenImage={setLightboxUrl}
                      user={user}
                      friend={friend}
                    />
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div className="relative z-10 shrink-0 border-t border-primary/10 bg-light/90 p-3 backdrop-blur-sm md:p-4">
          {attachment ? (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-[#00BFA5]/30 bg-[#003B44]/5 px-3 py-2">
              {attachment.fileType === "image" ? (
                <img src={attachment.fileUrl} alt={attachment.fileName || "Preview"} className="h-12 w-12 rounded-lg object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#003B44]/10">
                  <FileText size={18} className="text-[#003B44]" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-[#003B44]">{attachment.fileName}</p>
                <p className="text-[11px] text-[#003B44]/65">{attachment.fileType === "image" ? "Ảnh đính kèm" : "Tệp đính kèm"}</p>
              </div>
              <button
                type="button"
                onClick={() => setAttachment(null)}
                disabled={uploading}
                className="rounded-lg p-1 text-[#003B44]/80 transition hover:bg-[#003B44]/10 disabled:opacity-40"
                aria-label="Xóa tệp đính kèm"
              >
                <X size={16} />
              </button>
            </div>
          ) : null}

          {uploading ? (
            <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-[#003B44]/10">
              <div className="h-full rounded-full bg-[#00BFA5] transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
            </div>
          ) : null}

          <div className="flex items-center gap-2 rounded-2xl border border-[#003B44]/15 bg-accent/50 p-2 pl-2 shadow-sm focus-within:shadow-md focus-within:ring-2 focus-within:ring-[#00BFA5]/40">
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleChooseFile} />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!connected || uploading}
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
              disabled={!connected || uploading}
              className="min-w-0 flex-1 rounded-xl border-0 bg-light px-4 py-2.5 text-sm text-primary placeholder:text-primary/35 outline-none ring-1 ring-[#003B44]/15 transition focus:ring-2 focus:ring-[#00BFA5] disabled:opacity-60"
            />
            <button
              type="button"
              onClick={send}
              disabled={!connected || uploading || (!draft.trim() && !attachment?.fileUrl)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#003B44] text-[#00BFA5] shadow-md transition hover:opacity-90 disabled:opacity-40"
              aria-label="Gửi"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {lightboxUrl ? (
        <button
          type="button"
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setLightboxUrl("")}
          aria-label="Đóng xem ảnh"
        >
          <img src={lightboxUrl} alt="Ảnh phóng to" className="max-h-full max-w-full rounded-xl object-contain shadow-xl" />
        </button>
      ) : null}
    </div>
  );
}

export default ChatWindow;
