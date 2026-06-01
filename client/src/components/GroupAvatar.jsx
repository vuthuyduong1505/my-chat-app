import { Users } from "lucide-react";
import UserAvatar from "./UserAvatar";

/**
 * Avatar nhóm — mọi biến thể đều hình tròn (rounded-full) để đồng bộ với avatar người dùng.
 * Ưu tiên ảnh nhóm; không có ảnh thì hiển thị tối đa 2 thành viên xếp chồng trong vòng tròn.
 */
export default function GroupAvatar({ group, size = "md", className = "" }) {
  const sizeClasses = {
    sm: { box: "h-10 w-10", avatar: "h-7 w-7", icon: 18 },
    md: { box: "h-11 w-11", avatar: "h-8 w-8", icon: 20 },
    lg: { box: "h-20 w-20", avatar: "h-[3.25rem] w-[3.25rem]", icon: 24 }
  };
  const dim = sizeClasses[size] || sizeClasses.md;
  const circleBase = `shrink-0 overflow-hidden rounded-full ${dim.box}`;

  if (group?.avatar) {
    return (
      <img
        src={group.avatar}
        alt=""
        className={`${circleBase} object-cover ring-2 ring-[#003B44]/10 ${className}`}
      />
    );
  }

  const members = (group?.members || []).slice(0, 2);
  if (members.length === 0) {
    return (
      <div
        className={`flex ${circleBase} items-center justify-center bg-[#003B44]/10 text-[#00BFA5] ring-2 ring-[#003B44]/10 ${className}`}
      >
        <Users size={dim.icon} />
      </div>
    );
  }

  if (members.length === 1) {
    return (
      <UserAvatar
        user={members[0]}
        size={size === "sm" ? "sm" : size === "lg" ? "lg" : "md"}
        className={`${circleBase} !h-full !w-full ring-2 ring-[#003B44]/10 ${className}`}
        alt=""
      />
    );
  }

  return (
    <div className={`relative ${circleBase} ${className}`} aria-hidden>
      <UserAvatar
        user={members[0]}
        size="xs"
        className={`absolute left-0 top-0 z-10 ${dim.avatar} rounded-full ring-2 ring-light`}
        alt=""
      />
      <UserAvatar
        user={members[1]}
        size="xs"
        className={`absolute bottom-0 right-0 z-20 ${dim.avatar} rounded-full ring-2 ring-light`}
        alt=""
      />
    </div>
  );
}
