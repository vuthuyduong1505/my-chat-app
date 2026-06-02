/**
 * Tách tên gọi (từ cuối cùng) từ họ tên đầy đủ.
 * Gộp firstName + lastName thành một chuỗi, sau đó dùng split(' ').pop()
 * để luôn lấy từ cuối — tên gọi thân mật trong chat nhóm.
 * Ví dụ: 'Vũ Thùy' + 'Dương' → 'Vũ Thùy Dương' → 'Dương'
 */
export function getCallingNameFromFullName(fullName) {
  const trimmed = String(fullName || "").trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/).pop() || trimmed;
}

/** Lấy tên gọi từ object user hoặc cặp firstName / lastName */
export function getCallingName(source, lastName) {
  if (source && typeof source === "object") {
    const fullName = `${source.firstName || ""} ${source.lastName || ""}`.trim();
    if (fullName) return getCallingNameFromFullName(fullName);
    if (source.email) return getCallingNameFromFullName(source.email.split("@")[0]);
    return "";
  }

  const fullName = `${source || ""} ${lastName || ""}`.trim();
  return getCallingNameFromFullName(fullName);
}

/**
 * Lấy tên hiển thị theo mức độ ưu tiên:
 * 1. Biệt danh (nickname) nếu có trong mảng nicknames
 * 2. Tên đầy đủ (firstName + lastName)
 * 3. Email
 * 4. Mặc định "Thành viên"
 * 
 * @param {string} userId - ID người dùng cần lấy tên
 * @param {Array} nicknames - Mảng biệt danh [{user: userId, nickname: string}]
 * @param {Object} fallbackUser - Object user chứa thông tin dự phòng (firstName, lastName, email)
 */
export function getDisplayName(userId, nicknames = [], fallbackUser = null) {
  // Ưu tiên 1: Biệt danh
  if (Array.isArray(nicknames) && userId) {
    const entry = nicknames.find((n) => String(n.user) === String(userId));
    if (entry && entry.nickname) {
      return entry.nickname;
    }
  }

  // Ưu tiên 2 & 3: Tên đầy đủ hoặc email
  if (fallbackUser && typeof fallbackUser === "object") {
    const fullName = `${fallbackUser.firstName || ""} ${fallbackUser.lastName || ""}`.trim();
    if (fullName) return fullName;
    if (fallbackUser.email) return fallbackUser.email.split("@")[0];
  }

  // Ưu tiên 4: Mặc định
  return "Thành viên";
}
