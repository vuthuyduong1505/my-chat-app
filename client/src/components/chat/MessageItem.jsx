import React, { useState, useEffect, useRef } from "react";
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
  const initial = (user?.firstName || user?.email || "?")[0]?.toUpperCase();

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
    <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-[#003B44]/12 text-[6px] font-semibold leading-none text-[#003B44]/70 ring-1 ring-white">
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

export function ReactionBar({ onReact, onClose }) {
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
      {REACTION_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onReact(emoji);
            onClose?.();
          }}
          className="flex h-8 w-8 items-center justify-center rounded-full text-lg transition-transform duration-150 hover:scale-125 hover:bg-[#003B44]/5 active:scale-95"
          aria-label={`Thả cảm xúc ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

export function ReactionDisplay({ reactions, onReact, isMine }) {
  if (!reactions?.length) return null;

  const emojiCountMap = new Map();
  reactions.forEach((r) => {
    const key = r.emoji;
    emojiCountMap.set(key, (emojiCountMap.get(key) || 0) + 1);
  });

  const grouped = Array.from(emojiCountMap.entries())
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className={`mt-0.5 flex flex-wrap gap-1 ${isMine ? "justify-end" : "justify-start"}`}>
      {grouped.map(({ emoji, count }) => (
        <button
          key={emoji}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onReact?.(emoji);
          }}
          className="flex items-center gap-0.5 rounded-full border border-[#003B44]/10 bg-white px-1.5 py-0.5 text-xs shadow-sm transition-all duration-150 hover:border-[#00BFA5]/40 hover:shadow-md active:scale-95"
          title={`${count} người đã thả ${emoji}`}
        >
          <span className="text-sm leading-none">{emoji}</span>
          {count > 1 ? (
            <span className="text-[10px] font-semibold tabular-nums text-[#003B44]/60">{count}</span>
          ) : null}
        </button>
      ))}
    </div>
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
  onReact,
  nicknames
}) {
  const [showReactionBar, setShowReactionBar] = useState(false);

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
          {showSeenReceipt ? <SeenReceipt user={readReceiptUser} /> : null}
          {isGroupChat && isMine && groupSeenViewers?.length ? (
            <GroupSeenAvatars viewers={groupSeenViewers} />
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
      <div className="group flex max-w-[min(92%,480px)] flex-row items-end gap-1.5">
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
        />
      ) : null}
    </div>
  ) : null;

  const reactionDisplay = (
    <ReactionDisplay
      reactions={message.reactions}
      onReact={(emoji) => onReact?.(message, emoji)}
      isMine={isMine}
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

  const messageBody = (
    <div className={`flex w-fit min-w-0 max-w-[80%] flex-col gap-1 ${isMine ? "items-end" : "items-start"}`}>
      {quoteEl && (hasImage || hasFile) && !hasText ? quoteEl : null}
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
      {!hasText && quoteEl && !hasImage && !hasFile ? quoteEl : null}
    </div>
  );

  const senderNameEl =
    !isMine && isGroupChat && isFirstInGroup && senderLabel ? (
      <p className="mb-0.5 max-w-[min(92%,480px)] truncate px-1 text-[10px] font-medium text-[#003B44]/55">{senderLabel}</p>
    ) : null;

  if (isMine) {
    return (
      <div className="group flex w-full flex-col items-end">
        <div className="flex max-w-[min(92%,480px)] flex-row items-end gap-1.5">
          <div className="flex shrink-0 items-center gap-0.5 self-end">
            {hoverTimeAside}
            {reactionTrigger}
            {actionBar}
          </div>
          {messageBody}
          {avatarSlot}
        </div>
        {reactionDisplay}
        {showSeenReceipt ? <SeenReceipt user={readReceiptUser} /> : null}
        {isGroupChat && groupSeenViewers?.length ? <GroupSeenAvatars viewers={groupSeenViewers} /> : null}
      </div>
    );
  }

  return (
    <div className="group flex max-w-[min(92%,480px)] flex-col items-start gap-0">
      <div className="flex w-full flex-row items-end gap-1.5">
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
      <div className="pl-10">{reactionDisplay}</div>
    </div>
  );
}

export default MessageItem;
