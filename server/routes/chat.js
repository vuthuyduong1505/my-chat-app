const express = require("express");
const mongoose = require("mongoose");
const Message = require("../models/Message");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

async function assertFriendship(currentUserId, friendId) {
  const user = await User.findById(currentUserId).select("friends").lean();
  if (!user) return false;
  return (user.friends || []).some((id) => String(id) === String(friendId));
}

router.get("/:friendId", authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;
    const { friendId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(friendId)) {
      return res.status(400).json({ message: "ID bạn bè không hợp lệ." });
    }
    if (String(me) === String(friendId)) {
      return res.status(400).json({ message: "Không thể xem cuộc trò chuyện với chính mình." });
    }

    const ok = await assertFriendship(me, friendId);
    if (!ok) {
      return res.status(403).json({ message: "Bạn chỉ có thể xem tin nhắn với người trong danh sách bạn bè." });
    }

    const messages = await Message.find({
      $or: [
        { sender: me, receiver: friendId },
        { sender: friendId, receiver: me }
      ]
    })
      .sort({ createdAt: 1 })
      .lean();

    const normalized = messages.map((m) => ({
      _id: m._id,
      sender: String(m.sender),
      receiver: String(m.receiver),
      content: m.content,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt
    }));

    return res.status(200).json({ messages: normalized });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi tải lịch sử tin nhắn." });
  }
});

module.exports = router;
