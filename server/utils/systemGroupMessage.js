const Message = require("../models/Message");
const User = require("../models/User");
const { broadcastGroupMessage } = require("../socket");

const memberFields = "firstName lastName email avatar";

function formatUserName(user) {
  if (!user) return "Ai đó";
  if (typeof user === "object") {
    const full = `${user.firstName || ""} ${user.lastName || ""}`.trim();
    return full || user.email || "Ai đó";
  }
  return "Ai đó";
}

async function resolveUser(userId) {
  if (!userId) return null;
  return User.findById(userId).select(memberFields).lean();
}

/**
 * Cơ chế tự động tạo tin nhắn hệ thống (nhóm):
 * 1. API nhóm (tạo / thêm thành viên / rời / đổi tên) gọi createGroupSystemMessage sau khi thao tác DB thành công.
 * 2. Lưu document Message với messageType: "system" và content mô tả sự kiện (tiếng Việt).
 * 3. broadcastGroupMessage phát sự kiện socket "new_message" vào phòng group:{id} và user:{memberId}
 *    — mọi thành viên online nhận realtime giống tin nhắn thường, không cần tải lại trang.
 * 4. Client ChatWindow nhận new_message, nếu messageType === "system" thì render dòng chữ giữa khung chat.
 */
async function createGroupSystemMessage({ groupId, actorId, content }) {
  const text = String(content || "").trim();
  if (!text || !groupId || !actorId) return null;

  const doc = await Message.create({
    sender: actorId,
    groupId,
    content: text,
    messageType: "system"
  });

  await broadcastGroupMessage(doc);
  return doc;
}

module.exports = {
  createGroupSystemMessage,
  formatUserName,
  resolveUser,
  memberFields
};
