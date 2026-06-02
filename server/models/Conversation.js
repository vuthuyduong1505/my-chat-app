const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],
    /** 
     * Biệt danh trong chat 1-1 
     * Mỗi phần tử lưu biệt danh của một người dùng trong cuộc trò chuyện này.
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

module.exports = mongoose.model("Conversation", conversationSchema);
