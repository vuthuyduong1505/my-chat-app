const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const Message = require("./models/Message");
const User = require("./models/User");

function chatRoomId(userIdA, userIdB) {
  const a = String(userIdA);
  const b = String(userIdB);
  return a < b ? `chat:${a}:${b}` : `chat:${b}:${a}`;
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

    socket.on("send_message", async ({ receiverId, content, tempId }) => {
      try {
        const text = typeof content === "string" ? content.trim() : "";
        if (!receiverId || !text) return;
        if (!mongoose.Types.ObjectId.isValid(receiverId)) return;
        if (String(receiverId) === String(userId)) return;

        const user = await User.findById(userId).select("friends").lean();
        if (!user) return;
        const isFriend = (user.friends || []).some((id) => String(id) === String(receiverId));
        if (!isFriend) return;

        const doc = await Message.create({
          sender: userId,
          receiver: receiverId,
          content: text
        });

        const payload = {
          _id: doc._id,
          sender: String(doc.sender),
          receiver: String(doc.receiver),
          content: doc.content,
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          ...(tempId ? { tempId } : {})
        };

        const room = chatRoomId(userId, receiverId);
        io.to(room).emit("new_message", payload);
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
