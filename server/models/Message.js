const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  { 
    sender: {
      type: mongoose.Schema.Types.ObjectId, //ID của người gửi
      ref: "User", //Liên kết với bảng User 
      required: true
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId, //ID của người nhận (chat 1-1)
      ref: "User"
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      default: null
    },
    content: {
      type: String, //Nội dung tin nhắn
      default: "",
      trim: true
    },
    fileUrl: {
      type: String,
      trim: true,
      default: ""
    },
    fileType: {
      type: String,
      enum: ["image", "file", ""],
      default: ""
    },
    fileName: {
      type: String,
      trim: true,
      default: ""
    },
    /** Loại tin: text | image | file | system (sự kiện nhóm, không có bong bóng chat) */
    messageType: {
      type: String,
      enum: ["text", "image", "file", "system"],
      default: "text",
      required: false
    },
    /** true khi người nhận đã mở/đọc tin 1-1 (trạng thái "Đã xem" DM) */
    isRead: {
      type: Boolean,
      default: false
    },
    /** Nhóm chat: danh sách thành viên đã xem tin (Messenger-style seenBy) */
    seenBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],
    /** Thu hồi cho cả hai phía (Unsend) — isRecalled=true, nội dung thay bằng placeholder */
    isRecalled: {
      type: Boolean,
      default: false
    },
    /** Danh sách userId đã xóa tin chỉ phía mình (Remove — ẩn local qua hiddenFor) */
    hiddenFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ],
    /**
     * Self-referencing (MongoDB): replyTo trỏ về _id của một document Message khác
     * trong cùng collection — cho phép trả lời (reply) tin đã có mà không nhân bản nội dung.
     * Khi populate replyTo, server lồng thêm sender của tin gốc để client hiển thị trích dẫn.
     */
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null
    },
    /**
     * Mảng cảm xúc (reactions) — mỗi phần tử là { user, emoji }:
     * - user: ObjectId người thả cảm xúc (ref User).
     * - emoji: chuỗi emoji đã thả (ví dụ: "❤️", "👍", "😂"...).
     * Mỗi user chỉ được thả tối đa 1 emoji cho 1 tin nhắn (toggle logic xử lý ở socket).
     */
    reactions: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        emoji: String
      }
    ]
  },
  {
    timestamps: true //Thời gian tạo và cập nhật
  }
);

messageSchema.path("receiver").validate(function validateReceiver(receiver) {
  if (this.groupId) return true;
  return Boolean(receiver);
}, "Tin nhắn 1-1 phải có người nhận.");

messageSchema.path("content").validate(function validateContentOrFile(content) {
  if (this.isRecalled) return true;
  if (this.messageType === "system") {
    return typeof content === "string" && content.trim().length > 0;
  }
  const hasText = typeof content === "string" && content.trim().length > 0;
  const hasFile = typeof this.fileUrl === "string" && this.fileUrl.trim().length > 0;
  return hasText || hasFile;
}, "Tin nhắn phải có nội dung hoặc tệp đính kèm.");

module.exports = mongoose.model("Message", messageSchema);  //Tạo model Message
