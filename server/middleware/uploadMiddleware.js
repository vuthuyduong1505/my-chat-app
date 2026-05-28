const multer = require("multer");

const storage = multer.memoryStorage();

/** Multer đọc originalname theo latin1; chuyển về utf8 để giữ dấu tiếng Việt. */
function decodeMulterFileName(originalname) {
  if (!originalname || typeof originalname !== "string") return "attachment";
  try {
    const decoded = Buffer.from(originalname, "latin1").toString("utf8").trim();
    return decoded || "attachment";
  } catch {
    return originalname.trim() || "attachment";
  }
}

const imageFileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith("image/")) {
    cb(new Error("Chỉ được tải lên file ảnh."));
    return;
  }
  cb(null, true);
};

const uploadAvatar = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 3 * 1024 * 1024
  }
});

const chatFileFilter = (req, file, cb) => {
  if (!file?.mimetype) {
    cb(new Error("File không hợp lệ."));
    return;
  }
  cb(null, true);
};

const uploadChatFile = multer({
  storage,
  fileFilter: chatFileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024
  }
});

module.exports = { uploadAvatar, uploadChatFile, decodeMulterFileName };
