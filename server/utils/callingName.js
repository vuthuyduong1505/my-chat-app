/**
 * Tách tên gọi (từ cuối cùng) từ họ tên đầy đủ — dùng cho preview sidebar nhóm.
 * Gộp firstName + lastName, rồi split(' ').pop() (ví dụ: 'Vũ Thùy Dương' → 'Dương').
 */
function getCallingNameFromFullName(fullName) {
  const trimmed = String(fullName || "").trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/).pop() || trimmed;
}

function getCallingName(user) {
  if (!user) return "";
  const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
  if (fullName) return getCallingNameFromFullName(fullName);
  if (user.email) return getCallingNameFromFullName(user.email.split("@")[0]);
  return "";
}

module.exports = { getCallingName, getCallingNameFromFullName };
