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
    }
  },
  {
    timestamps: true //Thời gian tạo và cập nhật
  }
);

messageSchema.path("content").validate(function validateContentOrFile(content) {
  const hasText = typeof content === "string" && content.trim().length > 0;
  const hasFile = typeof this.fileUrl === "string" && this.fileUrl.trim().length > 0;
  return hasText || hasFile;
}, "Tin nhắn phải có nội dung hoặc tệp đính kèm.");

module.exports = mongoose.model("Message", messageSchema);  //Tạo model Message
