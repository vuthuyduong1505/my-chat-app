const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    avatar: {
      type: String,
      trim: true,
      default: ""
    },
    /** Người tạo nhóm (hiển thị nhãn "Người tạo nhóm" trên client) */
    creator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    /** Trường cũ — giữ để đọc nhóm tạo trước khi đổi sang creator */
    admin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],
    /** 
     * Biệt danh trong nhóm chat
     * Mỗi phần tử lưu biệt danh của một người dùng trong nhóm này.
     */
    nicknames: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        nickname: String
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Group", groupSchema);
