const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const FriendRequest = require("../models/FriendRequest");
const authMiddleware = require("../middleware/authMiddleware");
const cloudinary = require("../config/cloudinary");
const { uploadAvatar } = require("../middleware/uploadMiddleware");
const { emitToUser } = require("../socket");

const router = express.Router();

/**
 * API Khám phá (Discover) - Đã được tối ưu hóa cho hệ thống quy mô lớn (High Scalability)
 * 
 * TẠI SAO CƠ CHẾ NÀY TỐI ƯU HƠN VIỆC HIỂN THỊ DANH SÁCH TẤT CẢ NGƯỜI DÙNG?
 * 1. Tiết kiệm tài nguyên mạng & RAM (Bandwidth & Memory):
 *    - Việc tải toàn bộ người dùng từ database và truyền qua mạng sẽ gây quá tải RAM của Server, Node.js process 
 *      và tăng băng thông mạng cực lớn khi số lượng người dùng đạt hàng chục ngàn trở lên.
 *    - Bằng cách giới hạn số lượng trả về (tối đa 20-30 người) và áp dụng phân trang (Pagination) khi tìm kiếm,
 *      API chỉ tải và truyền đúng lượng dữ liệu cần hiển thị trên màn hình hiện tại.
 * 2. Tối ưu hóa truy vấn Database (Database Performance):
 *    - Thay vì thực hiện quét toàn bộ bảng (Table Scan) và sắp xếp trong bộ nhớ của ứng dụng, chúng ta sử dụng
 *      MongoDB Aggregation Pipeline để thực hiện tính toán số bạn chung trực tiếp trên MongoDB Engine.
 *    - MongoDB Aggregation tối ưu hóa bộ nhớ đệm và chỉ mục tốt hơn rất nhiều so với việc xử lý thủ công ở tầng code.
 * 3. Tăng tính cá nhân hóa & Trải nghiệm người dùng (UX/Relevance):
 *    - Người dùng không có nhu cầu cuộn qua danh sách hàng vạn người lạ không liên quan.
 *    - Gợi ý dựa trên bạn chung (Mutual Friends) có xác suất kết nối cao nhất. Khi danh sách này trống, hệ thống 
 *      fallback sang gợi ý các thành viên mới đăng ký để tạo cơ hội giao lưu, đồng thời giúp trang Discover luôn sống động.
 */
router.get("/discover", authMiddleware, async (req, res) => {
  try {
    const currentUserId = new mongoose.Types.ObjectId(req.user.id);
    const search = (req.query.search || "").trim();
    const currentUser = await User.findById(currentUserId).select("friends");

    if (!currentUser) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    // Lấy các yêu cầu kết bạn đang chờ để phân loại connectionStatus
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

    let users = [];
    let isRecommendation = false;
    let isNewest = false;
    let totalPages = 1;
    let currentPage = 1;

    if (search) {
      // CHẾ ĐỘ TÌM KIẾM (Search Mode) - Áp dụng phân trang để tránh tải quá nhiều
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 12;
      const skip = (page - 1) * limit;

      const searchMatch = {
        _id: { $ne: currentUserId },
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
      };

      const totalUsers = await User.countDocuments(searchMatch);
      totalPages = Math.ceil(totalUsers / limit);
      currentPage = page;

      // Thực hiện Aggregation tìm kiếm có phân trang và tính số bạn chung
      const foundUsers = await User.aggregate([
        { $match: searchMatch },
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
            mutualFriendsCount: 1
          }
        },
        { $sort: { mutualFriendsCount: -1, firstName: 1, lastName: 1 } },
        { $skip: skip },
        { $limit: limit }
      ]);

      users = foundUsers;
    } else {
      // CHẾ ĐỘ MẶC ĐỊNH (Gợi ý dựa trên Bạn chung - Mutual Friends)
      // Tìm những người có ít nhất 1 bạn chung và CHƯA PHẢI là bạn bè
      const recommended = await User.aggregate([
        {
          $match: {
            _id: { $ne: currentUserId, $nin: currentUser.friends || [] }
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
          $match: {
            mutualFriendsCount: { $gt: 0 } // Có ít nhất 1 bạn chung
          }
        },
        { $sort: { mutualFriendsCount: -1, firstName: 1, lastName: 1 } },
        { $limit: 30 }, // Giới hạn trả về tối đa 30 gợi ý tốt nhất
        {
          $project: {
            firstName: 1,
            lastName: 1,
            email: 1,
            avatar: 1,
            mutualFriendsCount: 1
          }
        }
      ]);

      if (recommended.length > 0) {
        users = recommended;
        isRecommendation = true;
      } else {
        // FALLBACK: Trả về "Thành viên mới nhất" khi không có bất kỳ bạn chung nào
        const newest = await User.find({
          _id: { $ne: currentUserId, $nin: currentUser.friends || [] }
        })
          .sort({ createdAt: -1 })
          .limit(12)
          .select("firstName lastName email avatar friends");

        users = newest.map((person) => {
          const pFriends = person.friends || [];
          const cFriends = currentUser.friends || [];
          const mutual = pFriends.filter((fId) => cFriends.some((cf) => String(cf) === String(fId)));
          
          return {
            _id: person._id,
            firstName: person.firstName,
            lastName: person.lastName,
            email: person.email,
            avatar: person.avatar,
            mutualFriendsCount: mutual.length
          };
        });

        isNewest = true;
      }
    }

    // Ánh xạ trạng thái kết bạn để hiển thị đúng nút hành động ở client
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

    return res.status(200).json({
      users: usersWithStatus,
      isRecommendation,
      isNewest,
      totalPages,
      currentPage
    });
  } catch (error) {
    console.error("Lỗi API discover:", error);
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

    // Chỉ chặn gửi lời mời mới nếu đã có một yêu cầu ở trạng thái pending (đang chờ xử lý)
    const existingPending = await FriendRequest.findOne({
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId }
      ],
      status: "pending"
    });
    if (existingPending) {
      return res.status(409).json({ message: "Đã có lời mời kết bạn đang chờ xử lý." });
    }

    // Tự động xóa sạch mọi lời mời kết bạn cũ (đã chấp nhận hoặc bị từ chối) từ cả hai phía để tránh xung đột index 11000
    await FriendRequest.deleteMany({
      $or: [
        { sender: senderId, receiver: receiverId },
        { sender: receiverId, receiver: senderId }
      ],
      status: { $in: ["accepted", "rejected"] }
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

router.delete("/friend-request/cancel/:targetUserId", authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const targetUserId = req.params.targetUserId;

    // Xóa bản ghi lời mời đang ở trạng thái pending giữa người gửi và người nhận
    const deleted = await FriendRequest.findOneAndDelete({
      sender: currentUserId,
      receiver: targetUserId,
      status: "pending"
    });

    if (!deleted) {
      return res.status(404).json({ message: "Không tìm thấy yêu cầu kết bạn đang chờ hủy." });
    }

    return res.status(200).json({ message: "Đã hủy yêu cầu kết bạn thành công." });
  } catch (error) {
    console.error("Lỗi API cancel friend-request:", error);
    return res.status(500).json({ message: "Lỗi máy chủ khi hủy yêu cầu kết bạn." });
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

    const [userB] = await Promise.all([
      User.findById(req.user.id).select("firstName lastName email avatar"),
      User.findByIdAndUpdate(request.sender, { $addToSet: { friends: request.receiver } }),
      User.findByIdAndUpdate(request.receiver, { $addToSet: { friends: request.sender } })
    ]);

    /**
     * GIẢI THÍCH: LOGIC GỬI TÍN HIỆU SOCKET NGƯỢC LẠI CHO NGƯỜI GỬI LỜI MỜI BAN ĐẦU
     * Khi người dùng B (người nhận lời mời) bấm "Chấp nhận", hệ thống sẽ cập nhật trạng thái
     * bạn bè của hai bên thành công trong CSDL. Để thông báo tức thời cho người dùng A (người đã
     * gửi lời mời ban đầu) mà không cần họ phải F5 trang, server sẽ phát (emit) sự kiện 
     * `friend_request_accepted` kèm theo đầy đủ thông tin profile của B (avatar, tên, email) 
     * tới riêng socket của A thông qua hàm `emitToUser(String(request.sender), ...)`.
     * Phía client của A sẽ lắng nghe sự kiện này và tự động thêm B vào danh sách bạn bè 
     * cũng như cập nhật trạng thái hiển thị của B thành "Bạn bè" (friend) ngay lập tức.
     */
    if (userB) {
      emitToUser(String(request.sender), "friend_request_accepted", { user: userB });
    }

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

router.put("/profile", authMiddleware, uploadAvatar.single("avatar"), async (req, res) => {
  try {
    const { firstName, lastName } = req.body;

    if (!firstName?.trim() || !lastName?.trim()) {
      return res.status(400).json({ message: "Họ và tên không được để trống." });
    }

    let avatarUrl;
    // Luồng Upload Avatar:
    // 1) Nhận file ảnh từ multipart/form-data qua multer (đang nằm trong bộ nhớ RAM).
    // 2) Đẩy buffer ảnh này lên Cloudinary bằng upload_stream.
    // 3) Lấy secure_url trả về và lưu vào trường avatar trong MongoDB.
    if (req.file) {
      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "chat-app/avatars",
            resource_type: "image"
          },
          (error, result) => {
            if (error) return reject(error);
            return resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });
      avatarUrl = uploadResult.secure_url;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        ...(avatarUrl ? { avatar: avatarUrl } : {})
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

router.use((error, req, res, next) => {
  if (error?.message === "Chỉ được tải lên file ảnh.") {
    return res.status(400).json({ message: error.message });
  }
  if (error?.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ message: "Kích thước ảnh tối đa là 3MB." });
  }
  return next(error);
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

    // Xóa ID của nhau trong mảng friends của cả hai User
    await Promise.all([
      User.findByIdAndUpdate(currentUserId, { $pull: { friends: friendId } }),
      User.findByIdAndUpdate(friendId, { $pull: { friends: currentUserId } })
    ]);

    /**
     * GIẢI THÍCH: TẠI SAO CẦN XÓA BẢN GHI FriendRequest KHI THỰC HIỆN UNFRIEND?
     * Khi hủy kết bạn, hai người sẽ quay trở lại trạng thái "Người lạ" (None).
     * Nếu ta giữ lại bản ghi FriendRequest cũ (đã ở trạng thái 'accepted'), thì khi người dùng 
     * muốn gửi lại yêu cầu kết bạn mới trong tương lai, hệ thống sẽ kiểm tra unique index hoặc 
     * báo lỗi trùng lặp bản ghi cũ. Do đó, việc xóa sạch các bản ghi yêu cầu kết bạn cũ liên quan 
     * giữa hai người là bắt buộc để reset hoàn toàn quan hệ và cho phép gửi lại lời mời mới bình thường.
     */
    await FriendRequest.deleteMany({
      $or: [
        { sender: currentUserId, receiver: friendId },
        { sender: friendId, receiver: currentUserId }
      ]
    });

    return res.status(200).json({ message: "Đã hủy kết bạn thành công." });
  } catch (error) {
    console.error("Lỗi unfriend:", error);
    return res.status(500).json({ message: "Lỗi máy chủ khi hủy kết bạn." });
  }
});

module.exports = router;
