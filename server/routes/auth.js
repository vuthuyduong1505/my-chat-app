const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();
//Tạo token JWT cho người dùng sau khi đăng nhập
const createToken = (userId) => jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
//Đăng ký tài khoản mới
router.post("/register", async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword } = req.body;
    //Kiểm tra các trường đầu vào
    if (!firstName || !lastName || !email || !password || !confirmPassword) {
      return res
        .status(400)
        .json({ message: "Vui lòng nhập đầy đủ họ, tên, email, mật khẩu và xác nhận mật khẩu." });
    }
    //Kiểm tra mật khẩu và mật khẩu xác nhận
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Mật khẩu và xác nhận mật khẩu không khớp." });
    }
//Kiểm tra email đã tồn tại hay chưa
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: "Email đã tồn tại." });
    }
    //Mã hóa mật khẩu
    const hashedPassword = await bcrypt.hash(password, 10);
    //Tạo tài khoản mới
    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      password: hashedPassword
    });

    return res.status(201).json({
      message: "Đăng ký thành công.",
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi đăng ký." });
  }
});
//Đăng nhập
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    //Kiểm tra các trường đầu vào
    if (!email || !password) {
      return res.status(400).json({ message: "Vui lòng nhập email và mật khẩu." });
    }
    //Kiểm tra email đã tồn tại hay chưa
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Email hoặc mật khẩu không chính xác." });
    }
    //Kiểm tra mật khẩu
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Email hoặc mật khẩu không chính xác." });
    }
    //Tạo token JWT
    return res.status(200).json({
      message: "Đăng nhập thành công.",
      token: createToken(user._id),
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi đăng nhập." });
  }
});

router.post("/forgot-password", (req, res) => {
  return res.status(200).json({ message: "Mã khôi phục đã được gửi" });
});

module.exports = router;
