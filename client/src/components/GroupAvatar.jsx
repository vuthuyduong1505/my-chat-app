import { Users } from "lucide-react";
import UserAvatar from "./UserAvatar";

/**
 * Avatar nhóm kiểu Messenger: tối đa 2 thành viên, xếp chồng tinh tế.
 * Ưu tiên ảnh nhóm nếu có; không thì 2 thành viên đầu danh sách.
 */
export default function GroupAvatar({ group, size = "md", className = "" }) {
  const sizeClasses = {
    sm: { box: "h-10 w-10", avatar: "h-7 w-7", icon: 18 },
    md: { box: "h-11 w-11", avatar: "h-8 w-8", icon: 20 }
  };
  const dim = sizeClasses[size] || sizeClasses.md;

  if (group?.avatar) {
    return (
      <img
        src={group.avatar}
        alt=""
        className={`${dim.box} shrink-0 rounded-full object-cover ring-2 ring-[#003B44]/10 ${className}`}
      />
    );
  }

  const members = (group?.members || []).slice(0, 2);
  if (members.length === 0) {
    return (
      <div
        className={`flex ${dim.box} shrink-0 items-center justify-center rounded-full bg-[#003B44]/10 text-[#00BFA5] ring-2 ring-[#003B44]/10 ${className}`}
      >
        <Users size={dim.icon} />
      </div>
    );
  }

  if (members.length === 1) {
    return (
      <UserAvatar
        user={members[0]}
        size={size === "sm" ? "sm" : "md"}
        className={`ring-2 ring-[#003B44]/10 ${className}`}
        alt=""
      />
    );
  }

  return (
    <div className={`relative ${dim.box} shrink-0 ${className}`} aria-hidden>
      <UserAvatar
        user={members[0]}
        size="xs"
        className={`absolute left-0 top-0 z-10 ${dim.avatar} ring-2 ring-light`}
        alt=""
      />
      <UserAvatar
        user={members[1]}
        size="xs"
        className={`absolute bottom-0 right-0 z-20 ${dim.avatar} ring-2 ring-light`}
        alt=""
      />
    </div>
  );
}
