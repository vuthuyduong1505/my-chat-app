const express = require("express");
const mongoose = require("mongoose");
const Message = require("../models/Message");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const cloudinary = require("../config/cloudinary");
const { uploadChatFile, decodeMulterFileName } = require("../middleware/uploadMiddleware");
const {
  normalizeMessagePayload,
  SENDER_PROFILE_FIELDS,
  REPLY_TO_POPULATE
} = require("../utils/messagePayload");
const {
  classifyConversationMedia,
  fetchDmMedia,
  assertFriendship
} = require("../utils/conversationMedia");

const router = express.Router();

/**
 * GET /api/chat/:id/media — ảnh & file đã chia sẻ trong chat 1-1.
 * Truy vấn tin có fileUrl, lọc theo fileType (image | file) trả về hai mảng.
 */
router.get("/:friendId/media", authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;
    const { friendId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(friendId)) {
      return res.status(400).json({ message: "ID bạn bè không hợp lệ." });
    }
    if (String(me) === String(friendId)) {
      return res.status(400).json({ message: "Không thể xem media với chính mình." });
    }

    const ok = await assertFriendship(me, friendId);
    if (!ok) {
      return res.status(403).json({ message: "Bạn không có quyền xem tài nguyên cuộc trò chuyện này." });
    }

    const rows = await fetchDmMedia(me, friendId);
    const { images, files } = classifyConversationMedia(rows);

    return res.status(200).json({ images, files });
  } catch {
    return res.status(500).json({ message: "Lỗi máy chủ khi tải file phương tiện." });
  }
});

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

    const okFriend = await assertFriendship(me, friendId);
    if (!okFriend) {
      return res.status(403).json({ message: "Bạn chỉ có thể xem tin nhắn với người trong danh sách bạn bè." });
    }

    const messages = await Message.find({
      $and: [
        {
          $or: [
            { sender: me, receiver: friendId },
            { sender: friendId, receiver: me }
          ]
        },
        { $or: [{ groupId: null }, { groupId: { $exists: false } }] }
      ]
    })
      .sort({ createdAt: 1 })
      .populate("sender", SENDER_PROFILE_FIELDS)
      .populate(REPLY_TO_POPULATE)
      .lean();

    const normalized = messages
      .filter((m) => !(m.hiddenFor || []).some((id) => String(id) === String(me)))
      .map((m) => normalizeMessagePayload(m));

    return res.status(200).json({ messages: normalized });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi tải lịch sử tin nhắn." });
  }
});

router.post("/upload", authMiddleware, uploadChatFile.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Vui lòng chọn file để tải lên." });
    }

    const fileName = decodeMulterFileName(req.file.originalname);
    const isImage = req.file.mimetype.startsWith("image/");
    const folder = isImage ? "chat-app/messages/images" : "chat-app/messages/files";

    const uploadResult = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: isImage ? "image" : "raw",
          ...(isImage
            ? {
                transformation: [{ quality: "auto:good", fetch_format: "auto" }]
              }
            : {})
        },
        (error, result) => {
          if (error) return reject(error);
          return resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    return res.status(200).json({
      fileUrl: uploadResult.secure_url,
      fileType: isImage ? "image" : "file",
      fileName
    });
  } catch (error) {
    return res.status(500).json({ message: "Tải file lên thất bại." });
  }
});

router.use((error, req, res, next) => {
  if (error?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "Kích thước file tối đa là 15MB." });
  }
  if (error?.message === "File không hợp lệ.") {
    return res.status(400).json({ message: error.message });
  }
  return next(error);
});

module.exports = router;
