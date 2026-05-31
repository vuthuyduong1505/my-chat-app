import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Loader2, MessageCircle, Paperclip, Plus, Send, X } from "lucide-react";
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

function createQueuedAttachment(file) {
  const isImage = file.type.startsWith("image/");
  return {
    id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    file,
    fileName: file.name || "tep-dinh-kem",
    isImage,
    previewUrl: isImage ? URL.createObjectURL(file) : null,
    status: "queued",
    progress: 0
  };
}

function AttachmentPreviewStrip({ attachments, onRemove, onAddMore, disabled }) {
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

const RECALLED_TEXT = "Tin nhắn đã bị thu hồi";

function SeenReceipt({ friend }) {
  const initial = (friend?.firstName || friend?.email || "?")[0]?.toUpperCase();

  return (
    <div className="mr-10 mt-px flex items-center justify-end gap-0.5 self-end">
      {friend?.avatar ? (
        <img
          src={friend.avatar}
          alt=""
          className="h-3 w-3 shrink-0 rounded-full object-cover ring-1 ring-[#00BFA5]/30"
        />
      ) : (
        <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-[#003B44]/12 text-[6px] font-semibold leading-none text-[#003B44]/65">
          {initial}
        </span>
      )}
      <span className="text-[8px] leading-none text-[#003B44]/40">Đã xem</span>
    </div>
  );
}

function MessageRow({
  message,
  isMine,
  hoverTime,
  onOpenImage,
  user,
  friend,
  onRecall,
  onDeleteSelf,
  showSeenReceipt
}) {
  const [actionMenu, setActionMenu] = useState(null);
  const longPressTimerRef = useRef(null);

  const openActionMenu = (clientX, clientY) => {
    if (!isMine || message.isRecalled || message.pending) return;
    setActionMenu({ x: clientX, y: clientY });
  };

  const handleContextMenu = (e) => {
    e.preventDefault();
    openActionMenu(e.clientX, e.clientY);
  };

  const handleTouchStart = (e) => {
    if (!isMine || message.isRecalled || message.pending) return;
    longPressTimerRef.current = window.setTimeout(() => {
      const touch = e.touches[0];
      openActionMenu(touch.clientX, touch.clientY);
    }, 500);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!actionMenu) return undefined;
    const close = () => setActionMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [actionMenu]);

  if (message.isRecalled) {
    const recalledBubble = (
      <div
        className={`min-w-0 max-w-[80%] rounded-3xl px-3.5 py-2.5 text-sm italic shadow-sm ${
          isMine ? "rounded-br-2xl bg-[#003B44]/75 text-light/80" : "rounded-bl-2xl bg-gray-200 text-[#003B44]/55"
        }`}
      >
        {RECALLED_TEXT}
      </div>
    );

    if (isMine) {
      return (
        <div className="ml-auto flex w-full min-w-0 max-w-[min(92%,480px)] flex-col items-end">
          <div className="flex items-end justify-end gap-2">
            {hoverTime ? (
              <span className="shrink-0 self-end pb-1 text-[10px] leading-none tabular-nums text-primary/35 opacity-0 transition-opacity duration-150 group-hover/message-row:opacity-100">
                {hoverTime}
              </span>
            ) : null}
            {recalledBubble}
            <UserAvatar user={user} size="xs" className="shrink-0 ring-1 ring-primary/15" alt="" />
          </div>
          {showSeenReceipt ? <SeenReceipt friend={friend} /> : null}
        </div>
      );
    }

    return (
      <div className="flex w-full min-w-0 max-w-[min(92%,480px)] items-end justify-start gap-2">
        <UserAvatar user={friend} size="xs" className="shrink-0 ring-1 ring-primary/15" alt="" />
        {recalledBubble}
        {hoverTime ? (
          <span className="shrink-0 self-end pb-1 text-[10px] leading-none tabular-nums text-primary/35 opacity-0 transition-opacity duration-150 group-hover/message-row:opacity-100">
            {hoverTime}
          </span>
        ) : null}
      </div>
    );
  }

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
    <div
      className={`flex min-w-0 max-w-[80%] flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
    >
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

  const actionMenuEl = actionMenu ? (
    <div
      className="fixed z-50 min-w-[168px] overflow-hidden rounded-xl border border-[#00BFA5]/25 bg-[#003B44] py-1 shadow-xl"
      style={{ left: actionMenu.x, top: actionMenu.y }}
      onClick={(e) => e.stopPropagation()}
      role="menu"
    >
      <button
        type="button"
        role="menuitem"
        className="block w-full px-3 py-2 text-left text-sm text-light transition hover:bg-[#00BFA5]/20"
        onClick={() => {
          onRecall(message);
          setActionMenu(null);
        }}
      >
        Thu hồi
      </button>
      <button
        type="button"
        role="menuitem"
        className="block w-full px-3 py-2 text-left text-sm text-light/90 transition hover:bg-[#00BFA5]/20"
        onClick={() => {
          onDeleteSelf(message);
          setActionMenu(null);
        }}
      >
        Xóa phía tôi
      </button>
    </div>
  ) : null;

  if (isMine) {
    return (
      <>
        <div className="ml-auto flex w-full min-w-0 max-w-[min(92%,480px)] flex-col items-end">
          <div className="flex items-end justify-end gap-2">
            {hoverTimeAside}
            {contentColumn}
            {avatar}
          </div>
          {showSeenReceipt ? <SeenReceipt friend={friend} /> : null}
        </div>
        {actionMenuEl}
      </>
    );
  }

  return (
    <>
      <div className="flex w-full min-w-0 max-w-[min(92%,480px)] items-end justify-start gap-2">
        {avatar}
        {contentColumn}
        {hoverTimeAside}
      </div>
      {actionMenuEl}
    </>
  );
}

function ChatWindow({ friend, currentUserId }) {
  const { user } = useAuth();
  const { socket, connected, onlineUsers } = useSocket();
  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState("");
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const attachmentsRef = useRef(attachments);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

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

  /**
   * Cơ chế "Đã xem" (báo cáo):
   * 1. Mỗi tin gửi đi lưu isRead=false trên server.
   * 2. Khi người nhận mở khung chat (hoặc đang xem chat và có tin mới), client emit mark_as_read.
   * 3. Server gắn isRead=true cho tin do người kia gửi tới mình, rồi báo người gửi qua messages_read.
   * 4. Người gửi hiển thị "Đã xem" dưới tin nhắn cuối cùng của mình nếu tin đó đã isRead.
   */
  const markAsRead = useCallback(() => {
    if (!socket?.connected || !friendId) return;
    socket.emit("mark_as_read", { friendId });
  }, [socket, friendId]);

  useEffect(() => {
    if (!friendId || loadingHistory) return;
    markAsRead();
  }, [friendId, loadingHistory, markAsRead]);

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

      if (msg.sender === fid) {
        markAsRead();
      }
    };

    const onMessagesRead = ({ readBy }) => {
      const me = String(currentUserId);
      const fid = String(friendId);
      if (String(readBy) !== fid) return;
      setMessages((prev) =>
        prev.map((m) => (String(m.sender) === me && String(m.receiver) === fid ? { ...m, isRead: true } : m))
      );
    };

    const onMessageUpdated = (updated) => {
      const me = String(currentUserId);
      const fid = String(friendId);
      const inConv =
        (updated.sender === me && updated.receiver === fid) ||
        (updated.receiver === me && updated.sender === fid);
      if (!inConv) return;

      if ((updated.hiddenFor || []).map(String).includes(me)) {
        setMessages((prev) => prev.filter((m) => String(m._id) !== String(updated._id)));
        return;
      }

      setMessages((prev) =>
        prev.map((m) => (String(m._id) === String(updated._id) ? { ...m, ...updated, pending: false } : m))
      );
    };

    socket.on("new_message", onNew);
    socket.on("messages_read", onMessagesRead);
    socket.on("message_updated", onMessageUpdated);
    return () => {
      socket.off("new_message", onNew);
      socket.off("messages_read", onMessagesRead);
      socket.off("message_updated", onMessageUpdated);
    };
  }, [socket, friendId, currentUserId, markAsRead]);

  const revokePreview = (item) => {
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
  };

  const addFilesToQueue = (files) => {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return;
    setAttachments((prev) => [...prev, ...list.map((file) => createQueuedAttachment(file))]);
  };

  const removeQueuedAttachment = (id) => {
    setAttachments((prev) => {
      const target = prev.find((item) => item.id === id);
      revokePreview(target);
      return prev.filter((item) => item.id !== id);
    });
  };

  const uploadSingleFile = async (file, onProgress) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post("/chat/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (!event.total) return;
        onProgress(Math.round((event.loaded * 100) / event.total));
      }
    });
    return res.data;
  };

  const handleRecallMessage = (message) => {
    if (!socket?.connected || !message?._id || message.pending) return;
    socket.emit("delete_message", { messageId: String(message._id), mode: "everyone" });
  };

  const handleDeleteMessageForSelf = (message) => {
    if (!socket?.connected || !message?._id || message.pending) return;
    socket.emit("delete_message", { messageId: String(message._id), mode: "self" });
  };

  const emitChatMessage = ({ content = "", fileUrl = "", fileType = "", fileName = "" }) => {
    const tempId = `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const optimistic = {
      _id: tempId,
      tempId,
      sender: String(currentUserId),
      receiver: friendId,
      content,
      fileUrl,
      fileType,
      fileName,
      isRead: false,
      isRecalled: false,
      hiddenFor: [],
      createdAt: new Date().toISOString(),
      pending: true
    };

    setMessages((prev) => [...prev, optimistic]);
    socket.emit("send_message", {
      receiverId: friendId,
      content,
      fileUrl,
      fileType,
      fileName,
      tempId
    });
  };

  const send = async () => {
    const text = draft.trim();
    const queue = attachments.filter((item) => item.status === "queued" || item.status === "error");

    if ((!text && queue.length === 0) || sending || !socket?.connected || !friendId || !currentUserId) return;

    setSending(true);
    setDraft("");

    try {
      if (text) {
        emitChatMessage({ content: text });
      }

      for (const item of queue) {
        setAttachments((prev) =>
          prev.map((entry) => (entry.id === item.id ? { ...entry, status: "uploading", progress: 0, error: false } : entry))
        );

        try {
          const uploaded = await uploadSingleFile(item.file, (progress) => {
            setAttachments((prev) =>
              prev.map((entry) => (entry.id === item.id ? { ...entry, progress } : entry))
            );
          });

          emitChatMessage({
            fileUrl: uploaded?.fileUrl || "",
            fileType: uploaded?.fileType || "file",
            fileName: uploaded?.fileName || item.fileName
          });

          revokePreview(item);
          setAttachments((prev) => prev.filter((entry) => entry.id !== item.id));
        } catch {
          setAttachments((prev) =>
            prev.map((entry) => (entry.id === item.id ? { ...entry, status: "error", progress: 0 } : entry))
          );
          toast.error(`Không thể tải lên: ${item.fileName}`);
        }
      }
    } finally {
      setSending(false);
    }
  };

  const handleChooseFile = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    addFilesToQueue(files);
  };

  const handlePaste = (event) => {
    // Trình duyệt đặt ảnh copy/chụp màn hình vào clipboard dưới dạng File trong clipboardData.items.
    // Lấy tất cả item ảnh, chặn paste text mặc định, thêm vào hàng đợi — upload khi bấm Gửi.
    const clipboardItems = Array.from(event.clipboardData?.items || []);
    const pastedImages = clipboardItems
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter(Boolean);

    if (!pastedImages.length) return;

    event.preventDefault();
    addFilesToQueue(pastedImages);
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const hasQueuedAttachments = attachments.some((item) => item.status === "queued" || item.status === "error");
  const canSend = Boolean(draft.trim() || hasQueuedAttachments);

  const visibleMessages = useMemo(() => {
    const me = String(currentUserId);
    return messages.filter((m) => !(m.hiddenFor || []).map(String).includes(me));
  }, [messages, currentUserId]);

  const lastMyMessageId = useMemo(() => {
    const me = String(currentUserId);
    for (let i = visibleMessages.length - 1; i >= 0; i -= 1) {
      const m = visibleMessages[i];
      if (String(m.sender) === me && !m.isRecalled && !m.pending) return String(m._id);
    }
    return null;
  }, [visibleMessages, currentUserId]);

  const onlineUserSet = useMemo(
    () => (onlineUsers instanceof Set ? onlineUsers : new Set(Array.isArray(onlineUsers) ? onlineUsers.map(String) : [])),
    [onlineUsers]
  );
  const friendIsOnline = Boolean(friendId && onlineUserSet.has(String(friendId)));

  useEffect(() => {
    setDraft("");
    setSending(false);
    setAttachments((prev) => {
      prev.forEach(revokePreview);
      return [];
    });
  }, [friendId]);

  useEffect(
    () => () => {
      attachmentsRef.current.forEach(revokePreview);
    },
    []
  );

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
          ) : visibleMessages.length === 0 ? (
            <p className="py-8 text-center text-sm text-primary/45">Chưa có tin nhắn nào</p>
          ) : (
            visibleMessages.map((m, index) => {
              const isMine = String(m.sender) === String(currentUserId);
              const previousMessage = index > 0 ? visibleMessages[index - 1] : null;
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
                      onRecall={handleRecallMessage}
                      onDeleteSelf={handleDeleteMessageForSelf}
                      showSeenReceipt={
                        isMine && lastMyMessageId === String(m._id) && Boolean(m.isRead) && !m.pending
                      }
                    />
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div className="relative z-10 shrink-0 border-t border-primary/10 bg-light/90 p-3 backdrop-blur-sm md:p-4">
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleChooseFile} />

          <AttachmentPreviewStrip
            attachments={attachments}
            onRemove={removeQueuedAttachment}
            onAddMore={openFilePicker}
            disabled={sending || !connected}
          />

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
