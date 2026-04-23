const express = require("express");

const router = express.Router();

router.post("/", (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ message: "Vui lòng nhập nội dung tin nhắn." });
  }

  return res.status(200).json({
    reply: `Phản hồi: ${message}`
  });
});

module.exports = router;
