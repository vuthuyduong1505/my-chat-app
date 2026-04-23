//Middleware để xác thực token JWT
const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  //Lấy token từ header Authorization
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  //Nếu không có token, trả về lỗi 401
  if (!token) {
    return res.status(401).json({ message: "Không có quyền truy cập. Thiếu token xác thực." });
  }

  //Xác thực token
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    //Cho phép request tiếp theo
    return next();
  } catch (error) {
    //Nếu token không hợp lệ, trả về lỗi 401
    return res.status(401).json({ message: "Không có quyền truy cập. Token không hợp lệ." });
  }
};

module.exports = authMiddleware;
