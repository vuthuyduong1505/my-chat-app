const express = require("express");
const mongoose = require("mongoose");
const Group = require("../models/Group");
const Message = require("../models/Message");
const User = require("../models/User");
const cloudinary = require("../config/cloudinary");
const authMiddleware = require("../middleware/authMiddleware");
const { uploadAvatar } = require("../middleware/uploadMiddleware");
const { normalizeMessagePayload, REPLY_TO_POPULATE } = require("../utils/messagePayload");
const { notifyMembersAddedToGroup, notifyGroupUpdated } = require("../socket");
const {
  createGroupSystemMessage,
  formatUserName,
  resolveUser
} = require("../utils/systemGroupMessage");
const { classifyConversationMedia, fetchGroupMedia } = require("../utils/conversationMedia");

const router = express.Router();

const memberFields = "firstName lastName email avatar";

/** Chuẩn hóa nhóm trả về client; hỗ trợ bản ghi cũ còn trường admin */
function normalizeGroupDoc(g) {
  const creatorRaw = g.creator || g.admin;
  const creatorId = creatorRaw
    ? String(creatorRaw._id || creatorRaw.id || creatorRaw)
    : "";
  return {
    _id: g._id,
    name: g.name,
    avatar: g.avatar || "",
    creator: creatorRaw && typeof creatorRaw === "object" ? creatorRaw : creatorId,
    creatorId,
    members: g.members || [],
    memberCount: (g.members || []).length,
    createdAt: g.createdAt,
    updatedAt: g.updatedAt
  };
}

async function loadPopulatedGroup(groupId) {
  return Group.findById(groupId)
    .populate("creator", memberFields)
    .populate("members", memberFields)
    .lean();
}

async function assertGroupMember(groupId, userId) {
  const group = await Group.findById(groupId).lean();
  if (!group) return null;
  const isMember = (group.members || []).some((id) => String(id) === String(userId));
  return isMember ? group : null;
}

router.get("/", authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;
    const groups = await Group.find({ members: me })
      .sort({ updatedAt: -1 })
      .populate("creator", memberFields)
      .populate("members", memberFields)
      .lean();

    const normalized = groups.map((g) => normalizeGroupDoc(g));

    return res.status(200).json({ groups: normalized });
  } catch {
    return res.status(500).json({ message: "Lỗi máy chủ khi tải danh sách nhóm." });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;
    const name = (req.body.name || "").trim();
    const memberIds = Array.isArray(req.body.memberIds) ? req.body.memberIds : [];
    const avatar = (req.body.avatar || "").trim();

    if (!name) {
      return res.status(400).json({ message: "Tên nhóm không được để trống." });
    }

    const user = await User.findById(me).select("friends").lean();
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng." });

    const friendIds = new Set((user.friends || []).map(String));
    const validMembers = memberIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .filter((id) => friendIds.has(String(id)) && String(id) !== String(me));

    const members = [me, ...validMembers];

    const group = await Group.create({
      name,
      avatar,
      creator: me,
      members
    });

    const populated = await loadPopulatedGroup(group._id);
    const creatorUser =
      populated.members?.find((m) => String(m._id) === String(me)) || populated.creator;

    const actor = creatorUser || (await resolveUser(me));
    await createGroupSystemMessage({
      groupId: group._id,
      actorId: me,
      content: `${formatUserName(actor)} đã tạo nhóm`
    });

    await notifyMembersAddedToGroup(populated, creatorUser);

    return res.status(201).json({
      message: "Tạo nhóm thành công.",
      group: normalizeGroupDoc(populated)
    });
  } catch {
    return res.status(500).json({ message: "Lỗi máy chủ khi tạo nhóm." });
  }
});

/** Cập nhật tên / ảnh nhóm — mọi thành viên đều được phép */
router.put("/:groupId", authMiddleware, uploadAvatar.single("avatar"), async (req, res) => {
  try {
    const me = req.user.id;
    const { groupId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: "ID nhóm không hợp lệ." });
    }

    const group = await assertGroupMember(groupId, me);
    if (!group) {
      return res.status(403).json({ message: "Bạn không thuộc nhóm này." });
    }

    const updates = {};
    const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
    if (name) {
      if (name.length > 120) {
        return res.status(400).json({ message: "Tên nhóm quá dài." });
      }
      updates.name = name;
    }

    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "chat-app/group-avatars", resource_type: "image" },
          (error, result) => {
            if (error) return reject(error);
            return resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });
      updates.avatar = uploadResult.secure_url;
    } else if (typeof req.body.avatar === "string" && req.body.avatar.trim()) {
      updates.avatar = req.body.avatar.trim();
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: "Không có thông tin để cập nhật." });
    }

    const actor = await resolveUser(me);

    await Group.findByIdAndUpdate(groupId, updates, { new: true });
    const populated = await loadPopulatedGroup(groupId);
    const normalized = normalizeGroupDoc(populated);

    if (updates.name) {
      await createGroupSystemMessage({
        groupId,
        actorId: me,
        content: `${formatUserName(actor)} đã đổi tên nhóm thành ${updates.name}`
      });
    }

    await notifyGroupUpdated(populated);

    return res.status(200).json({ message: "Cập nhật nhóm thành công.", group: normalized });
  } catch {
    return res.status(500).json({ message: "Lỗi máy chủ khi cập nhật nhóm." });
  }
});

/** Thêm thành viên từ danh sách bạn bè */
router.post("/:groupId/add-members", authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;
    const { groupId } = req.params;
    const memberIds = Array.isArray(req.body.memberIds) ? req.body.memberIds : [];

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: "ID nhóm không hợp lệ." });
    }

    const group = await assertGroupMember(groupId, me);
    if (!group) {
      return res.status(403).json({ message: "Bạn không thuộc nhóm này." });
    }

    if (!memberIds.length) {
      return res.status(400).json({ message: "Chọn ít nhất một thành viên." });
    }

    const user = await User.findById(me).select("friends").lean();
    if (!user) return res.status(404).json({ message: "Không tìm thấy người dùng." });

    const friendIds = new Set((user.friends || []).map(String));
    const existing = new Set((group.members || []).map(String));
    const toAdd = memberIds
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .filter((id) => friendIds.has(String(id)))
      .filter((id) => !existing.has(String(id)));

    if (!toAdd.length) {
      return res.status(400).json({ message: "Không có thành viên mới hợp lệ để thêm." });
    }

    const actor = await resolveUser(me);
    const addedUsers = await User.find({ _id: { $in: toAdd } }).select(memberFields).lean();

    await Group.findByIdAndUpdate(groupId, { $addToSet: { members: { $each: toAdd } } });

    const populated = await loadPopulatedGroup(groupId);
    const addedByUser =
      populated.members?.find((m) => String(m._id) === String(me)) || populated.creator;

    for (const addedUser of addedUsers) {
      await createGroupSystemMessage({
        groupId,
        actorId: me,
        content: `${formatUserName(actor)} đã thêm ${formatUserName(addedUser)} vào nhóm`
      });
    }

    await notifyMembersAddedToGroup(populated, addedByUser);
    await notifyGroupUpdated(populated);

    return res.status(200).json({
      message: "Đã thêm thành viên.",
      group: normalizeGroupDoc(populated),
      addedIds: toAdd.map(String)
    });
  } catch {
    return res.status(500).json({ message: "Lỗi máy chủ khi thêm thành viên." });
  }
});

/** Rời nhóm — xóa user hiện tại khỏi members */
router.post("/:groupId/leave", authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;
    const { groupId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: "ID nhóm không hợp lệ." });
    }

    const group = await assertGroupMember(groupId, me);
    if (!group) {
      return res.status(403).json({ message: "Bạn không thuộc nhóm này." });
    }

    const remaining = (group.members || []).filter((id) => String(id) !== String(me));

    if (!remaining.length) {
      await Group.findByIdAndDelete(groupId);
      return res.status(200).json({ message: "Đã rời nhóm.", deleted: true, groupId: String(groupId) });
    }

    const actor = await resolveUser(me);
    await createGroupSystemMessage({
      groupId,
      actorId: me,
      content: `${formatUserName(actor)} đã rời khỏi nhóm`
    });

    await Group.findByIdAndUpdate(groupId, { $pull: { members: me } });
    const populated = await loadPopulatedGroup(groupId);
    if (populated) {
      await notifyGroupUpdated(populated);
    }

    return res.status(200).json({
      message: "Đã rời nhóm.",
      deleted: false,
      groupId: String(groupId)
    });
  } catch {
    return res.status(500).json({ message: "Lỗi máy chủ khi rời nhóm." });
  }
});

/**
 * GET /api/groups/:id/media — ảnh & file nhóm (cùng logic lọc fileType như chat 1-1).
 */
router.get("/:groupId/media", authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;
    const { groupId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: "ID nhóm không hợp lệ." });
    }

    const group = await assertGroupMember(groupId, me);
    if (!group) {
      return res.status(403).json({ message: "Bạn không thuộc nhóm này." });
    }

    const rows = await fetchGroupMedia(me, groupId);
    const { images, files } = classifyConversationMedia(rows);

    return res.status(200).json({ images, files });
  } catch {
    return res.status(500).json({ message: "Lỗi máy chủ khi tải file phương tiện nhóm." });
  }
});

router.get("/:groupId/messages", authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;
    const { groupId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: "ID nhóm không hợp lệ." });
    }

    const group = await Group.findById(groupId)
      .populate("creator", memberFields)
      .populate("members", memberFields)
      .lean();
    const isMember = group && (group.members || []).some((m) => String(m._id || m) === String(me));
    if (!isMember) {
      return res.status(403).json({ message: "Bạn không thuộc nhóm này." });
    }

    const messages = await Message.find({ groupId })
      .sort({ createdAt: 1 })
      .populate("sender", memberFields)
      .populate("seenBy", memberFields)
      .populate(REPLY_TO_POPULATE)
      .lean();

    const normalized = messages
      .filter((m) => !(m.hiddenFor || []).some((id) => String(id) === String(me)))
      .map((m) => normalizeMessagePayload(m));

    return res.status(200).json({
      messages: normalized,
      group: normalizeGroupDoc(group)
    });
  } catch {
    return res.status(500).json({ message: "Lỗi máy chủ khi tải tin nhắn nhóm." });
  }
});

module.exports = router;
