const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const transporter = require("../config/mailer");

const router = express.Router();
//Tạo token JWT cho người dùng sau khi đăng nhập
const createToken = (userId) => jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
const createResetToken = (userId) =>
  jwt.sign({ id: userId, purpose: "reset-password" }, process.env.JWT_SECRET, { expiresIn: "15m" });
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
        email: user.email,
        avatar: user.avatar || ""
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
        email: user.email,
        avatar: user.avatar || ""
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi đăng nhập." });
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Vui lòng nhập email." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    // Không tiết lộ email có tồn tại hay không để tránh bị dò tài khoản.
    if (!user) {
      return res.status(200).json({ message: "Nếu email tồn tại, link đặt lại mật khẩu đã được gửi." });
    }

    // Luồng Quên mật khẩu:
    // 1) Tạo reset token JWT sống 15 phút.
    // 2) Gửi email chứa link reset-password kèm token.
    // 3) Ở API reset-password, server sẽ verify token rồi mới đổi mật khẩu.
    const resetToken = createResetToken(user._id);
    const resetUrl = `http://localhost:5173/reset-password/${resetToken}`;
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
      to: user.email,
      subject: "Dat lai mat khau Chat App",
      html: `
        <p>Xin chao ${user.firstName || "ban"},</p>
        <p>Ban vua yeu cau dat lai mat khau. Nhan vao link duoi day (hieu luc 15 phut):</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Nếu khong phai ban, hay bo qua email nay.</p>
      `
    });

    return res.status(200).json({ message: "Nếu email tồn tại, link đặt lại mật khẩu đã được gửi." });
  } catch (error) {
    return res.status(500).json({ message: "Không thể gửi email khôi phục lúc này." });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: "Thiếu token hoặc mật khẩu mới." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Mật khẩu mới phải có ít nhất 6 ký tự." });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload?.purpose !== "reset-password" || !payload?.id) {
      return res.status(400).json({ message: "Token đặt lại mật khẩu không hợp lệ." });
    }

    const user = await User.findById(payload.id);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    return res.status(200).json({ message: "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập lại." });
  } catch (error) {
    if (error?.name === "TokenExpiredError") {
      return res.status(400).json({ message: "Token đã hết hạn. Vui lòng yêu cầu link mới." });
    }
    if (error?.name === "JsonWebTokenError") {
      return res.status(400).json({ message: "Token không hợp lệ." });
    }
    return res.status(500).json({ message: "Lỗi máy chủ khi đặt lại mật khẩu." });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const u = await User.findById(req.user.id).select("firstName lastName email avatar").lean();
    if (!u) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }
    return res.status(200).json({
      user: {
        id: u._id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        avatar: u.avatar || ""
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Lỗi máy chủ khi tải thông tin tài khoản." });
  }
});

module.exports = router;
