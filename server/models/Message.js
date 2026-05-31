const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  { 
    sender: {
      type: mongoose.Schema.Types.ObjectId, //ID của người gửi
      ref: "User", //Liên kết với bảng User 
      required: true
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId, //ID của người nhận
      ref: "User", //Liên kết với bảng User
      required: true
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
    /** true khi người nhận đã mở/đọc tin (dùng cho trạng thái "Đã xem" phía người gửi) */
    isRead: {
      type: Boolean,
      default: false
    },
    /** Thu hồi cho cả hai phía — nội dung thay bằng placeholder */
    isRecalled: {
      type: Boolean,
      default: false
    },
    /** Danh sách userId đã xóa tin chỉ phía mình */
    hiddenFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      }
    ]
  },
  {
    timestamps: true //Thời gian tạo và cập nhật
  }
);

messageSchema.path("content").validate(function validateContentOrFile(content) {
  if (this.isRecalled) return true;
  const hasText = typeof content === "string" && content.trim().length > 0;
  const hasFile = typeof this.fileUrl === "string" && this.fileUrl.trim().length > 0;
  return hasText || hasFile;
}, "Tin nhắn phải có nội dung hoặc tệp đính kèm.");

module.exports = mongoose.model("Message", messageSchema);  //Tạo model Message
