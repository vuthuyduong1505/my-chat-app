import { useEffect, useMemo, useState } from "react";

const SIZE_CLASSES = {
  xs: "h-8 w-8 text-[11px]",
  sm: "h-10 w-10 text-sm",
  md: "h-11 w-11 text-sm",
  lg: "h-14 w-14 text-base",
  profile: "h-36 w-36 text-4xl font-bold"
};

/**
 * Avatar dùng chung: ưu tiên URL ảnh; lỗi load hoặc trống → vòng tròn + chữ cái đầu.
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
  const lastName = lastNameProp ?? user?.lastName;
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
      className={`flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full font-bold ${sizeCls} ${className}`.trim()}
      style={!showImg ? { backgroundColor: "#003B44", color: "#ffffff", border: "1px solid rgba(255, 255, 255, 0.8)" } : {}}
    >
      {showImg ? (
        <img
          src={trimmed}
          alt={alt}
          className={`h-full w-full min-h-0 min-w-0 object-cover ${imgClassName}`.trim()}
          onError={() => setImgErr(true)}
        />
      ) : (
        <span className="select-none leading-none">{initial}</span>
      )}
    </div>
  );
}

export { UserAvatar };
export default UserAvatar;
