function normalizeMessagePayload(doc) {
  if (!doc) return null;
  return {
    _id: doc._id,
    sender: String(doc.sender),
    receiver: String(doc.receiver),
    content: doc.content || "",
    fileUrl: doc.fileUrl || "",
    fileType: doc.fileType || "",
    fileName: doc.fileName || "",
    isRead: Boolean(doc.isRead),
    isRecalled: Boolean(doc.isRecalled),
    hiddenFor: (doc.hiddenFor || []).map(String),
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt
  };
}

module.exports = { normalizeMessagePayload };
