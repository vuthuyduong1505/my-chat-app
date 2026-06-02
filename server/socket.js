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

/** Tải sender + replyTo (self-ref) + reactions.user đã populate để socket/API đồng bộ */
async function emitMessagePayload(doc, extra = {}) {
  const populated = await Message.findById(doc._id)
    .populate("sender", SENDER_PROFILE_FIELDS)
    .populate("seenBy", SENDER_PROFILE_FIELDS)
    .populate(REPLY_TO_POPULATE)
    .populate("reactions.user", SENDER_PROFILE_FIELDS)
    .lean();
  return { ...normalizeMessagePayload(populated || doc), ...extra };
}

/** Phát new_message tới phòng nhóm + phòng từng thành viên (tin thường & tin hệ thống). */
async function broadcastGroupMessage(doc, extra = {}) {
  const io = ioInstance;
  if (!io || !doc?.groupId) return null;

  const payload = await emitMessagePayload(doc, extra);
  const gid = String(doc.groupId);

  io.to(groupRoomId(gid)).emit("new_message", payload);
  const group = await Group.findById(gid).select("members").lean();
  (group?.members || []).forEach((memberId) => {
    io.to(userRoomId(memberId)).emit("new_message", payload);
  });

  return payload;
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
/**
 * Phát group_updated tới mọi thành viên (phòng user + phòng nhóm)
 * để Sidebar thông tin và danh sách đoạn chat cập nhật realtime.
 */
async function notifyGroupUpdated(group) {
  const io = ioInstance;
  if (!io || !group) return;

  const groupId = String(group._id || group.id);
  const membersRaw = group.members || [];
  const memberIds = membersRaw.map((m) =>
    m && typeof m === "object" && (m._id || m.id) ? String(m._id || m.id) : String(m)
  );

  const creatorRaw = group.creator || group.admin;
  const creatorId = creatorRaw
    ? String(creatorRaw._id || creatorRaw.id || creatorRaw)
    : "";

  const payload = {
    group: {
      _id: groupId,
      name: group.name,
      avatar: group.avatar || "",
      creator: creatorRaw,
      creatorId,
      members: membersRaw,
      memberCount: memberIds.length
    }
  };

  memberIds.forEach((memberId) => {
    io.to(userRoomId(memberId)).emit("group_updated", payload);
  });
  io.to(groupRoomId(groupId)).emit("group_updated", payload);
}

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

          const messageType =
            attachmentType === "image" ? "image" : attachmentUrl ? "file" : "text";

          const doc = await Message.create({
            sender: userId,
            groupId,
            content: text,
            fileUrl: attachmentUrl,
            fileType: attachmentType,
            fileName: attachmentName,
            messageType,
            ...(validReplyTo ? { replyTo: validReplyTo } : {})
          });

          await broadcastGroupMessage(doc, tempId ? { tempId } : {});
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
     * - DM: mark_as_read({ friendId }) → isRead=true, phát messages_read.
     * - Nhóm: mark_as_read({ groupId }) → thêm reader vào seenBy mọi tin chưa xem,
     *   phát group_message_seen kèm messageIds + avatar người đọc.
     */
    socket.on("mark_as_read", async ({ friendId, groupId }) => {
      try {
        const readerId = userId;

        if (groupId) {
          if (!mongoose.Types.ObjectId.isValid(groupId)) return;

          const group = await Group.findById(groupId).select("members").lean();
          if (!group) return;
          const isMember = (group.members || []).some((id) => String(id) === String(readerId));
          if (!isMember) return;

          const unread = await Message.find({
            groupId,
            sender: { $ne: readerId },
            isRecalled: false,
            seenBy: { $ne: readerId },
            hiddenFor: { $nin: [readerId] }
          })
            .select("_id")
            .lean();

          if (!unread.length) return;

          await Message.updateMany(
            { _id: { $in: unread.map((m) => m._id) } },
            { $addToSet: { seenBy: readerId } }
          );

          const reader = await User.findById(readerId).select(SENDER_PROFILE_FIELDS).lean();
          const seenPayload = {
            groupId: String(groupId),
            userId: String(readerId),
            user: reader
              ? {
                  _id: String(reader._id),
                  firstName: reader.firstName || "",
                  lastName: reader.lastName || "",
                  email: reader.email || "",
                  avatar: reader.avatar || ""
                }
              : { _id: String(readerId) },
            messageIds: unread.map((m) => String(m._id))
          };

          io.to(groupRoomId(groupId)).emit("group_message_seen", seenPayload);
          (group.members || []).forEach((memberId) => {
            io.to(userRoomId(memberId)).emit("group_message_seen", seenPayload);
          });
          return;
        }

        if (!friendId || !mongoose.Types.ObjectId.isValid(friendId)) return;

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

    /**
     * Thả cảm xúc vào tin nhắn (Message Reactions) — Toggle logic:
     *
     * 1. Client gửi sự kiện send_reaction kèm { messageId, emoji }.
     * 2. Server tìm tin nhắn trong DB, kiểm tra người dùng có quyền (thuộc cuộc trò chuyện).
     * 3. Logic Toggle (Bật/Tắt cảm xúc):
     *    a. Tìm trong mảng reactions xem user đã thả cảm xúc chưa.
     *    b. Nếu ĐÃ THẢ cùng emoji đó → XÓA cảm xúc (bỏ thả).
     *    c. Nếu ĐÃ THẢ emoji khác → CẬP NHẬT thành emoji mới.
     *    d. Nếu CHƯA THẢ gì → THÊM MỚI { user, emoji } vào mảng.
     * 4. Lưu lại vào DB, populate thông tin user trong reactions.
     * 5. Phát sự kiện message_reaction_updated kèm { messageId, reactions } mới nhất
     *    tới tất cả thành viên trong phòng chat (nhóm hoặc 1-1).
     */
    socket.on("send_reaction", async ({ messageId, emoji }) => {
      try {
        // Kiểm tra dữ liệu đầu vào hợp lệ
        if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) return;
        if (!emoji || typeof emoji !== "string") return;

        const doc = await Message.findById(messageId);
        if (!doc || doc.isRecalled) return;

        // Kiểm tra quyền truy cập: user phải thuộc cuộc trò chuyện (nhóm hoặc 1-1)
        const isGroupMessage = Boolean(doc.groupId);
        const isParticipant = isGroupMessage
          ? await Group.exists({ _id: doc.groupId, members: userId })
          : String(doc.sender) === String(userId) || String(doc.receiver) === String(userId);
        if (!isParticipant) return;

        // Khởi tạo mảng reactions nếu chưa có
        if (!doc.reactions) doc.reactions = [];

        /**
         * Toggle logic cho mảng reactions:
         * - existingIndex: vị trí trong mảng nếu user đã thả cảm xúc trước đó.
         * - Nếu tìm thấy (existingIndex >= 0):
         *   + Cùng emoji → xóa (splice) = bỏ thả.
         *   + Khác emoji → cập nhật emoji mới tại vị trí đó.
         * - Nếu không tìm thấy → push { user, emoji } mới vào cuối mảng.
         */
        const existingIndex = doc.reactions.findIndex(
          (r) => String(r.user) === String(userId)
        );

        if (existingIndex >= 0) {
          // User đã có reaction — kiểm tra có cùng emoji không
          if (doc.reactions[existingIndex].emoji === emoji) {
            // Cùng emoji → xóa cảm xúc (toggle off / bỏ thả)
            doc.reactions.splice(existingIndex, 1);
          } else {
            // Khác emoji → cập nhật sang emoji mới
            doc.reactions[existingIndex].emoji = emoji;
          }
        } else {
          // User chưa thả cảm xúc nào → thêm mới
          doc.reactions.push({ user: userId, emoji });
        }

        await doc.save();

        // Populate thông tin user trong reactions để client hiển thị (avatar, tên...)
        const updated = await Message.findById(messageId)
          .populate("reactions.user", SENDER_PROFILE_FIELDS)
          .lean();

        // Chuẩn bị payload gửi cho client
        const reactionPayload = {
          messageId: String(messageId),
          reactions: (updated?.reactions || []).map((r) => ({
            user: r.user,
            emoji: r.emoji
          }))
        };

        // Phát sự kiện tới tất cả thành viên trong phòng chat
        if (isGroupMessage) {
          // Nhóm: phát vào phòng nhóm + phòng cá nhân từng thành viên
          io.to(groupRoomId(doc.groupId)).emit("message_reaction_updated", reactionPayload);
          const group = await Group.findById(doc.groupId).select("members").lean();
          (group?.members || []).forEach((memberId) => {
            io.to(userRoomId(memberId)).emit("message_reaction_updated", reactionPayload);
          });
        } else {
          // Chat 1-1: phát vào phòng cá nhân cả 2 bên
          io.to(userRoomId(doc.sender)).emit("message_reaction_updated", reactionPayload);
          io.to(userRoomId(doc.receiver)).emit("message_reaction_updated", reactionPayload);
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

function emitToUser(userId, event, payload) {
  if (ioInstance) {
    ioInstance.to(`user:${String(userId)}`).emit(event, payload);
  }
}

function emitToGroup(groupId, event, payload) {
  if (ioInstance) {
    ioInstance.to(`group:${String(groupId)}`).emit(event, payload);
  }
}

module.exports = {
  attachSocketIO,
  notifyMembersAddedToGroup,
  notifyGroupUpdated,
  broadcastGroupMessage,
  emitToUser,
  emitToGroup
};
