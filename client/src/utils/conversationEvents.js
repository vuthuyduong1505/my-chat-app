/** Lọc trùng sự kiện new_message (server có thể phát qua group + user room). */
const seenMessageKeys = new Set();
const MAX_SEEN = 400;

export function conversationMessageKey(msg) {
  if (!msg) return "";
  if (msg._id && !String(msg._id).startsWith("t-")) return `id:${msg._id}`;
  if (msg.tempId) return `temp:${msg.tempId}`;
  return `ts:${msg.createdAt || ""}:${msg.senderId || msg.sender}:${msg.content || ""}`;
}

export function isDuplicateConversationMessage(msg) {
  const key = conversationMessageKey(msg);
  if (!key) return false;
  if (seenMessageKeys.has(key)) return true;
  seenMessageKeys.add(key);
  if (seenMessageKeys.size > MAX_SEEN) {
    const first = seenMessageKeys.values().next().value;
    seenMessageKeys.delete(first);
  }
  return false;
}

export function dispatchConversationActivity(msg) {
  window.dispatchEvent(new CustomEvent("conversation-activity", { detail: msg }));
}
