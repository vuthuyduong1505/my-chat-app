import toast from "react-hot-toast";
import { getCallingName, getCallingNameFromFullName, getDisplayName } from "../../utils/displayName";

export const RECALLED_TEXT = "Tin nhắn đã bị thu hồi";
export const REACTION_EMOJIS = ["❤️", "👍", "😂", "😮", "😢", "🔥"];
export const MESSAGE_GROUP_GAP_MS = 30 * 60 * 1000;

export function getStartOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 (CN) -> 6 (T7)
  const distanceToMonday = day === 0 ? 6 : day - 1;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - distanceToMonday);
  return d;
}

export function isSameDate(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatVietnameseChatTime(iso) {
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

export function formatHoverTime(iso) {
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
export async function downloadFile(url, fileName) {
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

export function createQueuedAttachment(file) {
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

export function getSeenByUserId(entry) {
  if (!entry) return "";
  if (typeof entry === "object") return String(entry._id || entry.id || "");
  return String(entry);
}

/**
 * Messenger-style: mỗi người chỉ hiện avatar ở tin cuối cùng họ đã đọc.
 */
export function buildGroupSeenAvatarMap(messages, currentUserId, memberMap) {
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

export function mergeSeenByEntry(list, user) {
  const uid = getSeenByUserId(user);
  if (!uid) return list || [];
  const current = list || [];
  if (current.some((e) => getSeenByUserId(e) === uid)) return current;
  return [...current, user];
}

export function displayUserName(person) {
  if (!person) return "Thành viên";
  const name = `${person.firstName || ""} ${person.lastName || ""}`.trim();
  return name || person.email || "Thành viên";
}

/** ID người gửi — sender có thể là string hoặc object đã populate */
export function getSenderId(m) {
  if (m?.senderId) return String(m.senderId);
  const raw = m?.sender;
  if (!raw) return "";
  if (typeof raw === "object") return String(raw._id || raw.id || "");
  return String(raw);
}

export function isMessageMine(m, currentUserId) {
  if (!m || !currentUserId) return false;
  const raw = m.sender;
  const senderKey =
    raw && typeof raw === "object" ? raw._id || raw.id : raw ?? m.senderId;
  return String(senderKey ?? "") === String(currentUserId);
}

/** Gộp profile từ sender populate + fallback (friend / user) để Avatar luôn có dữ liệu */
export function mergeUserProfile(primary, fallback) {
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
export function resolveMessageAvatar(m, isMine, { user, friend, memberMap, currentUserId, isGroupChat }) {
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

export function resolvePeerUser(m, { user, friend, memberMap, currentUserId, isGroupChat }) {
  return resolveMessageAvatar(m, isMessageMine(m, currentUserId), {
    user,
    friend,
    memberMap,
    currentUserId,
    isGroupChat
  });
}

export function replyContentLabel(replyTo) {
  if (!replyTo) return "";
  if (replyTo.isRecalled) return "Tin nhắn đã bị thu hồi";
  if (replyTo.fileType === "image") return "Hình ảnh";
  if (replyTo.fileType === "file") return "Tệp tin";
  const text = (replyTo.content || "").trim();
  if (!text) return "Tin nhắn";
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
}

export function replyAuthorName(replyTo, currentUserId, { friend, memberMap, nicknames = [] } = {}) {
  if (!replyTo) return "Thành viên";
  const sid =
    replyTo.senderId ||
    (typeof replyTo.sender === "object"
      ? String(replyTo.sender._id || replyTo.sender.id || "")
      : String(replyTo.sender || ""));
  if (sid && String(sid) === String(currentUserId)) return "Bạn";

  if (nicknames?.length && sid) {
    const entry = nicknames.find((n) => String(n.user) === String(sid));
    if (entry?.nickname) return entry.nickname;
  }

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

export function buildReplySnapshot(message) {
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

/** Tên gọi phía trên bong bóng chat nhóm — chỉ lấy từ cuối của họ tên đầy đủ */
export function groupBubbleSenderName(m, peerUser, nicknames = []) {
  const sid = getSenderId(m);
  if (sid) {
    let fallbackUser = null;
    if (m.sender && typeof m.sender === "object") fallbackUser = m.sender;
    else if (peerUser) fallbackUser = peerUser;

    // First try nickname
    if (nicknames?.length) {
      const entry = nicknames.find((n) => String(n.user) === String(sid));
      if (entry?.nickname) return entry.nickname;
    }

    if (fallbackUser) return getCallingName(fallbackUser) || "Thành viên";
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

export function getMessageTimeGapMs(laterMessage, earlierMessage) {
  const later = new Date(laterMessage?.createdAt).getTime();
  const earlier = new Date(earlierMessage?.createdAt).getTime();
  if (Number.isNaN(later) || Number.isNaN(earlier)) return Infinity;
  return later - earlier;
}

export function isSameMessageSender(messageA, messageB) {
  if (!messageA || !messageB) return false;
  const idA = getSenderId(messageA);
  const idB = getSenderId(messageB);
  return Boolean(idA && idB && idA === idB);
}

export function isSystemMessage(message) {
  return message?.messageType === "system";
}

export function areMessagesInSameGroup(earlierMessage, laterMessage) {
  if (isSystemMessage(earlierMessage) || isSystemMessage(laterMessage)) return false;
  if (!isSameMessageSender(earlierMessage, laterMessage)) return false;
  return getMessageTimeGapMs(laterMessage, earlierMessage) <= MESSAGE_GROUP_GAP_MS;
}

export function getMessageGroupPosition(message, prevMessage, nextMessage) {
  const isFirstInGroup =
    !prevMessage || !areMessagesInSameGroup(prevMessage, message);
  const isLastInGroup =
    !nextMessage || !areMessagesInSameGroup(message, nextMessage);
  return { isFirstInGroup, isLastInGroup };
}

export function getGroupedBubbleRadius(isMine, isFirstInGroup, isLastInGroup) {
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

export function extractSharedMediaFromMessages(messageList) {
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
