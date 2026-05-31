const SENDER_PROFILE_FIELDS = "firstName lastName email avatar";

function buildSenderFields(rawSender) {
  if (!rawSender) {
    return { senderId: "", sender: "" };
  }

  if (typeof rawSender === "object" && (rawSender._id || rawSender.id)) {
    const senderId = String(rawSender._id || rawSender.id);
    return {
      senderId,
      sender: {
        _id: senderId,
        firstName: rawSender.firstName || "",
        lastName: rawSender.lastName || "",
        email: rawSender.email || "",
        avatar: rawSender.avatar || ""
      }
    };
  }

  const senderId = String(rawSender);
  return { senderId, sender: senderId };
}

function senderDisplayName(sender) {
  if (!sender || typeof sender !== "object") return "";
  return `${sender.firstName || ""} ${sender.lastName || ""}`.trim() || sender.email || "";
}

function normalizeMessagePayload(doc) {
  if (!doc) return null;

  const { senderId, sender } = buildSenderFields(doc.sender);
  const senderName = typeof sender === "object" ? senderDisplayName(sender) : "";

  return {
    _id: doc._id,
    sender,
    senderId,
    receiver: doc.receiver ? String(doc.receiver) : "",
    groupId: doc.groupId ? String(doc.groupId) : "",
    content: doc.content || "",
    fileUrl: doc.fileUrl || "",
    fileType: doc.fileType || "",
    fileName: doc.fileName || "",
    isRead: Boolean(doc.isRead),
    isRecalled: Boolean(doc.isRecalled),
    hiddenFor: (doc.hiddenFor || []).map(String),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    ...(senderName ? { senderName } : {})
  };
}

module.exports = {
  normalizeMessagePayload,
  SENDER_PROFILE_FIELDS,
  senderDisplayName
};
