import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera,
  ChevronDown,
  Edit2,
  FileText,
  Image,
  Info,
  Loader2,
  LogOut,
  MessageCircle,
  MoreVertical,
  Paperclip,
  Plus,
  Reply,
  Search,
  Send,
  UserPlus,
  Users,
  X
} from "lucide-react";
import toast from "react-hot-toast";
import api from "../api";
import GroupAvatar from "./GroupAvatar";
import UserAvatar from "./UserAvatar";
import { getCallingName, getCallingNameFromFullName } from "../utils/displayName";
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

function SeenReceipt({ user: peer }) {
  const initial = (peer?.firstName || peer?.email || "?")[0]?.toUpperCase();

  return (
    <div className="mr-10 mt-px flex items-center justify-end gap-0.5 self-end">
      {peer?.avatar ? (
        <img
          src={peer.avatar}
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

/** Avatar cực nhỏ cho trạng thái đã xem nhóm — viền trắng mảnh tách biệt */
function TinySeenAvatar({ user }) {
  const initial = (user?.firstName || user?.email || "?")[0]?.toUpperCase();

  if (user?.avatar) {
    return (
      <img
        src={user.avatar}
        alt=""
        className="h-3 w-3 shrink-0 rounded-full object-cover ring-1 ring-white"
      />
    );
  }

  return (
    <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-[#003B44]/12 text-[6px] font-semibold leading-none text-[#003B44]/70 ring-1 ring-white">
      {initial}
    </span>
  );
}

/** Hàng avatar đã xem dưới bong bóng tin nhóm (không có chữ) */
function GroupSeenAvatars({ viewers }) {
  if (!viewers?.length) return null;

  return (
    <div className="mr-10 mt-px flex flex-wrap items-center justify-end gap-px self-end">
      {viewers.map((viewer) => (
        <TinySeenAvatar key={String(viewer._id)} user={viewer} />
      ))}
    </div>
  );
}

function getSeenByUserId(entry) {
  if (!entry) return "";
  if (typeof entry === "object") return String(entry._id || entry.id || "");
  return String(entry);
}

/**
 * Messenger-style: mỗi người chỉ hiện avatar ở tin cuối cùng họ đã đọc.
 * Duyệt các tin của mình → với mỗi viewer, lưu index lớn nhất có trong seenBy.
 * Chỉ render avatar tại index đó (tin số 10 nếu họ đọc đến 10, không hiện ở 1–9).
 */
function buildGroupSeenAvatarMap(messages, currentUserId, memberMap) {
  const map = new Map();
  const me = String(currentUserId);
  const myMessages = messages
    .map((m, index) => ({ m, index }))
    .filter(
      ({ m }) =>
        isMessageMine(m, currentUserId) &&
        !isSystemMessage(m) &&
        !m.pending &&
        !m.isRecalled &&
        m._id &&
        !String(m._id).startsWith("t-")
    );

  /** viewerId → index tin của mình mà họ đọc cuối cùng */
  const viewerLastReadIndex = new Map();

  myMessages.forEach(({ m, index }) => {
    (m.seenBy || []).forEach((entry) => {
      const vid = getSeenByUserId(entry);
      if (!vid || vid === me) return;
      const prev = viewerLastReadIndex.get(vid) ?? -1;
      if (index > prev) viewerLastReadIndex.set(vid, index);
    });
  });

  myMessages.forEach(({ m, index }) => {
    const viewers = [];
    viewerLastReadIndex.forEach((lastIndex, vid) => {
      if (lastIndex !== index) return;
      const fromMsg = (m.seenBy || []).find((entry) => getSeenByUserId(entry) === vid);
      if (fromMsg && typeof fromMsg === "object" && (fromMsg.firstName !== undefined || fromMsg.avatar)) {
        viewers.push(fromMsg);
        return;
      }
      const member = memberMap?.get?.(vid);
      viewers.push(member ? mergeUserProfile(member, null) : { _id: vid });
    });
    if (viewers.length) map.set(String(m._id), viewers);
  });

  return map;
}

function mergeSeenByEntry(list, user) {
  const uid = getSeenByUserId(user);
  if (!uid) return list || [];
  const current = list || [];
  if (current.some((e) => getSeenByUserId(e) === uid)) return current;
  return [...current, user];
}

function displayUserName(person) {
  if (!person) return "Thành viên";
  const name = `${person.firstName || ""} ${person.lastName || ""}`.trim();
  return name || person.email || "Thành viên";
}

/** ID người gửi — sender có thể là string hoặc object đã populate */
function getSenderId(m) {
  if (m?.senderId) return String(m.senderId);
  const raw = m?.sender;
  if (!raw) return "";
  if (typeof raw === "object") return String(raw._id || raw.id || "");
  return String(raw);
}

function isMessageMine(m, currentUserId) {
  if (!m || !currentUserId) return false;
  const raw = m.sender;
  const senderKey =
    raw && typeof raw === "object" ? raw._id || raw.id : raw ?? m.senderId;
  return String(senderKey ?? "") === String(currentUserId);
}

/** Gộp profile từ sender populate + fallback (friend / user) để Avatar luôn có dữ liệu */
function mergeUserProfile(primary, fallback) {
  const p = primary && typeof primary === "object" ? primary : null;
  const f = fallback && typeof fallback === "object" ? fallback : null;
  if (!p && !f) return null;
  return {
    _id: String(p?._id || p?.id || f?._id || f?.id || ""),
    firstName: p?.firstName || f?.firstName || "",
    lastName: p?.lastName || f?.lastName || "",
    email: p?.email || f?.email || "",
    avatar: String(p?.avatar || f?.avatar || "").trim()
  };
}

/**
 * Avatar cho từng dòng tin: ưu tiên m.sender.avatar (populate),
 * fallback user (tin mình) hoặc friend (tin 1-1) / memberMap (nhóm).
 */
function resolveMessageAvatar(m, isMine, { user, friend, memberMap, currentUserId, isGroupChat }) {
  if (isMine) {
    const fromSender = typeof m.sender === "object" && m.sender ? m.sender : null;
    return mergeUserProfile(fromSender, user);
  }

  const id = getSenderId(m);
  let fallback = friend;
  if (isGroupChat && memberMap && id) {
    fallback = memberMap.get(id) || friend;
  }

  if (typeof m.sender === "object" && m.sender && (m.sender._id || m.sender.id)) {
    return mergeUserProfile(m.sender, fallback);
  }

  return fallback || null;
}

function resolvePeerUser(m, { user, friend, memberMap, currentUserId, isGroupChat }) {
  return resolveMessageAvatar(m, isMessageMine(m, currentUserId), {
    user,
    friend,
    memberMap,
    currentUserId,
    isGroupChat
  });
}

function replyContentLabel(replyTo) {
  if (!replyTo) return "";
  if (replyTo.isRecalled) return "Tin nhắn đã bị thu hồi";
  if (replyTo.fileType === "image") return "Hình ảnh";
  if (replyTo.fileType === "file") return "Tệp tin";
  const text = (replyTo.content || "").trim();
  if (!text) return "Tin nhắn";
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

function replyAuthorName(replyTo, currentUserId, { friend, memberMap } = {}) {
  if (!replyTo) return "Thành viên";
  const sid =
    replyTo.senderId ||
    (typeof replyTo.sender === "object"
      ? String(replyTo.sender._id || replyTo.sender.id || "")
      : String(replyTo.sender || ""));
  if (sid && String(sid) === String(currentUserId)) return "Bạn";
  if (replyTo.senderName) {
    const first = replyTo.senderName.split(" ")[0];
    return first || replyTo.senderName;
  }
  if (typeof replyTo.sender === "object" && replyTo.sender?.firstName) {
    return replyTo.sender.firstName;
  }
  if (memberMap && sid) {
    const member = memberMap.get(sid);
    if (member?.firstName) return member.firstName;
  }
  if (friend && sid === String(friend._id || friend.id)) {
    return friend.firstName || displayUserName(friend);
  }
  return "Thành viên";
}

function buildReplySnapshot(message) {
  if (!message?._id) return null;
  return {
    _id: String(message._id),
    content: message.content || "",
    fileUrl: message.fileUrl || "",
    fileType: message.fileType || "",
    fileName: message.fileName || "",
    isRecalled: Boolean(message.isRecalled),
    sender: message.sender,
    senderId: message.senderId || getSenderId(message),
    senderName: message.senderName || ""
  };
}

/** Khối trích dẫn tin được trả lời — thanh Cyan bên trái, nhấn để cuộn tới tin gốc */
function ReplyQuote({ replyTo, isMine, onJump, currentUserId, friend, memberMap }) {
  if (!replyTo?._id) return null;

  const name = replyAuthorName(replyTo, currentUserId, { friend, memberMap });
  const preview = replyContentLabel(replyTo);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onJump?.(replyTo._id);
      }}
      className={`mb-1.5 w-full max-w-full rounded-md border-l-[3px] border-[#00BFA5] px-2.5 py-1.5 text-left transition hover:opacity-90 ${
        isMine ? "bg-black/15" : "bg-[#003B44]/[0.07]"
      }`}
    >
      <p className="truncate text-[11px] font-semibold text-[#00BFA5]">{name}</p>
      <p className={`truncate text-[11px] ${isMine ? "text-light/75" : "text-[#003B44]/55"}`}>{preview}</p>
    </button>
  );
}

/**
 * Thu hồi (Unsend) vs Xóa (Remove) — báo cáo:
 * - Thu hồi: chỉ tin của mình; server đặt isRecalled=true, mọi người thấy "Tin nhắn đã bị thu hồi".
 * - Xóa ở phía tôi: ai cũng được; server thêm userId vào hiddenFor — chỉ ẩn trên thiết bị người xóa.
 */
function MessageMoreMenu({ isMine, onUnsend, onRemoveForMe, onClose, align = "right" }) {
  return (
    <div
      className={`absolute bottom-full z-50 mb-2 min-w-[200px] overflow-hidden rounded-xl bg-white py-1.5 shadow-xl ${
        align === "left" ? "left-0" : "right-0"
      }`}
      data-message-action
      role="menu"
      onClick={(e) => e.stopPropagation()}
    >
      {isMine ? (
        <button
          type="button"
          role="menuitem"
          className="block w-full px-4 py-2.5 text-left text-sm text-[#003B44] transition hover:bg-gray-100"
          onClick={() => {
            onUnsend?.();
            onClose?.();
          }}
        >
          Thu hồi
        </button>
      ) : null}
      <button
        type="button"
        role="menuitem"
        className="block w-full px-4 py-2.5 text-left text-sm text-[#003B44] transition hover:bg-gray-100"
        onClick={() => {
          onRemoveForMe?.();
          onClose?.();
        }}
      >
        Xóa ở phía tôi
      </button>
    </div>
  );
}

/** Hành lang nút Reply + More — chỉ hiện khi hover dòng tin (Messenger-style) */
function MessageActionBar({ message, isMine, onReply, onUnsend, onRemoveForMe }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e) => {
      if (menuWrapRef.current?.contains(e.target)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  if (message.isRecalled || message.pending) return null;

  const btnClass = `relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-primary/75 transition-all duration-200 opacity-0 pointer-events-none hover:bg-gray-200 hover:text-primary group-hover/message-row:pointer-events-auto group-hover/message-row:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 ${
    menuOpen ? "pointer-events-auto opacity-100" : ""
  }`;

  return (
    <div className="relative z-10 flex shrink-0 items-center gap-0.5 self-center" data-message-action>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onReply?.(message);
        }}
        className={btnClass}
        aria-label="Trả lời"
        title="Trả lời"
      >
        <Reply size={14} />
      </button>
      <div className="relative" ref={menuWrapRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
          className={btnClass}
          aria-label="Tuỳ chọn khác"
          aria-expanded={menuOpen}
          title="Tuỳ chọn"
        >
          <MoreVertical size={14} />
        </button>
        {menuOpen ? (
          <MessageMoreMenu
            isMine={isMine}
            align={isMine ? "right" : "left"}
            onUnsend={() => onUnsend?.(message)}
            onRemoveForMe={() => onRemoveForMe?.(message)}
            onClose={() => setMenuOpen(false)}
          />
        ) : null}
      </div>
    </div>
  );
}

/** Tên gọi phía trên bong bóng chat nhóm — chỉ lấy từ cuối của họ tên đầy đủ */
function groupBubbleSenderName(m, peerUser) {
  if (m.sender && typeof m.sender === "object") {
    const calling = getCallingName(m.sender);
    if (calling) return calling;
  }
  if (m.senderName) {
    return getCallingNameFromFullName(m.senderName) || m.senderName;
  }
  if (peerUser) {
    const calling = getCallingName(peerUser);
    if (calling) return calling;
  }
  return getCallingNameFromFullName(displayUserName(peerUser)) || "Thành viên";
}

/** Ngưỡng 30 phút — tin cách nhau hơn mức này được coi là hai nhóm riêng */
const MESSAGE_GROUP_GAP_MS = 30 * 60 * 1000;

/** Khoảng thời gian (ms) giữa hai tin; laterMessage mới hơn earlierMessage */
function getMessageTimeGapMs(laterMessage, earlierMessage) {
  const later = new Date(laterMessage?.createdAt).getTime();
  const earlier = new Date(earlierMessage?.createdAt).getTime();
  if (Number.isNaN(later) || Number.isNaN(earlier)) return Infinity;
  return later - earlier;
}

/** Cùng người gửi — so sánh senderId hoặc sender._id đã populate */
function isSameMessageSender(messageA, messageB) {
  if (!messageA || !messageB) return false;
  const idA = getSenderId(messageA);
  const idB = getSenderId(messageB);
  return Boolean(idA && idB && idA === idB);
}

/**
 * Hai tin liền kề có thuộc cùng nhóm gom không?
 * Cần cùng người gửi VÀ khoảng cách thời gian ≤ 30 phút.
 */
function isSystemMessage(message) {
  return message?.messageType === "system";
}

function areMessagesInSameGroup(earlierMessage, laterMessage) {
  if (isSystemMessage(earlierMessage) || isSystemMessage(laterMessage)) return false;
  if (!isSameMessageSender(earlierMessage, laterMessage)) return false;
  return getMessageTimeGapMs(laterMessage, earlierMessage) <= MESSAGE_GROUP_GAP_MS;
}

/**
 * Xác định vị trí tin trong nhóm gom liên tiếp.
 *
 * prevMessage — tin ngay phía trên (cũ hơn):
 *   isFirstInGroup = true khi không có prev, khác người gửi, hoặc cách prev > 30 phút.
 *
 * nextMessage — tin ngay phía dưới (mới hơn):
 *   isLastInGroup = true khi không có next, khác người gửi, hoặc cách next > 30 phút.
 */
function getMessageGroupPosition(message, prevMessage, nextMessage) {
  const isFirstInGroup =
    !prevMessage || !areMessagesInSameGroup(prevMessage, message);
  const isLastInGroup =
    !nextMessage || !areMessagesInSameGroup(message, nextMessage);
  return { isFirstInGroup, isLastInGroup };
}

/** Bo góc bong bóng theo vị trí trong nhóm — giảm bo phía avatar để các tin 'dính' nhau */
function getGroupedBubbleRadius(isMine, isFirstInGroup, isLastInGroup) {
  if (isMine) {
    if (isFirstInGroup && isLastInGroup) return "rounded-3xl rounded-br-2xl";
    if (isFirstInGroup) return "rounded-3xl rounded-br-md";
    if (isLastInGroup) return "rounded-3xl rounded-tr-md rounded-br-2xl";
    return "rounded-3xl rounded-tr-md rounded-br-md";
  }
  if (isFirstInGroup && isLastInGroup) return "rounded-3xl rounded-bl-2xl";
  if (isFirstInGroup) return "rounded-3xl rounded-bl-md";
  if (isLastInGroup) return "rounded-3xl rounded-tl-md rounded-bl-2xl";
  return "rounded-3xl rounded-tl-md rounded-bl-md";
}

/** Vùng đệm thay avatar (size xs = h-8 w-8) khi tin không phải cuối nhóm */
function MessageAvatarPlaceholder() {
  return <div className="h-8 w-8 shrink-0" aria-hidden="true" />;
}

function MessageRow({
  message,
  isMine,
  hoverTime,
  onOpenImage,
  avatarUser,
  senderLabel,
  isGroupChat,
  isFirstInGroup,
  isLastInGroup,
  readReceiptUser,
  onUnsend,
  onRemoveForMe,
  onReply,
  onScrollToReply,
  currentUserId,
  friend,
  memberMap,
  showSeenReceipt,
  groupSeenViewers
}) {
  if (message.isRecalled) {
    const recalledRadius = getGroupedBubbleRadius(isMine, isFirstInGroup, isLastInGroup);
    const recalledBubble = (
      <div
        className={`min-w-0 max-w-[80%] px-3.5 py-2.5 text-sm italic shadow-sm ${recalledRadius} ${
          isMine ? "bg-[#003B44]/75 text-light/80" : "bg-gray-200 text-[#003B44]/55"
        }`}
      >
        {RECALLED_TEXT}
      </div>
    );

    const avatarSlot = isLastInGroup ? (
      <UserAvatar user={avatarUser} size="xs" className="shrink-0 ring-1 ring-primary/15" alt="" />
    ) : (
      <MessageAvatarPlaceholder />
    );

    if (isMine) {
      return (
        <div className="group flex w-full flex-col items-end">
          <div className="flex max-w-[min(92%,480px)] flex-row items-end gap-1.5">
            {hoverTime ? (
              <span className="shrink-0 self-end pb-1 text-[10px] leading-none tabular-nums text-primary/35 opacity-0 transition-opacity duration-150 group-hover/message-row:opacity-100 group-hover:opacity-100">
                {hoverTime}
              </span>
            ) : null}
            {recalledBubble}
            {avatarSlot}
          </div>
          {showSeenReceipt ? <SeenReceipt user={readReceiptUser} /> : null}
          {isGroupChat && isMine && groupSeenViewers?.length ? (
            <GroupSeenAvatars viewers={groupSeenViewers} />
          ) : null}
        </div>
      );
    }

    const recalledSenderName =
      !isMine && isGroupChat && isFirstInGroup && senderLabel ? (
        <p className="mb-0.5 max-w-[min(92%,480px)] truncate px-1 text-[10px] font-medium text-[#003B44]/55">
          {senderLabel}
        </p>
      ) : null;

    return (
      <div className="group flex max-w-[min(92%,480px)] flex-row items-end gap-1.5">
        {avatarSlot}
        <div className="flex min-w-0 flex-col items-start">
          {recalledSenderName}
          {recalledBubble}
        </div>
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

  const bubbleRadius = getGroupedBubbleRadius(isMine, isFirstInGroup, isLastInGroup);
  const bubbleClass = isMine
    ? `min-w-0 max-w-full ${bubbleRadius} bg-primary px-3.5 py-2.5 text-sm text-light shadow-sm ${pendingClass}`
    : `min-w-0 max-w-full ${bubbleRadius} bg-gray-100 px-3.5 py-2.5 text-sm text-primary shadow-sm ${pendingClass}`;

  const avatarSlot = isLastInGroup ? (
    <UserAvatar user={avatarUser} size="xs" className="shrink-0 ring-1 ring-primary/15" alt="" />
  ) : (
    <MessageAvatarPlaceholder />
  );

  const hoverTimeAside = hoverTime ? (
    <span className="shrink-0 self-end pb-1 text-[10px] leading-none tabular-nums text-primary/35 opacity-0 transition-opacity duration-150 group-hover/message-row:opacity-100 group-hover:opacity-100">
      {hoverTime}
    </span>
  ) : null;

  const actionBar = (
    <MessageActionBar
      message={message}
      isMine={isMine}
      onReply={onReply}
      onUnsend={onUnsend}
      onRemoveForMe={onRemoveForMe}
    />
  );

  const quoteEl = message.replyTo ? (
    <ReplyQuote
      replyTo={message.replyTo}
      isMine={isMine}
      onJump={onScrollToReply}
      currentUserId={currentUserId}
      friend={friend}
      memberMap={memberMap}
    />
  ) : null;

  const messageBody = (
    <div className={`flex w-fit min-w-0 max-w-[80%] flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}>
      {quoteEl && (hasImage || hasFile) && !hasText ? quoteEl : null}
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
          {quoteEl && (hasText || (!hasImage && !hasFile)) ? quoteEl : null}
          <p className="break-all whitespace-pre-wrap [overflow-wrap:anywhere] leading-snug">{message.content}</p>
        </div>
      ) : null}
      {!hasText && quoteEl && !hasImage && !hasFile ? quoteEl : null}
    </div>
  );

  const senderNameEl =
    !isMine && isGroupChat && isFirstInGroup && senderLabel ? (
      <p className="mb-0.5 max-w-[min(92%,480px)] truncate px-1 text-[10px] font-medium text-[#003B44]/55">{senderLabel}</p>
    ) : null;

  if (isMine) {
    return (
      <div className="group flex w-full flex-col items-end">
        <div className="flex max-w-[min(92%,480px)] flex-row items-end gap-1.5">
          <div className="flex shrink-0 items-center gap-0.5 self-end">
            {hoverTimeAside}
            {actionBar}
          </div>
          {messageBody}
          {avatarSlot}
        </div>
        {showSeenReceipt ? <SeenReceipt user={readReceiptUser} /> : null}
        {isGroupChat && groupSeenViewers?.length ? <GroupSeenAvatars viewers={groupSeenViewers} /> : null}
      </div>
    );
  }

  return (
    <div className="group flex max-w-[min(92%,480px)] flex-row items-end gap-1.5">
      {avatarSlot}
      <div className="flex min-w-0 flex-col items-start">
        {senderNameEl}
        <div className="flex items-end gap-0.5">
          {messageBody}
          <div className="flex shrink-0 items-center gap-0.5 self-end">
            {actionBar}
            {hoverTimeAside}
          </div>
        </div>
      </div>
    </div>
  );
}

function getGroupCreatorId(group) {
  const raw = group?.creator;
  if (raw && typeof raw === "object") return String(raw._id || raw.id || "");
  if (group?.creatorId) return String(group.creatorId);
  if (raw) return String(raw);
  return "";
}

function memberDisplayLabel(member) {
  const name = `${member?.firstName || ""} ${member?.lastName || ""}`.trim();
  return getCallingName(member) || name || member?.email || "Thành viên";
}

/** Họ tên đầy đủ (firstName + lastName) — dùng trong Sidebar thành viên nhóm */
function memberFullName(member) {
  const name = `${member?.firstName || ""} ${member?.lastName || ""}`.trim();
  return name || member?.email || "Thành viên";
}

function personFullName(person) {
  const name = `${person?.firstName || ""} ${person?.lastName || ""}`.trim();
  return name || person?.email || "Người dùng";
}

/**
 * Modal đổi tên nhóm — thay thế window.prompt.
 * window.prompt dùng hộp thoại hệ thống (hiện "localhost", không khớp UI app).
 * Luồng mới: bấm "Đổi tên" → setShowRenameModal(true) → modal React tùy chỉnh ở giữa màn hình.
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

/**
 * Lọc ảnh/file từ danh sách tin nhắn đang hiển thị (đồng bộ realtime với socket new_message).
 * Quy tắc giống backend classifyConversationMedia: có fileUrl, không thu hồi, không phải system.
 */
function extractSharedMediaFromMessages(messageList) {
  const images = [];
  const files = [];

  for (const m of messageList) {
    if (isSystemMessage(m) || m.isRecalled || m.pending) continue;
    const url = String(m.fileUrl || "").trim();
    if (!url) continue;

    const item = {
      _id: String(m._id),
      fileUrl: url,
      fileName: m.fileName || "",
      createdAt: m.createdAt
    };

    if (m.fileType === "image" || m.messageType === "image") {
      images.push({ ...item, fileType: "image" });
    } else if (m.fileType === "file" || m.messageType === "file") {
      files.push({ ...item, fileType: "file" });
    }
  }

  const byNewest = (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  images.sort(byNewest);
  files.sort(byNewest);

  return { images, files };
}

/**
 * Accordion "File phương tiện và File" trên Sidebar phải.
 * - Tab ảnh: lưới 3 cột; tab file: danh sách tải xuống.
 * - Cập nhật ngay khi messages thay đổi (tin ảnh/file mới qua socket).
 */
function ChatMediaGallerySection({ chatId, isGroupChat, messages, onOpenImage }) {
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [mediaTab, setMediaTab] = useState("media");
  const [loading, setLoading] = useState(false);
  const [fetchedMedia, setFetchedMedia] = useState({ images: [], files: [] });

  const fromMessages = useMemo(() => extractSharedMediaFromMessages(messages), [messages]);

  const { images, files } = useMemo(() => {
    const imageMap = new Map();
    const fileMap = new Map();
    [...fetchedMedia.images, ...fromMessages.images].forEach((item) => imageMap.set(item._id, item));
    [...fetchedMedia.files, ...fromMessages.files].forEach((item) => fileMap.set(item._id, item));
    const byNewest = (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return {
      images: Array.from(imageMap.values()).sort(byNewest),
      files: Array.from(fileMap.values()).sort(byNewest)
    };
  }, [fetchedMedia, fromMessages]);

  useEffect(() => {
    setAccordionOpen(false);
    setMediaTab("media");
    setFetchedMedia({ images: [], files: [] });
  }, [chatId]);

  useEffect(() => {
    if (!accordionOpen || !chatId) return undefined;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const url = isGroupChat ? `/groups/${chatId}/media` : `/chat/${chatId}/media`;
        const res = await api.get(url);
        if (!cancelled) {
          setFetchedMedia({
            images: res.data?.images || [],
            files: res.data?.files || []
          });
        }
      } catch {
        if (!cancelled) setFetchedMedia({ images: [], files: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [accordionOpen, chatId, isGroupChat]);

  const emptyHint = "Chưa có tài nguyên nào được chia sẻ";

  return (
    <div className="border-b border-[#003B44]/8 py-2">
      <button
        type="button"
        onClick={() => setAccordionOpen((v) => !v)}
        className="flex w-full items-center justify-between px-6 py-4 text-left text-sm font-semibold text-[#003B44]"
      >
        <span>File phương tiện và File</span>
        <ChevronDown
          size={18}
          className={`text-[#00BFA5] transition-transform duration-200 ${accordionOpen ? "rotate-180" : ""}`}
        />
      </button>

      {accordionOpen ? (
        <div className="space-y-3 px-4 pb-6">
          <div className="flex gap-1 rounded-full bg-[#003B44]/5 p-1">
            <button
              type="button"
              onClick={() => setMediaTab("media")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-medium transition ${
                mediaTab === "media"
                  ? "bg-[#003B44] text-[#00BFA5]"
                  : "text-[#003B44]/55 hover:text-[#003B44]"
              }`}
            >
              <Image size={14} />
              File phương tiện
            </button>
            <button
              type="button"
              onClick={() => setMediaTab("files")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-medium transition ${
                mediaTab === "files"
                  ? "bg-[#003B44] text-[#00BFA5]"
                  : "text-[#003B44]/55 hover:text-[#003B44]"
              }`}
            >
              <FileText size={14} />
              File
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 size={20} className="animate-spin text-[#00BFA5]" />
            </div>
          ) : mediaTab === "media" ? (
            images.length === 0 ? (
              <p className="py-4 text-center text-xs text-[#003B44]/45">{emptyHint}</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {images.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => onOpenImage(item.fileUrl)}
                    className="aspect-square overflow-hidden rounded-xl ring-1 ring-[#003B44]/10 transition hover:ring-[#00BFA5]/50"
                  >
                    <img src={item.fileUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )
          ) : files.length === 0 ? (
            <p className="py-4 text-center text-xs text-[#003B44]/45">{emptyHint}</p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {files.map((item) => (
                <li key={item._id}>
                  <button
                    type="button"
                    onClick={() => downloadFile(item.fileUrl, item.fileName)}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-[#003B44]/5"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#003B44]/8 text-[#00BFA5]">
                      <FileText size={16} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-[#003B44]">
                      {item.fileName || "Tệp đính kèm"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Modal xác nhận rời nhóm — thay window.confirm (hộp thoại hệ thống hiện "localhost").
 * Quản lý đóng/mở: parent giữ state showLeaveConfirmModal.
 * - Bấm "Rời khỏi nhóm" ở Sidebar → setShowLeaveConfirmModal(true).
 * - "Hủy" hoặc click nền mờ → onClose() → setShowLeaveConfirmModal(false).
 * - "Rời nhóm" → onConfirm() → gọi API; đóng modal khi xong hoặc khi lỗi (tùy parent).
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
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-2 py-2 transition ${
                        checked ? "border-[#00BFA5]/40 bg-[#00BFA5]/10" : "border-transparent hover:bg-[#003B44]/5"
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

function ChatWindow({ friend, group, groupId: routeGroupId, currentUserId, onGroupChange, onLeaveGroup }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, connected, onlineUsers } = useSocket();
  const isGroupChat = Boolean(group);
  const [infoSidebarOpen, setInfoSidebarOpen] = useState(false);
  const [membersAccordionOpen, setMembersAccordionOpen] = useState(true);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
  const [localGroup, setLocalGroup] = useState(group);
  const [leavingGroup, setLeavingGroup] = useState(false);
  const [updatingGroup, setUpdatingGroup] = useState(false);
  const groupAvatarInputRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState("");
  const [replyTarget, setReplyTarget] = useState(null);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const messageRefs = useRef({});
  const attachmentsRef = useRef(attachments);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    setLocalGroup(group);
  }, [group]);

  const activeGroup = isGroupChat ? localGroup || group : null;

  const chatId = useMemo(() => {
    if (isGroupChat) {
      if (routeGroupId) return String(routeGroupId);
      return activeGroup ? String(activeGroup._id || activeGroup.id || "") : null;
    }
    if (!friend) return null;
    return String(friend._id || friend.id || "");
  }, [friend, activeGroup, isGroupChat, routeGroupId]);

  const memberMap = useMemo(() => {
    const map = new Map();
    (activeGroup?.members || []).forEach((member) => {
      map.set(String(member._id || member.id), member);
    });
    return map;
  }, [activeGroup]);

  const groupCreatorId = useMemo(() => getGroupCreatorId(activeGroup), [activeGroup]);

  /** Chỉ cập nhật state local (khi tải tin nhắn) — không báo parent để tránh vòng lặp reload */
  const syncLocalGroup = useCallback((updated) => {
    if (!updated) return;
    setLocalGroup(updated);
  }, []);

  /** Cập nhật sau thao tác user / socket — đồng bộ sidebar & danh sách hội thoại */
  const publishGroupUpdate = useCallback(
    (updated) => {
      if (!updated) return;
      setLocalGroup(updated);
      onGroupChange?.(updated);
      window.dispatchEvent(new CustomEvent("groups-updated"));
    },
    [onGroupChange]
  );

  const chatTitle = useMemo(() => {
    if (isGroupChat) return activeGroup?.name || "Nhóm chat";
    const n = `${friend?.firstName || ""} ${friend?.lastName || ""}`.trim();
    return n || friend?.email || "Bạn bè";
  }, [friend, activeGroup, isGroupChat]);

  const chatSubtitle = useMemo(() => {
    if (isGroupChat) {
      const count = activeGroup?.memberCount || activeGroup?.members?.length || 0;
      return `${count} thành viên`;
    }
    const fid = chatId;
    const online = fid && (onlineUsers instanceof Set ? onlineUsers : new Set()).has(String(fid));
    if (!connected) return "Đang kết nối máy chủ…";
    return online ? "Đang hoạt động" : "Offline";
  }, [isGroupChat, activeGroup, chatId, connected, onlineUsers]);

  useEffect(() => {
    setInfoSidebarOpen(false);
    setMembersAccordionOpen(true);
    setShowLeaveConfirmModal(false);
    setShowRenameModal(false);
  }, [chatId]);

  useEffect(() => {
    if (!socket || !isGroupChat || !chatId) return undefined;

    const onGroupUpdated = ({ group: updated }) => {
      if (!updated || String(updated._id) !== String(chatId)) return;
      publishGroupUpdate(updated);
    };

    socket.on("group_updated", onGroupUpdated);
    return () => socket.off("group_updated", onGroupUpdated);
  }, [socket, isGroupChat, chatId, publishGroupUpdate]);

  const handleConfirmRenameGroup = async (trimmed) => {
    if (!chatId || updatingGroup || !trimmed) return;
    setUpdatingGroup(true);
    try {
      const res = await api.put(`/groups/${chatId}`, { name: trimmed });
      publishGroupUpdate(res.data?.group);
      setShowRenameModal(false);
      toast.success("Đã đổi tên nhóm.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Không thể đổi tên nhóm.");
    } finally {
      setUpdatingGroup(false);
    }
  };

  const handleGroupAvatarPick = () => groupAvatarInputRef.current?.click();

  const handleGroupAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !chatId) return;
    const form = new FormData();
    form.append("avatar", file);
    setUpdatingGroup(true);
    try {
      const res = await api.put(`/groups/${chatId}`, form, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      publishGroupUpdate(res.data?.group);
      toast.success("Đã cập nhật ảnh nhóm.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Không thể đổi ảnh nhóm.");
    } finally {
      setUpdatingGroup(false);
    }
  };

  const handleConfirmLeaveGroup = async () => {
    if (!chatId || leavingGroup) return;
    setLeavingGroup(true);
    try {
      await api.post(`/groups/${chatId}/leave`);
      setShowLeaveConfirmModal(false);
      toast.success("Đã rời nhóm.");
      onLeaveGroup?.();
      navigate("/");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Không thể rời nhóm.");
    } finally {
      setLeavingGroup(false);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!chatId || loadingHistory) return undefined;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "auto" });
      });
    });
    return () => cancelAnimationFrame(id);
  }, [chatId, loadingHistory]);

  const scrollToMessage = useCallback((messageId) => {
    const el = messageRefs.current[String(messageId)];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-[#00BFA5]/50", "rounded-2xl");
      window.setTimeout(() => {
        el.classList.remove("ring-2", "ring-[#00BFA5]/50", "rounded-2xl");
      }, 1600);
    }
  }, []);

  const handleReplyToMessage = useCallback((message) => {
    if (!message || message.isRecalled || message.pending || isSystemMessage(message)) return;
    setReplyTarget(buildReplySnapshot(message));
  }, []);

  useEffect(() => {
    setReplyTarget(null);
    messageRefs.current = {};
  }, [chatId]);

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      return undefined;
    }

    let cancelled = false;
    const load = async () => {
      setLoadingHistory(true);
      try {
        const url = isGroupChat ? `/groups/${chatId}/messages` : `/chat/${chatId}`;
        const res = await api.get(url);
        if (!cancelled) {
          setMessages(res.data?.messages || []);
          if (isGroupChat && res.data?.group) syncLocalGroup(res.data.group);
        }
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
  }, [chatId, isGroupChat, syncLocalGroup]);

  useEffect(() => {
    if (!socket || !chatId) return undefined;

    const join = () => {
      if (isGroupChat) {
        socket.emit("join_group_chat", { groupId: chatId });
      } else {
        socket.emit("join_chat", { friendId: chatId });
      }
    };

    join();
    socket.on("connect", join);

    return () => {
      socket.off("connect", join);
      if (isGroupChat) {
        socket.emit("leave_group_chat", { groupId: chatId });
      } else {
        socket.emit("leave_chat", { friendId: chatId });
      }
    };
  }, [socket, chatId, isGroupChat]);

  /**
   * Cơ chế "Đã xem":
   * - DM: mark_as_read({ friendId }) → isRead, hiển thị "Đã xem" dưới tin cuối.
   * - Nhóm: mark_as_read({ groupId }) → seenBy[], avatar nhỏ dưới tin cuối mỗi người đã đọc.
   */
  const markAsRead = useCallback(() => {
    if (!socket?.connected || !chatId) return;
    if (isGroupChat) {
      socket.emit("mark_as_read", { groupId: chatId });
    } else {
      socket.emit("mark_as_read", { friendId: chatId });
    }
  }, [socket, chatId, isGroupChat]);

  useEffect(() => {
    if (!chatId || loadingHistory) return;
    markAsRead();
  }, [chatId, loadingHistory, markAsRead]);

  useEffect(() => {
    if (!socket || !chatId || !currentUserId) return undefined;

    const onNew = (msg) => {
      const me = String(currentUserId);
      const msgSenderId = getSenderId(msg);
      const inConv = isGroupChat
        ? String(msg.groupId) === String(chatId)
        : (msgSenderId === me && msg.receiver === String(chatId)) ||
          (msgSenderId === String(chatId) && msg.receiver === me);
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

      if (isGroupChat && getSenderId(msg) !== me) {
        markAsRead();
      } else if (!isGroupChat && getSenderId(msg) === String(chatId)) {
        markAsRead();
      }
    };

    const onGroupMessageSeen = ({ groupId, userId, user, messageIds }) => {
      if (!isGroupChat || String(groupId) !== String(chatId)) return;
      const ids = new Set((messageIds || []).map(String));
      if (!ids.size) return;

      setMessages((prev) =>
        prev.map((m) => {
          if (!ids.has(String(m._id))) return m;
          return { ...m, seenBy: mergeSeenByEntry(m.seenBy, user || { _id: userId }) };
        })
      );
    };

    const onMessagesRead = ({ readBy }) => {
      if (isGroupChat) return;
      const me = String(currentUserId);
      const fid = String(chatId);
      if (String(readBy) !== fid) return;
      setMessages((prev) =>
        prev.map((m) => (getSenderId(m) === me && String(m.receiver) === fid ? { ...m, isRead: true } : m))
      );
    };

    const onMessageUpdated = (updated) => {
      const me = String(currentUserId);
      const updatedSenderId = getSenderId(updated);
      const inConv = isGroupChat
        ? String(updated.groupId) === String(chatId)
        : (updatedSenderId === me && updated.receiver === String(chatId)) ||
          (updated.receiver === me && updatedSenderId === String(chatId));
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
    socket.on("group_message_seen", onGroupMessageSeen);
    socket.on("messages_read", onMessagesRead);
    socket.on("message_updated", onMessageUpdated);
    return () => {
      socket.off("new_message", onNew);
      socket.off("group_message_seen", onGroupMessageSeen);
      socket.off("messages_read", onMessagesRead);
      socket.off("message_updated", onMessageUpdated);
    };
  }, [socket, chatId, currentUserId, markAsRead, isGroupChat]);

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

  /** Thu hồi (Unsend) — mode everyone, mọi người thấy placeholder */
  const handleUnsendMessage = useCallback(
    (message) => {
      if (!socket?.connected || !message?._id || message.pending) return;
      socket.emit("delete_message", { messageId: String(message._id), mode: "everyone" });
    },
    [socket]
  );

  /** Xóa ở phía tôi (Remove) — mode self, thêm hiddenFor trên server */
  const handleRemoveForMe = useCallback(
    (message) => {
      if (!socket?.connected || !message?._id || message.pending) return;
      socket.emit("delete_message", { messageId: String(message._id), mode: "self" });
    },
    [socket]
  );

  const emitChatMessage = ({ content = "", fileUrl = "", fileType = "", fileName = "" }) => {
    const tempId = `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const meId = String(currentUserId);
    const replySnap = replyTarget ? { ...replyTarget } : null;
    const senderProfile = user
      ? {
          _id: meId,
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          email: user.email || "",
          avatar: user.avatar || ""
        }
      : meId;
    const optimistic = {
      _id: tempId,
      tempId,
      sender: senderProfile,
      senderId: meId,
      receiver: isGroupChat ? "" : chatId,
      groupId: isGroupChat ? chatId : "",
      content,
      fileUrl,
      fileType,
      fileName,
      isRead: false,
      seenBy: [],
      isRecalled: false,
      hiddenFor: [],
      replyTo: replySnap,
      replyToId: replySnap?._id || "",
      senderName: isGroupChat ? displayUserName(user) : "",
      createdAt: new Date().toISOString(),
      pending: true
    };

    setMessages((prev) => [...prev, optimistic]);
    socket.emit("send_message", {
      ...(isGroupChat ? { groupId: chatId } : { receiverId: chatId }),
      content,
      fileUrl,
      fileType,
      fileName,
      tempId,
      ...(replySnap?._id && !String(replySnap._id).startsWith("t-") ? { replyToId: replySnap._id } : {})
    });
  };

  const send = async () => {
    const text = draft.trim();
    const queue = attachments.filter((item) => item.status === "queued" || item.status === "error");

    if ((!text && queue.length === 0) || sending || !socket?.connected || !chatId || !currentUserId) return;

    setSending(true);
    setDraft("");
    const hadReply = Boolean(replyTarget);

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
      if (hadReply) setReplyTarget(null);
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
      if (isSystemMessage(m)) continue;
      if (isMessageMine(m, me) && !m.isRecalled && !m.pending) return String(m._id);
    }
    return null;
  }, [visibleMessages, currentUserId]);

  const groupSeenAvatarMap = useMemo(() => {
    if (!isGroupChat) return new Map();
    return buildGroupSeenAvatarMap(visibleMessages, currentUserId, memberMap);
  }, [visibleMessages, currentUserId, isGroupChat, memberMap]);

  const onlineUserSet = useMemo(
    () => (onlineUsers instanceof Set ? onlineUsers : new Set(Array.isArray(onlineUsers) ? onlineUsers.map(String) : [])),
    [onlineUsers]
  );
  useEffect(() => {
    setDraft("");
    setSending(false);
    setAttachments((prev) => {
      prev.forEach(revokePreview);
      return [];
    });
  }, [chatId]);

  useEffect(
    () => () => {
      attachmentsRef.current.forEach(revokePreview);
    },
    []
  );

  if (!chatId || (!isGroupChat && !friend) || (isGroupChat && !activeGroup)) {
    return (
      <div className="relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-primary/8 bg-gradient-to-br from-accent via-light to-accent/90 p-6 shadow-inner">
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_top_right,rgba(0,191,165,0.12),transparent_50%)]" />
        <div className="relative flex h-full flex-col items-center justify-center text-center">
          <div className="mb-5 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl bg-primary text-light shadow-lg shadow-primary/25 ring-4 ring-secondary/20 transition-transform duration-300 hover:scale-105">
            <MessageCircle size={34} strokeWidth={1.75} />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-primary md:text-2xl">
            {isGroupChat ? "Chọn một nhóm để bắt đầu trò chuyện" : "Chọn một người bạn để bắt đầu trò chuyện"}
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-primary/8 bg-gradient-to-br from-accent via-light to-accent/90 shadow-inner">
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_top_right,rgba(0,191,165,0.08),transparent_55%)]" />

      {/* Khung chat chính — thu hẹp khi Sidebar thông tin (Messenger) mở bên phải */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="relative z-10 flex shrink-0 items-center gap-3 border-b border-primary/10 bg-light/95 px-4 py-3 backdrop-blur-sm md:px-5">
          {isGroupChat ? (
            <GroupAvatar group={activeGroup} size="md" className="ring-2 ring-[#00BFA5]/25" />
          ) : (
            <UserAvatar user={friend} size="md" className="ring-2 ring-secondary/25" alt="" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-[#003B44]">{chatTitle}</p>
            <p className="truncate text-xs text-[#003B44]/50">{chatSubtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => setInfoSidebarOpen((v) => !v)}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
              infoSidebarOpen
                ? "bg-[#00BFA5] text-[#003B44] shadow-md"
                : "bg-[#003B44]/8 text-[#003B44] hover:bg-[#003B44]/12"
            }`}
            aria-label={infoSidebarOpen ? "Ẩn thông tin cuộc trò chuyện" : "Xem thông tin cuộc trò chuyện"}
            aria-pressed={infoSidebarOpen}
          >
            <Info size={20} strokeWidth={2} />
          </button>
        </header>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5">
          {loadingHistory ? (
            <div className="flex justify-center py-10 text-primary/45">
              <Loader2 className="animate-spin" size={22} />
            </div>
          ) : visibleMessages.length === 0 ? (
            <p className="py-8 text-center text-sm text-primary/45">Chưa có tin nhắn nào</p>
          ) : (
            visibleMessages.map((m, index) => {
              const previousMessage = index > 0 ? visibleMessages[index - 1] : null;
              const nextMessage = index < visibleMessages.length - 1 ? visibleMessages[index + 1] : null;

              /*
               * Tin nhắn hệ thống (messageType === 'system'): hiển thị giữa khung chat,
               * không avatar / bong bóng / menu xóa-trả lời — do server tạo khi có sự kiện nhóm.
               */
              if (isSystemMessage(m)) {
                const currentDate = new Date(m.createdAt);
                const previousDate = previousMessage ? new Date(previousMessage.createdAt) : null;
                const hasValidCurrentDate = !Number.isNaN(currentDate.getTime());
                const hasValidPreviousDate = previousDate && !Number.isNaN(previousDate.getTime());
                const isFirstMessage = index === 0;
                const isNewDay =
                  hasValidCurrentDate && hasValidPreviousDate
                    ? !isSameDate(currentDate, previousDate)
                    : false;
                const isOverThirtyMinutes =
                  hasValidCurrentDate && hasValidPreviousDate
                    ? currentDate.getTime() - previousDate.getTime() > 30 * 60 * 1000
                    : false;
                const shouldShowTimestampSeparator = isFirstMessage || isNewDay || isOverThirtyMinutes;
                const separatorText = formatVietnameseChatTime(m.createdAt);

                return (
                  <div key={String(m._id)} className="my-5 scroll-mt-4">
                    {shouldShowTimestampSeparator && separatorText ? (
                      <div className="mb-4 text-center text-[11px] text-primary/40">{separatorText}</div>
                    ) : null}
                    <div className="flex justify-center px-2">
                      <p className="max-w-[min(100%,320px)] text-center text-xs leading-relaxed text-gray-400">
                        {m.content}
                      </p>
                    </div>
                  </div>
                );
              }

              const isMine = isMessageMine(m, currentUserId);

              // So sánh prevMessage / nextMessage để biết tin đứng đầu hay cuối nhóm gom
              const { isFirstInGroup, isLastInGroup } = getMessageGroupPosition(
                m,
                previousMessage,
                nextMessage
              );

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
              const avatarUser = resolveMessageAvatar(m, isMine, {
                user,
                friend,
                memberMap,
                currentUserId,
                isGroupChat
              });
              const peerUser = avatarUser;
              // Tên gọi (từ cuối họ tên) — chỉ hiện ở tin đầu nhóm, không phải tin của mình
              const senderLabel =
                !isMine && isGroupChat && isFirstInGroup
                  ? groupBubbleSenderName(m, peerUser)
                  : null;

              // mt-0.5 trong cùng nhóm; mt-4 khi bắt đầu nhóm mới (khác người gửi / > 30 phút)
              const groupSpacingClass = isFirstInGroup && index > 0 ? "mt-4" : !isFirstInGroup ? "mt-0.5" : "";

              return (
                <div
                  key={String(m._id)}
                  ref={(el) => {
                    if (el) messageRefs.current[String(m._id)] = el;
                  }}
                  className={`w-full scroll-mt-4 transition-[box-shadow] duration-300 ${groupSpacingClass}`}
                >
                  {shouldShowTimestampSeparator && separatorText ? (
                    <div className="my-4 text-center text-[11px] text-primary/40">{separatorText}</div>
                  ) : null}

                  <div
                    className={`group/message-row group flex w-full ${isMine ? "justify-end" : "justify-start"}`}
                    data-message-row-root
                  >
                    <MessageRow
                      message={m}
                      isMine={isMine}
                      isFirstInGroup={isFirstInGroup}
                      isLastInGroup={isLastInGroup}
                      hoverTime={hoverTime}
                      onOpenImage={setLightboxUrl}
                      avatarUser={avatarUser}
                      senderLabel={senderLabel}
                      isGroupChat={isGroupChat}
                      readReceiptUser={!isGroupChat ? friend : null}
                      onUnsend={handleUnsendMessage}
                      onRemoveForMe={handleRemoveForMe}
                      onReply={handleReplyToMessage}
                      onScrollToReply={scrollToMessage}
                      currentUserId={currentUserId}
                      friend={friend}
                      memberMap={memberMap}
                      showSeenReceipt={
                        !isGroupChat &&
                        isMine &&
                        lastMyMessageId === String(m._id) &&
                        Boolean(m.isRead) &&
                        !m.pending
                      }
                      groupSeenViewers={
                        isGroupChat && isMine ? groupSeenAvatarMap.get(String(m._id)) || [] : []
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

      {/*
        Sidebar thông tin bên phải (Minimalism):
        - Icon Info bật/tắt; rộng ~340px, transition-all.
        - Nhóm: avatar tròn, đổi ảnh, Đổi tên qua RenameGroupModal (không dùng window.prompt).
        - 1-1: avatar + họ tên căn trên (justify-start, pt-10); kích thước đồng bộ với nhóm.
      */}
      <aside
        className={`relative z-20 flex shrink-0 flex-col overflow-hidden border-l border-[#003B44]/8 bg-light/98 backdrop-blur-md transition-all duration-300 ease-out ${
          infoSidebarOpen ? "w-[min(100%,340px)] opacity-100" : "w-0 opacity-0 pointer-events-none border-l-0"
        }`}
        aria-hidden={!infoSidebarOpen}
      >
        <div className="flex h-full w-[min(100vw,340px)] flex-col overflow-y-auto rounded-l-2xl">
          {isGroupChat ? (
            <>
              <input
                ref={groupAvatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleGroupAvatarChange}
              />
              <div className="flex flex-col items-center border-b border-[#003B44]/8 px-6 pb-8 pt-10 text-center">
                <div className="mb-4">
                  <GroupAvatar group={activeGroup} size="lg" className="ring-3 ring-[#00BFA5]/15" />
                </div>
                <h3 className="max-w-full truncate text-lg font-bold tracking-tight text-[#003B44]">
                  {chatTitle}
                </h3>
                <p className="mt-1.5 text-xs text-[#003B44]/45">{chatSubtitle}</p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={handleGroupAvatarPick}
                    disabled={updatingGroup}
                    className="inline-flex items-center gap-2 rounded-full border border-[#003B44]/10 bg-white px-4 py-2.5 text-xs font-medium text-[#003B44] shadow-sm transition hover:bg-[#003B44]/5 disabled:opacity-50"
                  >
                    {updatingGroup ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} className="text-[#00BFA5]" />}
                    Thay đổi ảnh
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRenameModal(true)}
                    disabled={updatingGroup}
                    className="inline-flex items-center gap-2 rounded-full border border-[#003B44]/10 bg-white px-4 py-2.5 text-xs font-medium text-[#003B44] shadow-sm transition hover:bg-[#003B44]/5 disabled:opacity-50"
                  >
                    <Edit2 size={14} className="text-[#00BFA5]" />
                    Đổi tên
                  </button>
                </div>
              </div>

              <ChatMediaGallerySection
                chatId={chatId}
                isGroupChat
                messages={visibleMessages}
                onOpenImage={setLightboxUrl}
              />

              <div className="border-b border-[#003B44]/8 py-2">
                <button
                  type="button"
                  onClick={() => setMembersAccordionOpen((v) => !v)}
                  className="flex w-full items-center justify-between px-6 py-4 text-left text-sm font-semibold text-[#003B44]"
                >
                  <span>Thành viên</span>
                  <ChevronDown
                    size={18}
                    className={`text-[#00BFA5] transition-transform duration-200 ${membersAccordionOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {membersAccordionOpen ? (
                  <div className="space-y-3 px-4 pb-6">
                    <button
                      type="button"
                      onClick={() => setShowAddMembersModal(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-[#00BFA5]/40 bg-[#00BFA5]/[0.04] py-3 text-sm font-medium text-[#003B44] transition hover:bg-[#00BFA5]/10"
                    >
                      <UserPlus size={16} className="text-[#00BFA5]" />
                      Thêm người
                    </button>
                    <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
                      {(activeGroup?.members || []).map((member) => {
                        const mid = String(member._id || member.id);
                        const isCreator = mid === groupCreatorId;
                        const isOnline = onlineUserSet.has(mid);
                        return (
                          <li
                            key={mid}
                            className="flex items-center gap-4 rounded-2xl px-3 py-3 transition hover:bg-[#003B44]/[0.04]"
                          >
                            <div className="relative shrink-0">
                              <UserAvatar user={member} size="sm" alt="" />
                              {isOnline ? (
                                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-light bg-[#00BFA5]" />
                              ) : null}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium leading-snug text-[#003B44]">
                                {memberFullName(member)}
                              </p>
                              {isCreator ? (
                                <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-[#00BFA5]/90">
                                  Người tạo nhóm
                                </p>
                              ) : null}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </div>

              <div className="mt-auto px-6 py-8">
                <button
                  type="button"
                  onClick={() => setShowLeaveConfirmModal(true)}
                  disabled={leavingGroup}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-medium text-gray-500 transition hover:bg-[#003B44]/5 hover:text-[#003B44] disabled:opacity-50"
                >
                  {leavingGroup ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                  Rời khỏi nhóm
                </button>
              </div>
            </>
          ) : (
            /* Chat 1-1: avatar + tên căn trên; kích thước đồng bộ với khối tiêu đề nhóm */
            <>
              <div className="flex flex-col items-center justify-start border-b border-[#003B44]/8 px-6 pb-6 pt-10 text-center">
                <UserAvatar user={friend} size="lg" className="!h-20 !w-20 rounded-full ring-3 ring-[#00BFA5]/15" alt="" />
                <h3 className="mt-4 max-w-full truncate text-lg font-bold tracking-tight text-[#003B44]">
                  {personFullName(friend)}
                </h3>
              </div>
              <ChatMediaGallerySection
                chatId={chatId}
                isGroupChat={false}
                messages={visibleMessages}
                onOpenImage={setLightboxUrl}
              />
            </>
          )}
        </div>
      </aside>

      {isGroupChat ? (
        <>
          <RenameGroupModal
            open={showRenameModal}
            initialName={activeGroup?.name || ""}
            onClose={() => setShowRenameModal(false)}
            onConfirm={handleConfirmRenameGroup}
            submitting={updatingGroup}
          />
          <AddGroupMembersModal
            open={showAddMembersModal}
            onClose={() => setShowAddMembersModal(false)}
            groupId={chatId}
            existingMemberIds={(activeGroup?.members || []).map((m) => String(m._id || m.id))}
            onAdded={publishGroupUpdate}
          />
          <LeaveGroupConfirmModal
            open={showLeaveConfirmModal}
            onClose={() => setShowLeaveConfirmModal(false)}
            onConfirm={handleConfirmLeaveGroup}
            submitting={leavingGroup}
          />
        </>
      ) : null}
    </div>
  );
}

export default ChatWindow;
