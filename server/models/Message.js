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
      required: true,
      trim: true
    }
  },
  {
    timestamps: true //Thời gian tạo và cập nhật
  }
);

module.exports = mongoose.model("Message", messageSchema);  //Tạo model Message
