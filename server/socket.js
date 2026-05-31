const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const Message = require("./models/Message");
const User = require("./models/User");
const { normalizeMessagePayload } = require("./utils/messagePayload");

const RECALLED_PLACEHOLDER = "Tin nhắn đã bị thu hồi";

function chatRoomId(userIdA, userIdB) {
  const a = String(userIdA);
  const b = String(userIdB);
  return a < b ? `chat:${a}:${b}` : `chat:${b}:${a}`;
}

function userRoomId(userId) {
  return `user:${String(userId)}`;
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

    socket.on("send_message", async ({ receiverId, content, tempId, fileUrl, fileType, fileName }) => {
      try {
        const text = typeof content === "string" ? content.trim() : "";
        const attachmentUrl = typeof fileUrl === "string" ? fileUrl.trim() : "";
        const attachmentType = fileType === "image" ? "image" : attachmentUrl ? "file" : "";
        const attachmentName = typeof fileName === "string" ? fileName.trim() : "";

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
          fileName: attachmentName
        });

        const payload = {
          ...normalizeMessagePayload(doc),
          ...(tempId ? { tempId } : {})
        };

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

    socket.on("delete_message", async ({ messageId, mode }) => {
      try {
        if (!messageId || !mongoose.Types.ObjectId.isValid(messageId)) return;
        if (!["everyone", "self"].includes(mode)) return;

        const doc = await Message.findById(messageId);
        if (!doc) return;

        const isSender = String(doc.sender) === String(userId);
        const isParticipant =
          String(doc.sender) === String(userId) || String(doc.receiver) === String(userId);
        if (!isParticipant) return;

        if (mode === "everyone") {
          if (!isSender || doc.isRecalled) return;
          doc.isRecalled = true;
          doc.content = RECALLED_PLACEHOLDER;
          doc.fileUrl = "";
          doc.fileType = "";
          doc.fileName = "";
        } else {
          const hidden = (doc.hiddenFor || []).map(String);
          if (!hidden.includes(String(userId))) {
            doc.hiddenFor.push(userId);
          }
        }

        await doc.save();
        const payload = normalizeMessagePayload(doc);
        io.to(userRoomId(doc.sender)).emit("message_updated", payload);
        io.to(userRoomId(doc.receiver)).emit("message_updated", payload);
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

module.exports = { attachSocketIO };
