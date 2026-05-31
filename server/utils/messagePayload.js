const SENDER_PROFILE_FIELDS = "firstName lastName email avatar";

/** Populate lồng nhau: tin trả lời → tin gốc → người gửi tin gốc */
const REPLY_TO_POPULATE = {
  path: "replyTo",
  populate: { path: "sender", select: SENDER_PROFILE_FIELDS }
};

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

function normalizeReplyTo(rawReply) {
  if (!rawReply) return null;

  if (typeof rawReply === "object" && (rawReply._id || rawReply.id)) {
    const { senderId, sender } = buildSenderFields(rawReply.sender);
    const senderName = typeof sender === "object" ? senderDisplayName(sender) : "";

    return {
      _id: String(rawReply._id || rawReply.id),
      content: rawReply.content || "",
      fileUrl: rawReply.fileUrl || "",
      fileType: rawReply.fileType || "",
      fileName: rawReply.fileName || "",
      isRecalled: Boolean(rawReply.isRecalled),
      sender,
      senderId,
      ...(senderName ? { senderName } : {})
    };
  }

  return { _id: String(rawReply) };
}

function normalizeSeenBy(rawList) {
  return (rawList || []).map((entry) => {
    if (entry && typeof entry === "object" && (entry._id || entry.id)) {
      const id = String(entry._id || entry.id);
      return {
        _id: id,
        firstName: entry.firstName || "",
        lastName: entry.lastName || "",
        email: entry.email || "",
        avatar: entry.avatar || ""
      };
    }
    return { _id: String(entry) };
  });
}

function normalizeMessagePayload(doc) {
  if (!doc) return null;

  const { senderId, sender } = buildSenderFields(doc.sender);
  const senderName = typeof sender === "object" ? senderDisplayName(sender) : "";
  const replyTo = normalizeReplyTo(doc.replyTo);

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
    seenBy: normalizeSeenBy(doc.seenBy),
    isRecalled: Boolean(doc.isRecalled),
    hiddenFor: (doc.hiddenFor || []).map(String),
    replyTo,
    replyToId: replyTo?._id || (doc.replyTo ? String(doc.replyTo) : ""),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    ...(senderName ? { senderName } : {})
  };
}

module.exports = {
  normalizeMessagePayload,
  normalizeSeenBy,
  SENDER_PROFILE_FIELDS,
  REPLY_TO_POPULATE,
  senderDisplayName,
  normalizeReplyTo
};
