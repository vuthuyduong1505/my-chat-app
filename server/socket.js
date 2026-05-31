const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const User = require("./models/User");
const Group = require("./models/Group");
const Message = require("./models/Message");
const {
  normalizeMessagePayload,
  SENDER_PROFILE_FIELDS,
  REPLY_TO_POPULATE
} = require("./utils/messagePayload");

/** Tải sender + replyTo (self-ref) đã populate để socket/API đồng bộ */
async function emitMessagePayload(doc, extra = {}) {
  const populated = await Message.findById(doc._id)
    .populate("sender", SENDER_PROFILE_FIELDS)
    .populate(REPLY_TO_POPULATE)
    .lean();
  return { ...normalizeMessagePayload(populated || doc), ...extra };
}

async function resolveValidReplyToId(replyToId, { userId, groupId, receiverId }) {
  if (!replyToId || !mongoose.Types.ObjectId.isValid(replyToId)) return null;

  const parent = await Message.findById(replyToId).lean();
  if (!parent) return null;

  if (groupId) {
    if (!parent.groupId || String(parent.groupId) !== String(groupId)) return null;
    const group = await Group.findById(groupId).select("members").lean();
    if (!group) return null;
    const isMember = (group.members || []).some((id) => String(id) === String(userId));
    return isMember ? replyToId : null;
  }

  if (parent.groupId || !receiverId) return null;
  const me = String(userId);
  const fid = String(receiverId);
  const inThread =
    (String(parent.sender) === me && String(parent.receiver) === fid) ||
    (String(parent.sender) === fid && String(parent.receiver) === me);
  return inThread ? replyToId : null;
}

const RECALLED_PLACEHOLDER = "Tin nhắn đã bị thu hồi";

function chatRoomId(userIdA, userIdB) {
  const a = String(userIdA);
  const b = String(userIdB);
  return a < b ? `chat:${a}:${b}` : `chat:${b}:${a}`;
}

function userRoomId(userId) {
  return `user:${String(userId)}`;
}

function groupRoomId(groupId) {
  return `group:${String(groupId)}`;
}

async function joinAllGroupRooms(socket, userId) {
  const groups = await Group.find({ members: userId }).select("_id").lean();
  groups.forEach((g) => socket.join(groupRoomId(g._id)));
}

/** Tham chiếu io toàn cục — dùng khi tạo nhóm (HTTP) cần phát socket */
let ioInstance = null;

/**
 * Join Room tự động khi có nhóm mới (báo cáo / đồng bộ realtime):
 * 1. HTTP POST /api/groups tạo nhóm xong → gọi hàm này.
 * 2. Với từng memberId: emit added_to_group vào phòng user:{memberId}
 *    (mọi tab đang đăng nhập của thành viên đều nhận).
 * 3. Đồng thời fetchSockets trong user:{memberId} và socket.join(group:{groupId})
 *    — thành viên online được ghép phòng nhóm ngay trên server.
 * 4. Client nhận added_to_group → emit join_group_chat (lớp bảo đảm thêm).
 * Kết quả: nhận new_message nhóm realtime không cần F5 / reconnect.
 */
async function notifyMembersAddedToGroup(group, addedByUser) {
  const io = ioInstance;
  if (!io || !group) return;

  const groupId = String(group._id || group.id);
  const addedByName =
    `${addedByUser?.firstName || ""} ${addedByUser?.lastName || ""}`.trim() ||
    addedByUser?.email ||
    "Ai đó";

  const membersRaw = group.members || [];
  const memberIds = membersRaw.map((m) =>
    m && typeof m === "object" && (m._id || m.id) ? String(m._id || m.id) : String(m)
  );

  const groupPayload = {
    _id: groupId,
    name: group.name,
    avatar: group.avatar || "",
    memberCount: memberIds.length,
    members: membersRaw
  };

  const payload = {
    group: groupPayload,
    addedBy: {
      _id: String(addedByUser?._id || addedByUser?.id || ""),
      firstName: addedByUser?.firstName || "",
      lastName: addedByUser?.lastName || "",
      email: addedByUser?.email || ""
    },
    addedByName
  };

  await Promise.all(
    memberIds.map(async (memberId) => {
      io.to(userRoomId(memberId)).emit("added_to_group", payload);
      try {
        const sockets = await io.in(userRoomId(memberId)).fetchSockets();
        sockets.forEach((s) => s.join(groupRoomId(groupId)));
      } catch {
        /* ignore */
      }
    })
  );
}

/** userId -> Set<socket.id> */
function createSocketRegistry() {
  const userIdToSockets = new Map();

  const register = (userId, socketId) => {
    const key = String(userId);
    if (!userIdToSockets.has(key)) userIdToSockets.set(key, new Set());
    userIdToSockets.get(key).add(socketId);
  };

  const unregister = (userId, socketId) => {
    const key = String(userId);
    const set = userIdToSockets.get(key);
    if (!set) return;
    set.delete(socketId);
    if (set.size === 0) userIdToSockets.delete(key);
  };

  const getOnlineUserIds = () => Array.from(userIdToSockets.keys());

  return { register, unregister, userIdToSockets, getOnlineUserIds };
}

function attachSocketIO(httpServer) {
  const parsedOrigins = process.env.CLIENT_ORIGIN?.split(",").map((s) => s.trim()).filter(Boolean);
  const corsOrigin = parsedOrigins?.length ? parsedOrigins : true;
  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ["GET", "POST"],
      credentials: true
    }
  });
  ioInstance = io;

  const { register, unregister, getOnlineUserIds } = createSocketRegistry();

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error("Unauthorized"));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = String(decoded.id);
      return next();
    } catch {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.userId;
    register(userId, socket.id);

    // Mỗi user luôn ở phòng riêng để nhận tin nhắn realtime kể cả khi chưa mở khung chat với người gửi
    socket.join(userRoomId(userId));
    joinAllGroupRooms(socket, userId).catch(() => {});

    socket.emit("online_users", getOnlineUserIds());
    socket.broadcast.emit("user_online", { userId });

    socket.on("join_chat", async ({ friendId }) => {
      try {
        if (!friendId || !mongoose.Types.ObjectId.isValid(friendId)) return;
        const user = await User.findById(userId).select("friends").lean();
        if (!user) return;
        const isFriend = (user.friends || []).some((id) => String(id) === String(friendId));
        if (!isFriend) return;
        socket.join(chatRoomId(userId, friendId));
      } catch {
        /* ignore */
      }
    });

    socket.on("leave_chat", ({ friendId }) => {
      if (!friendId) return;
      socket.leave(chatRoomId(userId, friendId));
    });

    socket.on("refresh_group_rooms", () => {
      joinAllGroupRooms(socket, userId).catch(() => {});
    });

    socket.on("join_group_chat", async ({ groupId }) => {
      try {
        if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) return;
        const group = await Group.findById(groupId).select("members").lean();
        if (!group) return;
        const isMember = (group.members || []).some((id) => String(id) === String(userId));
        if (!isMember) return;
        socket.join(groupRoomId(groupId));
      } catch {
        /* ignore */
      }
    });

    socket.on("leave_group_chat", ({ groupId }) => {
      if (!groupId) return;
      socket.leave(groupRoomId(groupId));
    });

    socket.on(
      "send_message",
      async ({ receiverId, groupId, content, tempId, fileUrl, fileType, fileName, replyToId }) => {
      try {
        const text = typeof content === "string" ? content.trim() : "";
        const attachmentUrl = typeof fileUrl === "string" ? fileUrl.trim() : "";
        const attachmentType = fileType === "image" ? "image" : attachmentUrl ? "file" : "";
        const attachmentName = typeof fileName === "string" ? fileName.trim() : "";

        if (!text && !attachmentUrl) return;

        const validReplyTo = await resolveValidReplyToId(replyToId, {
          userId,
          groupId,
          receiverId
        });

        /**
         * Điều phối tin nhắn NHÓM qua Socket.io:
         * 1. Client gửi send_message kèm groupId (không cần receiverId).
         * 2. Server kiểm tra người gửi thuộc members của nhóm.
         * 3. Lưu Message với groupId; mỗi thành viên đã join phòng group:{groupId} khi kết nối.
         * 4. io.to(groupRoomId) phát new_message — mọi socket trong phòng nhận realtime.
         */
        if (groupId) {
          if (!mongoose.Types.ObjectId.isValid(groupId)) return;
          const group = await Group.findById(groupId).select("members").lean();
          if (!group) return;
          const isMember = (group.members || []).some((id) => String(id) === String(userId));
          if (!isMember) return;

          const doc = await Message.create({
            sender: userId,
            groupId,
            content: text,
            fileUrl: attachmentUrl,
            fileType: attachmentType,
            fileName: attachmentName,
            ...(validReplyTo ? { replyTo: validReplyTo } : {})
          });

          const payload = await emitMessagePayload(doc, tempId ? { tempId } : {});

          io.to(groupRoomId(groupId)).emit("new_message", payload);
          // Phát thêm vào phòng user:{memberId} để mọi thành viên online cập nhật Sidebar/badge
          // (kể cả khi chưa join kịp phòng group). Client lọc trùng theo _id/tempId.
          (group.members || []).forEach((memberId) => {
            io.to(userRoomId(memberId)).emit("new_message", payload);
          });
          return;
        }

        if (!receiverId || (!text && !attachmentUrl)) return;
        if (!mongoose.Types.ObjectId.isValid(receiverId)) return;
        if (String(receiverId) === String(userId)) return;

        const user = await User.findById(userId).select("friends").lean();
        if (!user) return;
        const isFriend = (user.friends || []).some((id) => String(id) === String(receiverId));
        if (!isFriend) return;

        const doc = await Message.create({
          sender: userId,
          receiver: receiverId,
          content: text,
          fileUrl: attachmentUrl,
          fileType: attachmentType,
          fileName: attachmentName,
          ...(validReplyTo ? { replyTo: validReplyTo } : {})
        });

        const payload = await emitMessagePayload(doc, tempId ? { tempId } : {});

        // Gửi qua phòng user để người nhận luôn nhận được tin (badge, toast) dù chưa mở khung chat đó
        io.to(userRoomId(receiverId)).emit("new_message", payload);
        io.to(userRoomId(userId)).emit("new_message", payload);
      } catch {
        /* ignore */
      }
    });

    /**
     * Cơ chế "Đã xem":
     * - Người NHẬN (reader) mở khung chat hoặc đang xem chat → emit mark_as_read({ friendId: người gửi }).
     * - Server đánh dấu isRead=true cho mọi tin do friendId gửi tới reader (sender=friend, receiver=reader).
     * - Phát messages_read tới người gửi để họ hiển thị "Đã xem" dưới tin cuối cùng của mình.
     */
    socket.on("mark_as_read", async ({ friendId }) => {
      try {
        if (!friendId || !mongoose.Types.ObjectId.isValid(friendId)) return;

        const readerId = userId;
        const user = await User.findById(readerId).select("friends").lean();
        if (!user) return;
        const isFriend = (user.friends || []).some((id) => String(id) === String(friendId));
        if (!isFriend) return;

        const result = await Message.updateMany(
          {
            sender: friendId,
            receiver: readerId,
            isRead: false,
            isRecalled: false
          },
          { $set: { isRead: true } }
        );

        if (result.modifiedCount === 0) return;

        const readPayload = { readBy: String(readerId), peerId: String(friendId) };
        io.to(userRoomId(friendId)).emit("messages_read", readPayload);
        io.to(userRoomId(readerId)).emit("messages_read", readPayload);
      } catch {
        /* ignore */
      }
    });

    /**
     * Xóa / Thu hồi tin nhắn:
     * - mode "everyone" (Unsend/Thu hồi): chỉ người gửi; isRecalled → mọi người thấy placeholder qua message_updated.
     * - mode "self" (Remove): thêm userId vào hiddenFor — chỉ ẩn trên client của người xóa.
     */
    socket.on("delete_message", async ({ messageId, mode }) => {
      try {
        if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) return;
        if (!["everyone", "self"].includes(mode)) return;

        const doc = await Message.findById(messageId);
        if (!doc) return;

        const isSender = String(doc.sender) === String(userId);
        const isGroupMessage = Boolean(doc.groupId);
        const isParticipant = isGroupMessage
          ? await Group.exists({ _id: doc.groupId, members: userId })
          : String(doc.sender) === String(userId) || String(doc.receiver) === String(userId);
        if (!isParticipant) return;

        if (mode === "everyone") {
          // Thu hồi: chỉ người gửi được phép
          if (!isSender || doc.isRecalled) return;
          doc.isRecalled = true;
          doc.content = RECALLED_PLACEHOLDER;
          doc.fileUrl = "";
          doc.fileType = "";
          doc.fileName = "";
        } else {
          // Xóa phía tôi: mọi thành viên cuộc trò chuyện đều được phép (không cần là người gửi)
          const hidden = (doc.hiddenFor || []).map(String);
          if (!hidden.includes(String(userId))) {
            doc.hiddenFor.push(userId);
          }
        }

        await doc.save();
        const payload = await emitMessagePayload(doc);
        if (doc.groupId) {
          io.to(groupRoomId(doc.groupId)).emit("message_updated", payload);
          const group = await Group.findById(doc.groupId).select("members").lean();
          (group?.members || []).forEach((memberId) => {
            io.to(userRoomId(memberId)).emit("message_updated", payload);
          });
        } else {
          io.to(userRoomId(doc.sender)).emit("message_updated", payload);
          io.to(userRoomId(doc.receiver)).emit("message_updated", payload);
        }
      } catch {
        /* ignore */
      }
    });

    socket.on("disconnect", () => {
      unregister(userId, socket.id);
      if (!getOnlineUserIds().includes(String(userId))) {
        io.emit("user_offline", { userId });
      }
    });
  });

  return io;
}

module.exports = { attachSocketIO, notifyMembersAddedToGroup };
