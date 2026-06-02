import React from "react";
import { Info } from "lucide-react";
import GroupAvatar from "../GroupAvatar";
import UserAvatar from "../UserAvatar";

/**
 * Component ChatHeader
 * Hiển thị thanh tiêu đề trên của hộp thoại chat (tên nhóm/bạn bè, trạng thái hoạt động/thành viên, nút Info)
 */
function ChatHeader({
  isGroupChat,
  activeGroup,
  friend,
  chatTitle,
  chatSubtitle,
  infoSidebarOpen,
  setInfoSidebarOpen,
}) {
  return (
    <header className="relative z-10 flex shrink-0 items-center gap-3 border-b border-primary/10 bg-light/95 px-4 py-3 backdrop-blur-sm md:px-5">
      {isGroupChat ? (
        <GroupAvatar group={activeGroup} size="md" className="ring-2 ring-[#00BFA5]/25" />
      ) : (
        <UserAvatar user={friend} size="md" className="ring-2 ring-secondary/25" alt="" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-[#003B44]">{chatTitle}</p>
        <p className="truncate text-xs text-[#003B44]/50">{chatSubtitle}</p>
      </div>
      <button
        type="button"
        onClick={() => setInfoSidebarOpen((v) => !v)}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all ${
          infoSidebarOpen
            ? "bg-[#00BFA5] text-[#003B44] shadow-md"
            : "bg-[#003B44]/8 text-[#003B44] hover:bg-[#003B44]/12"
        }`}
        aria-label={infoSidebarOpen ? "Ẩn thông tin cuộc trò chuyện" : "Xem thông tin cuộc trò chuyện"}
        aria-pressed={infoSidebarOpen}
      >
        <Info size={20} strokeWidth={2} />
      </button>
    </header>
  );
}

export default ChatHeader;
