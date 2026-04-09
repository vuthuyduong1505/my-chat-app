const express = require("express");

const router = express.Router();

router.post("/", (req, res) => {
  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ message: "Message is required." });
  }

  return res.status(200).json({
    reply: `Echo: ${message}`
  });
});

module.exports = router;
