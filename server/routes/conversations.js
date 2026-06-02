const express = require("express");
const mongoose = require("mongoose");
const Message = require("../models/Message");
const User = require("../models/User");
const Group = require("../models/Group");
const Conversation = require("../models/Conversation");
const authMiddleware = require("../middleware/authMiddleware");
const { getCallingName } = require("../utils/callingName");
const { createGroupSystemMessage, createDmSystemMessage, resolveUser, formatUserName } = require("../utils/systemGroupMessage");
const { emitToUser, emitToGroup } = require("../socket");

const router = express.Router();
const memberFields = "firstName lastName email avatar";

function senderIdFromDoc(msg) {
  if (!msg?.sender) return "";
  if (typeof msg.sender === "object") return String(msg.sender._id || msg.sender.id || "");
  return String(msg.sender);
}

function peerDisplayFirstName(peer, friendsById) {
  if (!peer) return "Thành viên";
  const id = senderIdFromDoc({ sender: peer }) || String(peer._id || peer.id || "");
  const friend = friendsById.get(id);
  if (friend?.firstName) return friend.firstName;
  if (peer.firstName) return peer.firstName;
  return "Thành viên";
}

function buildLastMessagePreview(msg, me, friendsById, groupMembersBySender) {
  if (!msg) {
    return { preview: "Chưa có tin nhắn", senderId: "", createdAt: null };
  }

  const sid = senderIdFromDoc(msg);
  const isMe = sid === String(me);
  let label = "Bạn";

  if (!isMe) {
    const friend = friendsById.get(sid);
    if (friend) label = getCallingName(friend) || "Thành viên";
    else if (groupMembersBySender?.get(sid)) {
      label = getCallingName(groupMembersBySender.get(sid)) || "Thành viên";
    } else label = "Thành viên";
  }

  if (msg.messageType === "system") {
    const text = (msg.content || "").trim();
    const snippet = text.length > 48 ? `${text.slice(0, 48)}…` : text || "Hoạt động nhóm";
    return { preview: snippet, senderId: sid, createdAt: msg.createdAt };
  }

  if (msg.isRecalled) {
    return { preview: `${label}: Tin nhắn đã bị thu hồi`, senderId: sid, createdAt: msg.createdAt };
  }

  if (msg.fileType === "image") {
    return { preview: `${label}: đã gửi 1 ảnh`, senderId: sid, createdAt: msg.createdAt };
  }
  if (msg.fileType === "file") {
    return { preview: `${label}: đã gửi tệp đính kèm`, senderId: sid, createdAt: msg.createdAt };
  }

  const text = (msg.content || "").trim();
  const snippet = text.length > 48 ? `${text.slice(0, 48)}…` : text || "Tin nhắn mới";
  return { preview: `${label}: ${snippet}`, senderId: sid, createdAt: msg.createdAt };
}

async function updateNicknameHelper({ me, id, targetUserId, nickname }) {
  if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw { status: 400, message: "ID người dùng không hợp lệ." };
  }

  const actor = await resolveUser(me);
  const targetUser = await resolveUser(targetUserId);

  if (!targetUser) {
    throw { status: 404, message: "Không tìm thấy người được đổi biệt danh." };
  }

  const trimmedNickname = (nickname || "").trim();
  let resultNicknames = [];

  // 1. Kiểm tra xem id có phải là groupId không
  let group = null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    group = await Group.findById(id);
  }

  if (group) {
    const isMember = (group.members || []).some(m => String(m) === String(me));
    if (!isMember) {
      throw { status: 403, message: "Bạn không thuộc nhóm này." };
    }

    if (!group.nicknames) group.nicknames = [];
    const idx = group.nicknames.findIndex(n => String(n.user) === String(targetUserId));

    if (trimmedNickname) {
      if (idx >= 0) group.nicknames[idx].nickname = trimmedNickname;
      else group.nicknames.push({ user: targetUserId, nickname: trimmedNickname });
    } else {
      if (idx >= 0) group.nicknames.splice(idx, 1);
    }

    await group.save();
    resultNicknames = group.nicknames;

    // System message & emit
    const actionText = trimmedNickname 
      ? `${formatUserName(actor)} đã đặt biệt danh cho ${formatUserName(targetUser)} là ${trimmedNickname}`
      : `${formatUserName(actor)} đã xóa biệt danh của ${formatUserName(targetUser)}`;
      
    await createGroupSystemMessage({ groupId: id, actorId: me, content: actionText });
    emitToGroup(id, "nickname_updated", { groupId: id, nicknames: resultNicknames });
  } else {
    // 2. Logic DM
    let peerId = id;
    let conv = null;

    if (mongoose.Types.ObjectId.isValid(id)) {
      conv = await Conversation.findById(id);
      if (conv) {
        peerId = String(conv.participants.find(p => String(p) !== String(me)) || targetUserId);
      }
    }

    if (!conv) {
      const participants = [me, peerId].sort();
      conv = await Conversation.findOne({ participants: { $all: participants, $size: 2 } });
      if (!conv) {
        if (mongoose.Types.ObjectId.isValid(peerId)) {
          conv = new Conversation({ participants, nicknames: [] });
        } else {
          throw { status: 400, message: "ID cuộc trò chuyện hoặc ID đối tác không hợp lệ." };
        }
      }
    }

    if (!conv.nicknames) conv.nicknames = [];
    const idx = conv.nicknames.findIndex(n => String(n.user) === String(targetUserId));

    if (trimmedNickname) {
      if (idx >= 0) conv.nicknames[idx].nickname = trimmedNickname;
      else conv.nicknames.push({ user: targetUserId, nickname: trimmedNickname });
    } else {
      if (idx >= 0) conv.nicknames.splice(idx, 1);
    }

    await conv.save();
    resultNicknames = conv.nicknames;

    // System message & emit
    const actionText = trimmedNickname 
      ? `${formatUserName(actor)} đã đặt biệt danh cho ${formatUserName(targetUser)} là ${trimmedNickname}`
      : `${formatUserName(actor)} đã xóa biệt danh của ${formatUserName(targetUser)}`;
      
    await createDmSystemMessage({ senderId: me, receiverId: peerId, content: actionText });
    
    const payloadMe = { peerId, nicknames: resultNicknames };
    const payloadPeer = { peerId: me, nicknames: resultNicknames };
    emitToUser(me, "nickname_updated", payloadMe);
    emitToUser(peerId, "nickname_updated", payloadPeer);
  }

  return resultNicknames;
}

router.put("/:id/nickname", authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;
    const { id } = req.params;
    const { targetUserId, nickname, newNickname } = req.body;
    
    const targetNickname = nickname !== undefined ? nickname : newNickname;
    const resultNicknames = await updateNicknameHelper({ me, id, targetUserId, nickname: targetNickname });

    return res.status(200).json({ 
      message: "Cập nhật biệt danh thành công.", 
      nicknames: resultNicknames 
    });
  } catch (error) {
    console.error("PUT /conversations/:id/nickname error:", error);
    const status = error.status || 500;
    const message = error.message || "Lỗi máy chủ khi cập nhật biệt danh.";
    return res.status(status).json({ message });
  }
});

router.post("/nickname", authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;
    const { targetUserId, newNickname, nickname, groupId } = req.body;
    const id = groupId || targetUserId;

    const targetNickname = nickname !== undefined ? nickname : newNickname;
    const resultNicknames = await updateNicknameHelper({ me, id, targetUserId, nickname: targetNickname });

    return res.status(200).json({ 
      message: "Cập nhật biệt danh thành công.", 
      nicknames: resultNicknames 
    });
  } catch (error) {
    console.error("POST /conversations/nickname error:", error);
    const status = error.status || 500;
    const message = error.message || "Lỗi máy chủ khi cập nhật biệt danh.";
    return res.status(status).json({ message });
  }
});

router.get("/", authMiddleware, async (req, res) => {
  try {
    const me = req.user.id;
    const meOid = new mongoose.Types.ObjectId(me);

    const userDoc = await User.findById(me).populate("friends", memberFields).lean();
    if (!userDoc) return res.status(404).json({ message: "Không tìm thấy người dùng." });

    const friends = userDoc.friends || [];
    const friendsById = new Map(friends.map((f) => [String(f._id), f]));
    const friendOids = friends.map((f) => f._id);

    const groups = await Group.find({ members: me })
      .populate({ path: "creator", select: memberFields, strictPopulate: false })
      .populate("members", memberFields)
      .sort({ updatedAt: -1 })
      .lean();

    const groupOids = groups.map((g) => g._id);

    const [dmAgg, groupAgg] = await Promise.all([
      friendOids.length
        ? Message.aggregate([
            {
              $match: {
                $and: [
                  { $or: [{ groupId: null }, { groupId: { $exists: false } }] },
                  {
                    $or: [
                      { sender: meOid, receiver: { $in: friendOids } },
                      { sender: { $in: friendOids }, receiver: meOid }
                    ]
                  },
                  { hiddenFor: { $nin: [meOid] } }
                ]
              }
            },
            { $sort: { createdAt: -1 } },
            {
              $addFields: {
                peerId: {
                  $cond: [{ $eq: ["$sender", meOid] }, "$receiver", "$sender"]
                }
              }
            },
            {
              $group: {
                _id: "$peerId",
                lastMessage: { $first: "$$ROOT" }
              }
            }
          ])
        : [],
      groupOids.length
        ? Message.aggregate([
            {
              $match: {
                groupId: { $in: groupOids },
                hiddenFor: { $nin: [meOid] }
              }
            },
            { $sort: { createdAt: -1 } },
            {
              $group: {
                _id: "$groupId",
                lastMessage: { $first: "$$ROOT" }
              }
            }
          ])
        : []
    ]);

    const dmLastMap = new Map(dmAgg.map((row) => [String(row._id), row.lastMessage]));
    const groupLastMap = new Map(groupAgg.map((row) => [String(row._id), row.lastMessage]));

    const convs = await Conversation.find({ participants: meOid }).lean();
    const dmNicknamesMap = new Map();
    for (const c of convs) {
      const peerId = String(c.participants.find(p => String(p) !== String(meOid)));
      dmNicknamesMap.set(peerId, c.nicknames || []);
    }

    const conversations = [];

    const addedDmIds = new Set();

    for (const friend of friends) {
      const id = String(friend._id);
      addedDmIds.add(id);
      const last = dmLastMap.get(id);
      const lastMeta = buildLastMessagePreview(last, me, friendsById);
      conversations.push({
        type: "dm",
        id,
        title: `${friend.firstName || ""} ${friend.lastName || ""}`.trim() || friend.email || "Người dùng",
        peer: friend,
        group: null,
        nicknames: dmNicknamesMap.get(id) || [],
        lastMessage: lastMeta,
        lastActivityAt: last?.createdAt || null
      });
    }

    /** Khôi phục đoạn chat DM còn tin nhắn dù peer không còn trong friends (tránh “mất” lịch sử) */
    const orphanPeerIds = [...dmLastMap.keys()].filter((id) => !addedDmIds.has(id));
    if (orphanPeerIds.length) {
      const orphanPeers = await User.find({ _id: { $in: orphanPeerIds } })
        .select(memberFields)
        .lean();
      for (const peer of orphanPeers) {
        const id = String(peer._id);
        const last = dmLastMap.get(id);
        friendsById.set(id, peer);
        conversations.push({
          type: "dm",
          id,
          title: `${peer.firstName || ""} ${peer.lastName || ""}`.trim() || peer.email || "Người dùng",
          peer,
          group: null,
          nicknames: dmNicknamesMap.get(id) || [],
          lastMessage: buildLastMessagePreview(last, me, friendsById),
          lastActivityAt: last?.createdAt || null
        });
      }
    }

    for (const g of groups) {
      const id = String(g._id);
      const last = groupLastMap.get(id);
      const membersMap = new Map((g.members || []).map((m) => [String(m._id || m.id), m]));
      const lastMeta = buildLastMessagePreview(last, me, friendsById, membersMap);
      conversations.push({
        type: "group",
        id,
        title: g.name || "Nhóm chat",
        peer: null,
        group: {
          _id: g._id,
          name: g.name,
          avatar: g.avatar || "",
          creator: g.creator || g.admin,
          creatorId: String((g.creator || g.admin)?._id || g.creator || g.admin || ""),
          members: g.members || [],
          memberCount: (g.members || []).length,
          nicknames: g.nicknames || []
        },
        nicknames: g.nicknames || [],
        lastMessage: lastMeta,
        lastActivityAt: last?.createdAt || g.updatedAt || g.createdAt || null
      });
    }

    conversations.sort((a, b) => {
      const ta = a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0;
      const tb = b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return (a.title || "").localeCompare(b.title || "", "vi");
    });

    return res.status(200).json({ conversations });
  } catch (error) {
    console.error("GET /conversations error:", error);
    return res.status(500).json({ message: "Lỗi máy chủ khi tải danh sách đoạn chat." });
  }
});

module.exports = router;
