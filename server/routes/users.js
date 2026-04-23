const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const FriendRequest = require("../models/FriendRequest");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/discover", authMiddleware, async (req, res) => {
  try {
    const currentUserId = new mongoose.Types.ObjectId(req.user.id);
    const search = (req.query.search || "").trim();
    const currentUser = await User.findById(currentUserId).select("friends");

    if (!currentUser) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    const pendingRequests = await FriendRequest.find({
      status: "pending",
      $or: [{ sender: currentUserId }, { receiver: currentUserId }]
    }).select("sender receiver");

    const friendIds = (currentUser.friends || []).map((friendId) => String(friendId));
    const sentRequestIds = [];
    const receivedRequestIds = [];

    pendingRequests.forEach((request) => {
      if (String(request.sender) === String(currentUserId)) {
        sentRequestIds.push(String(request.receiver));
      } else if (String(request.receiver) === String(currentUserId)) {
        receivedRequestIds.push(String(request.sender));
      }
    });

    const searchMatch = search
      ? {
          $or: [
            { firstName: { $regex: search, $options: "i" } },
            { lastName: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            {
              $expr: {
                $regexMatch: {
                  input: { $concat: ["$firstName", " ", "$lastName"] },
                  regex: search,
                  options: "i"
                }
              }
            }
          ]
        }
      : {};

    const users = await User.aggregate([
      {
        $match: {
          _id: { $ne: currentUserId },
          ...searchMatch
        }
      },
      {
        $addFields: {
          mutualFriendsCount: {
            $size: {
              $setIntersection: [
                { $ifNull: ["$friends", []] },
                { $ifNull: [currentUser.friends, []] }
              ]
            }
          }
        }
      },
      {
        $project: {
          firstName: 1,
          lastName: 1,
          email: 1,
          avatar: 1,
          mutualFriendsCount: 1,
          friends: 1
        }
      },
      { $sort: { mutualFriendsCount: -1, firstName: 1, lastName: 1 } }
    ]);

    const usersWithStatus = users.map((person) => {
      const personId = String(person._id);
      let connectionStatus = "none";

      if (friendIds.includes(personId)) {
        connectionStatus = "friend";
      } else if (sentRequestIds.includes(personId)) {
        connectionStatus = "request_sent";
      } else if (receivedRequestIds.includes(personId)) {
        connectionStatus = "request_received";
      }

      return {
        _id: person._id,
        firstName: person.firstName,
        lastName: person.lastName,
        email: person.email,
        avatar: person.avatar,
        mutualFriendsCount: person.mutualFriendsCount || 0,
        connectionStatus
      };
    });

    return res.status(200).json({ users: usersWithStatus });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi lấy danh sách khám phá." });
  }
});

router.post("/friend-request/send/:id", authMiddleware, async (req, res) => {
  try {
    const senderId = req.user.id;
    const receiverId = req.params.id;

    if (String(senderId) === String(receiverId)) {
      return res.status(400).json({ message: "Bạn không thể gửi lời mời cho chính mình." });
    }

    const [sender, receiver] = await Promise.all([User.findById(senderId), User.findById(receiverId)]);
    if (!sender || !receiver) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    if (sender.friends.some((friendId) => String(friendId) === String(receiverId))) {
      return res.status(409).json({ message: "Hai bạn đã là bạn bè." });
    }

    const existing = await FriendRequest.findOne({
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId }
      ],
      status: "pending"
    });
    if (existing) {
      return res.status(409).json({ message: "Đã có lời mời kết bạn đang chờ xử lý." });
    }

    await FriendRequest.findOneAndDelete({
      sender: senderId,
      receiver: receiverId,
      status: "rejected"
    });

    const request = await FriendRequest.create({
      sender: senderId,
      receiver: receiverId,
      status: "pending"
    });

    return res.status(201).json({ message: "Gửi lời mời kết bạn thành công.", request });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({ message: "Lời mời kết bạn đã tồn tại." });
    }
    return res.status(500).json({ message: "Lỗi máy chủ khi gửi lời mời kết bạn." });
  }
});

router.get("/friend-requests/pending", authMiddleware, async (req, res) => {
  try {
    const requests = await FriendRequest.find({
      receiver: req.user.id,
      status: "pending"
    })
      .populate("sender", "firstName lastName email avatar")
      .sort({ createdAt: -1 });

    return res.status(200).json({ requests });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi tải lời mời đang chờ." });
  }
});

router.post("/friend-request/respond/:requestId", authMiddleware, async (req, res) => {
  try {
    const { action } = req.body;
    if (!["accept", "decline"].includes(action)) {
      return res.status(400).json({ message: "Hành động phải là 'accept' hoặc 'decline'." });
    }

    const request = await FriendRequest.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({ message: "Không tìm thấy lời mời kết bạn." });
    }
    if (String(request.receiver) !== String(req.user.id)) {
      return res.status(403).json({ message: "Bạn không có quyền phản hồi lời mời này." });
    }
    if (request.status !== "pending") {
      return res.status(400).json({ message: "Lời mời này đã được xử lý trước đó." });
    }

    if (action === "decline") {
      request.status = "rejected";
      await request.save();
      return res.status(200).json({ message: "Đã từ chối lời mời kết bạn." });
    }

    request.status = "accepted";
    await request.save();

    await Promise.all([
      User.findByIdAndUpdate(request.sender, { $addToSet: { friends: request.receiver } }),
      User.findByIdAndUpdate(request.receiver, { $addToSet: { friends: request.sender } })
    ]);

    return res.status(200).json({ message: "Đã chấp nhận lời mời kết bạn." });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi phản hồi lời mời." });
  }
});

router.get("/friends", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate("friends", "firstName lastName email avatar")
      .select("friends");

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    return res.status(200).json({ friends: user.friends || [] });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi tải danh sách bạn bè." });
  }
});

router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const { firstName, lastName, avatar } = req.body;

    if (!firstName?.trim() || !lastName?.trim()) {
      return res.status(400).json({ message: "Họ và tên không được để trống." });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        avatar: typeof avatar === "string" ? avatar.trim() : ""
      },
      { new: true, runValidators: true }
    ).select("firstName lastName email avatar");

    if (!updatedUser) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    return res.status(200).json({
      message: "Cập nhật hồ sơ thành công.",
      user: {
        id: updatedUser._id,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        email: updatedUser.email,
        avatar: updatedUser.avatar
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi cập nhật hồ sơ." });
  }
});

router.put("/change-password", authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Vui lòng nhập đầy đủ mật khẩu cũ và mật khẩu mới." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Mật khẩu mới phải có ít nhất 6 ký tự." });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      return res.status(400).json({ message: "Mật khẩu cũ không chính xác." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    return res.status(200).json({ message: "Đổi mật khẩu thành công." });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi đổi mật khẩu." });
  }
});

router.delete("/friends/:id", authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const friendId = req.params.id;

    await Promise.all([
      User.findByIdAndUpdate(currentUserId, { $pull: { friends: friendId } }),
      User.findByIdAndUpdate(friendId, { $pull: { friends: currentUserId } })
    ]);

    return res.status(200).json({ message: "Đã hủy kết bạn thành công." });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi hủy kết bạn." });
  }
});

module.exports = router;
