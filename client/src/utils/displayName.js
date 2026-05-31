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
