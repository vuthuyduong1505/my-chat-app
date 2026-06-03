import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FileText, Smile, Reply, MoreVertical, X } from "lucide-react";
import UserAvatar from "../UserAvatar";
import {
  downloadFile,
  RECALLED_TEXT,
  REACTION_EMOJIS,
  getGroupedBubbleRadius,
  replyAuthorName,
  replyContentLabel
} from "./chatUtils";

export function FileAttachmentBubble({ url, fileName, variant = "received" }) {
  const isMine = variant === "mine";
  const displayName = fileName || "Tệp đính kèm";

  return (
    <button
      type="button"
      onClick={() => downloadFile(url, displayName)}
      className={`flex w-full min-w-[168px] max-w-[260px] cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 ${isMine
        ? "bg-[#002a30] hover:bg-[#004a54] active:bg-[#003B44]"
        : "bg-[#e4eaec] hover:bg-[#d5e0e4] active:bg-[#c8d6db]"
        }`}
      aria-label={`Tải xuống ${displayName}`}
    >
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isMine ? "bg-[#00BFA5]/20" : "bg-[#003B44]/12"
          }`}
      >
        <FileText size={18} className={isMine ? "text-[#00BFA5]" : "text-[#003B44]"} />
      </div>
      <p
        className={`min-w-0 flex-1 truncate text-sm font-medium leading-tight ${isMine ? "text-light/95" : "text-[#003B44]"
          }`}
        title={displayName}
      >
        {displayName}
      </p>
    </button>
  );
}

export function MessageAvatarPlaceholder() {
  return <div className="h-8 w-8 shrink-0" aria-hidden="true" />;
}

export function SeenReceipt({ user: peer }) {
  const initial = (peer?.firstName || peer?.email || "?")[0]?.toUpperCase();

  return (
    <div className="mr-10 mt-px flex items-center justify-end gap-0.5 self-end">
      {peer?.avatar ? (
        <img
          src={peer.avatar}
          alt=""
          className="h-3 w-3 shrink-0 rounded-full object-cover ring-1 ring-[#00BFA5]/30"
        />
      ) : (
        <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-[#003B44]/12 text-[6px] font-semibold leading-none text-[#003B44]/65">
          {initial}
        </span>
      )}
      <span className="text-[8px] leading-none text-[#003B44]/40">Đã xem</span>
    </div>
  );
}

export function TinySeenAvatar({ user }) {
  const initial = ((user?.firstName || "").trim() || user?.email || "?")[0]?.toUpperCase();

  if (user?.avatar) {
    return (
      <img
        src={user.avatar}
        alt=""
        className="h-3 w-3 shrink-0 rounded-full object-cover ring-1 ring-white"
      />
    );
  }

  return (
    <span
      className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full text-[6px] font-semibold leading-none ring-1 ring-white text-white"
      style={{ backgroundColor: "#003B44" }}
    >
      {initial}
    </span>
  );
}

export function GroupSeenAvatars({ viewers }) {
  if (!viewers?.length) return null;

  return (
    <div className="mr-10 mt-px flex flex-wrap items-center justify-end gap-px self-end">
      {viewers.map((viewer) => (
        <TinySeenAvatar key={String(viewer._id)} user={viewer} />
      ))}
    </div>
  );
}

export function MessageMoreMenu({ isMine, onUnsend, onRemoveForMe, onClose, align = "right" }) {
  return (
    <div
      className={`absolute bottom-full z-50 mb-2 min-w-[200px] overflow-hidden rounded-xl bg-white py-1.5 shadow-xl ${align === "left" ? "left-0" : "right-0"
        }`}
      data-message-action
      role="menu"
      onClick={(e) => e.stopPropagation()}
    >
      {isMine ? (
        <button
          type="button"
          role="menuitem"
          className="block w-full px-4 py-2.5 text-left text-sm text-[#003B44] transition hover:bg-gray-100"
          onClick={() => {
            onUnsend?.();
            onClose?.();
          }}
        >
          Thu hồi
        </button>
      ) : null}
      <button
        type="button"
        role="menuitem"
        className="block w-full px-4 py-2.5 text-left text-sm text-[#003B44] transition hover:bg-gray-100"
        onClick={() => {
          onRemoveForMe?.();
          onClose?.();
        }}
      >
        Xóa ở phía tôi
      </button>
    </div>
  );
}

export function MessageActionBar({ message, isMine, onReply, onUnsend, onRemoveForMe }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e) => {
      if (menuWrapRef.current?.contains(e.target)) return;
      setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  if (message.isRecalled || message.pending) return null;

  const btnClass = `relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-primary/75 transition-all duration-200 opacity-0 pointer-events-none hover:bg-gray-200 hover:text-primary group-hover/message-row:pointer-events-auto group-hover/message-row:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 ${menuOpen ? "pointer-events-auto opacity-100" : ""
    }`;

  return (
    <div className="relative z-10 flex shrink-0 items-center gap-0.5 self-center" data-message-action>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onReply?.(message);
        }}
        className={btnClass}
        aria-label="Trả lời"
        title="Trả lời"
      >
        <Reply size={14} />
      </button>
      <div className="relative" ref={menuWrapRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((o) => !o);
          }}
          className={btnClass}
          aria-label="Tuỳ chọn khác"
          aria-expanded={menuOpen}
          title="Tuỳ chọn"
        >
          <MoreVertical size={14} />
        </button>
        {menuOpen ? (
          <MessageMoreMenu
            isMine={isMine}
            align={isMine ? "right" : "left"}
            onUnsend={() => onUnsend?.(message)}
            onRemoveForMe={() => onRemoveForMe?.(message)}
            onClose={() => setMenuOpen(false)}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Thanh chọn cảm xúc (Reaction Bar) - Hiển thị khi nhấn nút Smile.
 * 
 * HIGHLIGHT EMOJI ĐÃ CHỌN:
 * Nếu người dùng hiện tại đã thả một emoji nào đó vào tin nhắn này (currentUserEmoji),
 * emoji tương ứng trong thanh chọn sẽ có nền Cyan nhạt (bg-[#00BFA5]/20) và viền nhấn mạnh
 * để người dùng nhận diện ngay emoji mình đã chọn trước đó.
 */
export function ReactionBar({ onReact, onClose, currentUserEmoji }) {
  const barRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (barRef.current && !barRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={barRef}
      className="absolute -top-11 left-1/2 z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-[#003B44]/10 bg-white px-2 py-1.5 shadow-xl animate-[fadeInUp_0.18s_ease-out]"
      data-message-action
      onClick={(e) => e.stopPropagation()}
    >
      {REACTION_EMOJIS.map((emoji) => {
        // Kiểm tra xem emoji này có trùng với emoji mà người dùng hiện tại đã thả không
        const isActive = currentUserEmoji === emoji;
        return (
          <button
            key={emoji}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReact(emoji);
              onClose?.();
            }}
            className={`flex h-8 w-8 items-center justify-center rounded-full text-lg transition-all duration-150 hover:scale-125 active:scale-95 ${
              isActive
                ? "bg-[#00BFA5]/20 ring-2 ring-[#00BFA5]/30 scale-110"
                : "hover:bg-[#003B44]/5"
            }`}
            aria-label={`Thả cảm xúc ${emoji}`}
          >
            {emoji}
          </button>
        );
      })}
    </div>
  );
}

export function ReactionDetailsModal({ reactions, onClose }) {
  const [activeTab, setActiveTab] = useState("all");
  const modalRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [onClose]);

  if (!reactions?.length) return null;

  // Lấy ra danh sách các emoji độc nhất để tạo tab lọc
  const emojiCounts = new Map();
  reactions.forEach((r) => {
    emojiCounts.set(r.emoji, (emojiCounts.get(r.emoji) || 0) + 1);
  });
  const uniqueEmojis = Array.from(emojiCounts.keys());

  // Lọc cảm xúc dựa trên tab đang hoạt động
  const filteredReactions = activeTab === "all"
    ? reactions
    : reactions.filter((r) => r.emoji === activeTab);

  const getAvatarText = (user) => {
    const base = user?.firstName || user?.lastName || user?.email || "?";
    return base.charAt(0).toUpperCase();
  };

  /**
   * SỬ DỤNG createPortal ĐỂ RENDER MODAL RA NGOÀI CÂY COMPONENT HIỆN TẠI
   * 
   * Vấn đề: Modal cảm xúc nằm bên trong MessageItem → MessageList → ChatWindow,
   * nơi mà ChatInput (z-10) và ChatHeader (z-10) tạo ra ngữ cảnh xếp chồng riêng (Stacking Context).
   * Dù Modal có z-50, nó vẫn bị kẹt bên dưới các phần tử có z-index cao hơn trong cùng ngữ cảnh cha.
   * 
   * Giải pháp: Sử dụng createPortal để render Modal trực tiếp vào document.body,
   * thoát hoàn toàn khỏi mọi Stacking Context và đảm bảo z-[999] phủ kín toàn bộ màn hình.
   */
  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/40 backdrop-blur-[1px] p-4 transition-all duration-200" onClick={onClose}>
      <div
        ref={modalRef}
        className="flex max-h-[380px] w-full max-w-sm flex-col rounded-2xl border border-[#003B44]/8 bg-white p-5 shadow-2xl animate-[fadeInUp_0.18s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tiêu đề Modal */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="text-sm font-extrabold text-[#003B44]">Cảm xúc tin nhắn</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-[#003B44]/65 hover:bg-gray-100 transition"
            aria-label="Đóng"
          >
            <X size={16} />
          </button>
        </div>

        {/* Bộ lọc tab cảm xúc */}
        <div className="flex gap-2 border-b border-gray-50 py-2.5 overflow-x-auto scrollbar-thin">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold transition-all duration-150 ${
              activeTab === "all"
                ? "bg-[#003B44] text-[#00BFA5] shadow-sm"
                : "bg-gray-100 text-[#003B44]/75 hover:bg-gray-200"
            }`}
          >
            Tất cả ({reactions.length})
          </button>
          {uniqueEmojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => setActiveTab(emoji)}
              className={`flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold transition-all duration-150 ${
                activeTab === emoji
                  ? "bg-[#003B44] text-[#00BFA5] shadow-sm"
                  : "bg-gray-100 text-[#003B44]/75 hover:bg-gray-200"
              }`}
            >
              <span>{emoji}</span>
              <span className="text-[10px] opacity-75">{emojiCounts.get(emoji)}</span>
            </button>
          ))}
        </div>

        {/* Danh sách người dùng đã thả cảm xúc */}
        <div className="flex-1 overflow-y-auto mt-3 pr-1 space-y-2.5 scrollbar-thin">
          {filteredReactions.map((r, idx) => {
            const user = r.user || {};
            const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Thành viên";
            const initial = getAvatarText(user);

            return (
              <div key={idx} className="flex items-center justify-between gap-3 rounded-xl hover:bg-gray-50/50 p-1.5 transition duration-150">
                <div className="flex items-center gap-2.5 min-w-0">
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt=""
                      className="h-8 w-8 rounded-full object-cover ring-1 ring-[#00BFA5]/10"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#003B44]/8 text-xs font-bold text-[#003B44] ring-1 ring-[#003B44]/5">
                      {initial}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-[#003B44]">{fullName}</p>
                    <p className="truncate text-[10px] text-[#003B44]/45 mt-0.5">{user.email}</p>
                  </div>
                </div>
                <span className="text-base select-none leading-none pr-1">{r.emoji}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

/**
 * Nhãn cảm xúc dạng viên thuốc (Pill Badge) hiển thị dưới bong bóng chat.
 * 
 * HIGHLIGHT KHI NGƯỜI DÙNG HIỆN TẠI ĐÃ THAM GIA THẢ CẢM XÚC:
 * Nếu currentUserId nằm trong danh sách reactions, nhãn cảm xúc sẽ chuyển sang 
 * nền Cyan cực nhạt (bg-[#00BFA5]/10) và viền Cyan (ring-[#00BFA5]/40) 
 * thay vì nền trắng và viền trắng mặc định, giúp người dùng nhận diện ngay.
 */
export function ReactionDisplay({ reactions, onClick, isMine, currentUserId }) {
  if (!reactions?.length) return null;

  // Gom các emoji độc nhất và tính số lượng
  const emojiCountMap = new Map();
  reactions.forEach((r) => {
    const key = r.emoji;
    emojiCountMap.set(key, (emojiCountMap.get(key) || 0) + 1);
  });

  const uniqueEmojis = Array.from(emojiCountMap.keys()).slice(0, 3);
  const totalCount = reactions.length;

  // Kiểm tra xem người dùng hiện tại có nằm trong danh sách thả cảm xúc không
  const iReacted = currentUserId && reactions.some(
    (r) => String(r.user?._id || r.user) === String(currentUserId)
  );

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs shadow-sm ring-2 hover:shadow-md hover:scale-105 active:scale-95 transition-all duration-150 cursor-pointer ${
        iReacted
          ? "bg-[#00BFA5]/10 border-[#00BFA5]/30 ring-[#00BFA5]/25"
          : "bg-white border-[#003B44]/10 ring-white"
      }`}
      title={`${totalCount} người đã thả cảm xúc`}
    >
      <div className="flex -space-x-1 items-center">
        {uniqueEmojis.map((emoji) => (
          <span key={emoji} className="text-xs leading-none select-none">{emoji}</span>
        ))}
      </div>
      {totalCount > 1 && (
        <span className={`text-[10px] font-bold select-none pl-0.5 ${
          iReacted ? "text-[#00BFA5]" : "text-[#003B44]/75"
        }`}>
          {totalCount}
        </span>
      )}
    </button>
  );
}

export function ReplyQuote({ replyTo, isMine, onJump, currentUserId, friend, memberMap, nicknames }) {
  if (!replyTo?._id) return null;

  const name = replyAuthorName(replyTo, currentUserId, { friend, memberMap, nicknames });
  const preview = replyContentLabel(replyTo);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onJump?.(replyTo._id);
      }}
      className={`mb-1.5 w-full max-w-full rounded-md border-l-[3px] border-[#00BFA5] px-2.5 py-1.5 text-left transition hover:opacity-90 ${isMine ? "bg-black/15" : "bg-[#003B44]/[0.07]"
        }`}
    >
      <p className="truncate text-[11px] font-semibold text-[#00BFA5]">{name}</p>
      <p className={`truncate text-[11px] ${isMine ? "text-light/75" : "text-[#003B44]/55"}`}>{preview}</p>
    </button>
  );
}

/**
 * Component MessageItem (trước đây là MessageRow)
 * Hiển thị bong bóng tin nhắn đơn lẻ kèm avatar, cảm xúc, menu chọn và quotes trả lời.
 */
function MessageItem({
  message,
  isMine,
  hoverTime,
  onOpenImage,
  avatarUser,
  senderLabel,
  isGroupChat,
  isFirstInGroup,
  isLastInGroup,
  readReceiptUser,
  onUnsend,
  onRemoveForMe,
  onReply,
  onScrollToReply,
  currentUserId,
  friend,
  memberMap,
  showSeenReceipt,
  groupSeenViewers,
  seenAvatars = [],
  onReact,
  nicknames
}) {
  const [showReactionBar, setShowReactionBar] = useState(false);
  const [showReactionModal, setShowReactionModal] = useState(false);

  if (message.isRecalled) {
    const recalledRadius = getGroupedBubbleRadius(isMine, isFirstInGroup, isLastInGroup);
    const recalledBubble = (
      <div
        className={`min-w-0 max-w-[80%] px-3.5 py-2.5 text-sm italic shadow-sm ${recalledRadius} ${isMine ? "bg-[#003B44]/75 text-light/80" : "bg-gray-200 text-[#003B44]/55"
          }`}
      >
        {RECALLED_TEXT}
      </div>
    );

    const avatarSlot = isLastInGroup ? (
      <UserAvatar user={avatarUser} size="xs" className="shrink-0 ring-1 ring-primary/15" alt="" />
    ) : (
      <MessageAvatarPlaceholder />
    );

    if (isMine) {
      return (
        <div className="group flex w-full flex-col items-end">
          <div className="flex max-w-[min(92%,480px)] flex-row items-end gap-1.5">
            {hoverTime ? (
              <span className="shrink-0 self-end pb-1 text-[10px] leading-none tabular-nums text-primary/35 opacity-0 transition-opacity duration-150 group-hover/message-row:opacity-100 group-hover:opacity-100">
                {hoverTime}
              </span>
            ) : null}
            {recalledBubble}
            {avatarSlot}
          </div>
          {seenAvatars && seenAvatars.length > 0 ? (
            <div className="mr-10 mt-px flex flex-wrap items-center justify-end gap-px self-end">
              {seenAvatars.map((viewer) => (
                <TinySeenAvatar key={String(viewer._id)} user={viewer} />
              ))}
            </div>
          ) : null}
        </div>
      );
    }

    const recalledSenderName =
      !isMine && isGroupChat && isFirstInGroup && senderLabel ? (
        <p className="mb-0.5 max-w-[min(92%,480px)] truncate px-1 text-[10px] font-medium text-[#003B44]/55">
          {senderLabel}
        </p>
      ) : null;

    return (
      <div className="group flex w-full flex-col items-start gap-0">
        <div className="flex max-w-[min(92%,480px)] flex-row items-end gap-1.5">
          {avatarSlot}
          <div className="flex min-w-0 flex-col items-start">
            {recalledSenderName}
            {recalledBubble}
          </div>
          {hoverTime ? (
            <span className="shrink-0 self-end pb-1 text-[10px] leading-none tabular-nums text-primary/35 opacity-0 transition-opacity duration-150 group-hover/message-row:opacity-100">
              {hoverTime}
            </span>
          ) : null}
        </div>
        {seenAvatars && seenAvatars.length > 0 ? (
          <div className="mt-px flex flex-wrap items-center justify-end gap-px w-full pr-10">
            {seenAvatars.map((viewer) => (
              <TinySeenAvatar key={String(viewer._id)} user={viewer} />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  const hasImage = message.fileType === "image" && message.fileUrl;
  const hasFile = message.fileType === "file" && message.fileUrl;
  const hasText = Boolean(message.content?.trim());
  const pendingClass = message.pending ? "opacity-90" : "";

  if (!hasImage && !hasFile && !hasText) return null;

  const bubbleRadius = getGroupedBubbleRadius(isMine, isFirstInGroup, isLastInGroup);
  const bubbleClass = isMine
    ? `min-w-0 max-w-full ${bubbleRadius} bg-primary px-3.5 py-2.5 text-sm text-light shadow-sm ${pendingClass}`
    : `min-w-0 max-w-full ${bubbleRadius} bg-gray-100 px-3.5 py-2.5 text-sm text-primary shadow-sm ${pendingClass}`;

  const avatarSlot = isLastInGroup ? (
    <UserAvatar user={avatarUser} size="xs" className="shrink-0 ring-1 ring-primary/15" alt="" />
  ) : (
    <MessageAvatarPlaceholder />
  );

  const hoverTimeAside = hoverTime ? (
    <span className="shrink-0 self-end pb-1 text-[10px] leading-none tabular-nums text-primary/35 opacity-0 transition-opacity duration-150 group-hover/message-row:opacity-100 group-hover:opacity-100">
      {hoverTime}
    </span>
  ) : null;

  const actionBar = (
    <MessageActionBar
      message={message}
      isMine={isMine}
      onReply={onReply}
      onUnsend={onUnsend}
      onRemoveForMe={onRemoveForMe}
    />
  );

  const reactionTrigger = !message.isRecalled && !message.pending ? (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowReactionBar((v) => !v);
        }}
        className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-primary/60 transition-all duration-200 opacity-0 pointer-events-none hover:bg-[#00BFA5]/10 hover:text-[#00BFA5] group-hover/message-row:pointer-events-auto group-hover/message-row:opacity-100 ${showReactionBar ? "pointer-events-auto opacity-100 bg-[#00BFA5]/10 text-[#00BFA5]" : ""
          }`}
        aria-label="Thả cảm xúc"
        title="Thả cảm xúc"
      >
        <Smile size={14} />
      </button>
      {showReactionBar ? (
        <ReactionBar
          onReact={(emoji) => onReact?.(message, emoji)}
          onClose={() => setShowReactionBar(false)}
          currentUserEmoji={
            // Tìm emoji mà người dùng hiện tại đã thả vào tin nhắn này (nếu có)
            (message.reactions || []).find(
              (r) => String(r.user?._id || r.user) === String(currentUserId)
            )?.emoji || null
          }
        />
      ) : null}
    </div>
  ) : null;

  const reactionDisplay = (
    <ReactionDisplay
      reactions={message.reactions}
      onClick={() => setShowReactionModal(true)}
      isMine={isMine}
      currentUserId={currentUserId}
    />
  );

  const quoteEl = message.replyTo ? (
    <ReplyQuote
      replyTo={message.replyTo}
      isMine={isMine}
      onJump={onScrollToReply}
      currentUserId={currentUserId}
      friend={friend}
      memberMap={memberMap}
      nicknames={nicknames}
    />
  ) : null;

  const hasReactions = message.reactions && message.reactions.length > 0;

  const contentBubble = (
    <div className={`relative w-fit max-w-full ${hasReactions ? "pb-2.5" : ""}`}>
      {hasImage ? (
        <button
          type="button"
          onClick={() => onOpenImage(message.fileUrl)}
          className={`block overflow-hidden rounded-2xl border border-primary/5 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00BFA5]/50 ${pendingClass}`}
          aria-label="Mở ảnh lớn"
        >
          <img
            src={message.fileUrl}
            alt={message.fileName || "Ảnh đính kèm"}
            className="max-h-[300px] max-w-full object-contain"
          />
        </button>
      ) : null}
      {hasFile ? (
        <FileAttachmentBubble
          url={message.fileUrl}
          fileName={message.fileName}
          variant={isMine ? "mine" : "received"}
        />
      ) : null}
      {hasText ? (
        <div className={bubbleClass}>
          {quoteEl && (hasText || (!hasImage && !hasFile)) ? quoteEl : null}
          <p className="break-all whitespace-pre-wrap [overflow-wrap:anywhere] leading-snug">{message.content}</p>
        </div>
      ) : null}

      {/* 
        GIẢI THÍCH: ĐỊNH VỊ NHÃN CẢM XÚC BÁM DÍNH CONTAINER BONG BÓNG CHAT DÙNG ABSOLUTE VÀ TRANSLATE
        
        Để nhãn cảm xúc bám dính vào viền dưới của bong bóng chat theo đúng phong cách Messenger (Messenger Style):
        1. Thẻ wrapper chứa bong bóng chat (`contentBubble`) được thiết lập thuộc tính `relative` để làm mốc tọa độ.
        2. Nhãn cảm xúc được đặt ở trạng thái `absolute` bám sát cạnh dưới (`bottom-0`).
        3. Sử dụng `translate-y-1/2` (dịch chuyển trục Y đi 50% chiều cao của chính nhãn cảm xúc) để nhãn nằm đè chính giữa
           lên đường biên dưới của bong bóng chat một cách cân đối và đẹp mắt.
        4. Đối với tin nhắn của bạn bè (bên trái): Nhãn cảm xúc nằm sát góc phải (`right-3`), thụt vào trong một chút (12px) để không bị trôi ra ngoài.
        5. Đối với tin nhắn của mình (bên phải): Nhãn cảm xúc nằm sát góc trái (`left-3`), thụt vào trong một chút (12px) để cân đối.
        6. Để tránh việc nhãn cảm xúc đè lên các tin nhắn hay dòng thời gian bên dưới, chúng tôi tăng nhẹ padding-bottom (`pb-2.5`) 
           cho container khi có cảm xúc, tạo không gian hiển thị cực kỳ tự nhiên.
        7. Nhãn cảm xúc sử dụng `ring-2 ring-white` tạo viền trắng bao quanh giúp nhãn "nổi khối" tách biệt rõ ràng khỏi bong bóng chat.
      */}
      {hasReactions && (
        <div
          className={`absolute bottom-0 translate-y-1/2 z-20 flex items-center gap-1 ${
            isMine ? "left-3" : "right-3"
          }`}
        >
          {reactionDisplay}
        </div>
      )}
    </div>
  );

  const messageBody = (
    <div className={`flex w-fit min-w-0 max-w-[80%] flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}>
      {quoteEl && (hasImage || hasFile) && !hasText ? quoteEl : null}
      {contentBubble}
      {!hasText && quoteEl && !hasImage && !hasFile ? quoteEl : null}
    </div>
  );

  const senderNameEl =
    !isMine && isGroupChat && isFirstInGroup && senderLabel ? (
      <p className="mb-0.5 max-w-[min(92%,480px)] truncate px-1 text-[10px] font-medium text-[#003B44]/55">{senderLabel}</p>
    ) : null;

  /**
   * CẤP PHÁT KHÔNG GIAN ĐỆM (Spacing Allocation) CHO NHÃN CẢM XÚC
   * 
   * Vì nhãn cảm xúc sử dụng `absolute` + `translate-y-1/2`, phần thân của nó tràn ra ngoài 
   * bounding box của bong bóng chat và đè lên dòng tin nhắn tiếp theo phía dưới.
   * 
   * Giải pháp: Khi tin nhắn có cảm xúc (`hasReactions === true`), chúng ta thêm `mb-4` 
   * (margin-bottom: 16px) vào thẻ wrapper ngoài cùng của dòng tin nhắn đó.
   * Khoảng cách đệm này tạo ra vùng trống vừa đủ bên dưới để nhãn cảm xúc nằm gọn gàng 
   * mà không chạm vào Avatar hay nội dung của dòng tin nhắn kế tiếp.
   */
  if (isMine) {
    return (
      <>
        <div className={`group flex w-full flex-col items-end ${hasReactions ? "mb-4" : ""}`}>
          <div className="flex max-w-[min(92%,480px)] flex-row items-end gap-1.5">
            <div className="flex shrink-0 items-center gap-0.5 self-end">
              {hoverTimeAside}
              {reactionTrigger}
              {actionBar}
            </div>
            {messageBody}
            {avatarSlot}
          </div>
          {seenAvatars && seenAvatars.length > 0 ? (
            <div className="mr-10 mt-px flex flex-wrap items-center justify-end gap-px self-end">
              {seenAvatars.map((viewer) => (
                <TinySeenAvatar key={String(viewer._id)} user={viewer} />
              ))}
            </div>
          ) : null}
        </div>
        {showReactionModal && (
          <ReactionDetailsModal
            reactions={message.reactions}
            onClose={() => setShowReactionModal(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className={`group flex w-full flex-col items-start gap-0 ${hasReactions ? "mb-4" : ""}`}>
        <div className="flex max-w-[min(92%,480px)] flex-row items-end gap-1.5">
          {avatarSlot}
          <div className="flex min-w-0 flex-col items-start">
            {senderNameEl}
            <div className="flex items-end gap-0.5">
              {messageBody}
              <div className="flex shrink-0 items-center gap-0.5 self-end">
                {reactionTrigger}
                {actionBar}
                {hoverTimeAside}
              </div>
            </div>
          </div>
        </div>
        {seenAvatars && seenAvatars.length > 0 ? (
          <div className="mt-px flex flex-wrap items-center justify-end gap-px w-full pr-10">
            {seenAvatars.map((viewer) => (
              <TinySeenAvatar key={String(viewer._id)} user={viewer} />
            ))}
          </div>
        ) : null}
      </div>
      {showReactionModal && (
        <ReactionDetailsModal
          reactions={message.reactions}
          onClose={() => setShowReactionModal(false)}
        />
      )}
    </>
  );
}

export default MessageItem;
