import React, { useEffect, useMemo, useState } from "react";

const SIZE_CLASSES = {
  tiny: "h-3 w-3 text-[6px]",
  xs: "h-8 w-8 text-[11px]",
  sm: "h-10 w-10 text-sm",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-base",
  profile: "h-36 w-36 text-4xl font-bold"
};

/**
 * Lợi ích của việc dùng Shared Component cho Avatar:
 * 1. Đảm bảo tính nhất quán (Consistency): Tránh việc mỗi nơi hiển thị một kiểu chữ, cỡ chữ, hoặc màu nền khác nhau.
 * 2. Dễ bảo trì (Maintainability): Khi muốn thay đổi quy chuẩn thiết kế (như đổi màu chủ đạo, viền, hiệu ứng bo góc...), chỉ cần chỉnh sửa tại một nơi duy nhất thay vì sửa hàng chục tệp tin.
 * 3. Tái sử dụng (Reusability): Giảm thiểu code trùng lặp trên các trang và component khác nhau, giúp codebase sạch và dễ đọc hơn.
 */
function UserAvatar({
  user,
  avatar: avatarProp,
  firstName: firstNameProp,
  lastName: lastNameProp,
  email: emailProp,
  size = "md",
  className = "",
  imgClassName = "",
  alt = ""
}) {
  const rawAvatar = avatarProp !== undefined ? avatarProp : user?.avatar;
  const trimmed = typeof rawAvatar === "string" ? rawAvatar.trim() : "";
  const firstName = firstNameProp ?? user?.firstName;
  const email = emailProp ?? user?.email;

  const [imgErr, setImgErr] = useState(false);
  useEffect(() => {
    setImgErr(false);
  }, [trimmed]);

  const initial = useMemo(() => {
    const name = (firstName || "").trim();
    const base = name || email || "?";
    return base.charAt(0).toUpperCase() || "?";
  }, [firstName, email]);

  const sizeCls = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const showImg = Boolean(trimmed) && !imgErr;

  return (
    <div
      className={`flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold select-none leading-none ${sizeCls} ${className}`.trim()}
      style={!showImg ? { backgroundColor: "#003B44", color: "#ffffff", border: "1px solid rgba(255, 255, 255, 0.8)" } : {}}
    >
      {showImg ? (
        <img
          src={trimmed}
          alt={alt}
          className={`h-full w-full min-h-0 min-w-0 object-cover rounded-full ${imgClassName}`.trim()}
          onError={() => setImgErr(true)}
        />
      ) : (
        initial
      )}
    </div>
  );
}

export { UserAvatar };
export default UserAvatar;
