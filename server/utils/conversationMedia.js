const mongoose = require("mongoose");
const Message = require("../models/Message");
const User = require("../models/User");
const Group = require("../models/Group");

function normalizeMediaItem(doc) {
  const fileType = doc.fileType === "image" ? "image" : "file";
  return {
    _id: String(doc._id),
    fileUrl: String(doc.fileUrl || "").trim(),
    fileType,
    fileName: doc.fileName || "",
    createdAt: doc.createdAt
  };
}

/**
 * Lọc tin nhắn có đính kèm và phân loại theo fileType:
 * - Chỉ giữ bản ghi có fileUrl khác rỗng, chưa thu hồi, không phải tin hệ thống.
 * - fileType === "image" (hoặc messageType image) → mảng images.
 * - fileType === "file" → mảng files.
 * Sắp xếp mới nhất trước (createdAt giảm dần).
 */
function classifyConversationMedia(messages) {
  const images = [];
  const files = [];

  for (const doc of messages) {
    const url = String(doc.fileUrl || "").trim();
    if (!url || doc.isRecalled || doc.messageType === "system") continue;

    const isImage = doc.fileType === "image" || doc.messageType === "image";
    const isFile = doc.fileType === "file" || doc.messageType === "file";

    if (isImage) {
      images.push(normalizeMediaItem({ ...doc, fileType: "image" }));
    } else if (isFile) {
      files.push(normalizeMediaItem({ ...doc, fileType: "file" }));
    }
  }

  const byNewest = (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  images.sort(byNewest);
  files.sort(byNewest);

  return { images, files };
}

async function fetchDmMedia(me, friendId) {
  return Message.find({
    $and: [
      {
        $or: [
          { sender: me, receiver: friendId },
          { sender: friendId, receiver: me }
        ]
      },
      { $or: [{ groupId: null }, { groupId: { $exists: false } }] },
      { fileUrl: { $exists: true, $ne: "" } },
      { isRecalled: { $ne: true } },
      { messageType: { $ne: "system" } },
      { hiddenFor: { $nin: [me] } }
    ]
  })
    .sort({ createdAt: -1 })
    .select("fileUrl fileType fileName messageType isRecalled createdAt")
    .lean();
}

async function fetchGroupMedia(me, groupId) {
  return Message.find({
    groupId,
    fileUrl: { $exists: true, $ne: "" },
    isRecalled: { $ne: true },
    messageType: { $ne: "system" },
    hiddenFor: { $nin: [me] }
  })
    .sort({ createdAt: -1 })
    .select("fileUrl fileType fileName messageType isRecalled createdAt")
    .lean();
}

async function assertGroupMember(groupId, userId) {
  const group = await Group.findById(groupId).lean();
  if (!group) return false;
  return (group.members || []).some((id) => String(id) === String(userId));
}

async function assertFriendship(currentUserId, friendId) {
  const user = await User.findById(currentUserId).select("friends").lean();
  if (!user) return false;
  return (user.friends || []).some((id) => String(id) === String(friendId));
}

module.exports = {
  classifyConversationMedia,
  fetchDmMedia,
  fetchGroupMedia,
  assertGroupMember,
  assertFriendship
};
