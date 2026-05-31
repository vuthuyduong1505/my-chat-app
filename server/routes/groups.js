const express = require("express");
const mongoose = require("mongoose");
const Group = require("../models/Group");
const Message = require("../models/Message");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const { normalizeMessagePayload, REPLY_TO_POPULATE } = require("../utils/messagePayload");
const { notifyMembersAddedToGroup } = require("../socket");

const router = express.Router();

const memberFields = "firstName lastName email avatar";

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
      .populate("admin", memberFields)
      .populate("members", memberFields)
      .lean();

    const normalized = groups.map((g) => ({
      _id: g._id,
      name: g.name,
      avatar: g.avatar || "",
      admin: g.admin,
      members: g.members || [],
      memberCount: (g.members || []).length,
      createdAt: g.createdAt,
      updatedAt: g.updatedAt
    }));

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
      admin: me,
      members
    });

    const populated = await Group.findById(group._id)
      .populate("admin", memberFields)
      .populate("members", memberFields)
      .lean();

    await notifyMembersAddedToGroup(populated, populated.admin);

    return res.status(201).json({
      message: "Tạo nhóm thành công.",
      group: {
        _id: populated._id,
        name: populated.name,
        avatar: populated.avatar || "",
        admin: populated.admin,
        members: populated.members || [],
        memberCount: (populated.members || []).length
      }
    });
  } catch {
    return res.status(500).json({ message: "Lỗi máy chủ khi tạo nhóm." });
  }
});

router.get("/:groupId/messages", authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;
    const { groupId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ message: "ID nhóm không hợp lệ." });
    }

    const group = await Group.findById(groupId).populate("members", memberFields).lean();
    const isMember = group && (group.members || []).some((id) => String(id._id || id) === String(me));
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

    return res.status(200).json({ messages: normalized, group });
  } catch {
    return res.status(500).json({ message: "Lỗi máy chủ khi tải tin nhắn nhóm." });
  }
});

module.exports = router;
