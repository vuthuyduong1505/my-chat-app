const express = require("express");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
  try {
    const users = await User.find({}, "firstName lastName email avatar").sort({ firstName: 1, lastName: 1 });
    return res.status(200).json({ users });
  } catch (error) {
    return res.status(500).json({ message: "Server error while fetching users." });
  }
});

module.exports = router;
