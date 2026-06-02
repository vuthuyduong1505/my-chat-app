import React from "react";
import { Loader2 } from "lucide-react";
import MessageItem from "./MessageItem";
import { useAuth } from "../../context/AuthContext";
import {
  isSystemMessage,
  isSameDate,
  formatVietnameseChatTime,
  formatHoverTime,
  resolveMessageAvatar,
  groupBubbleSenderName,
  getMessageGroupPosition,
  isMessageMine
} from "./chatUtils";

/**
 * Component MessageList
 * Chứa vùng cuộn tin nhắn, xử lý logic gom nhóm tin nhắn, hiển thị tin nhắn hệ thống
 * và phân tách mốc thời gian (Timestamp Separator).
 */
function MessageList({
  visibleMessages,
  loadingHistory,
  isGroupChat,
  currentUserId,
  friend,
  memberMap,
  localNicknames,
  lastMyMessageId,
  groupSeenAvatarMap,
  messageRefs,
  bottomRef,
  setLightboxUrl,
  handleUnsendMessage,
  handleRemoveForMe,
  handleReplyToMessage,
  scrollToMessage,
  handleSendReaction
}) {
  const { user } = useAuth();

  return (
    <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5">
        {loadingHistory ? (
          <div className="flex justify-center py-10 text-primary/45">
            <Loader2 className="animate-spin" size={22} />
          </div>
        ) : visibleMessages.length === 0 ? (
          <p className="py-8 text-center text-sm text-primary/45">Chưa có tin nhắn nào</p>
        ) : (
          visibleMessages.map((m, index) => {
            const previousMessage = index > 0 ? visibleMessages[index - 1] : null;
            const nextMessage = index < visibleMessages.length - 1 ? visibleMessages[index + 1] : null;

            /*
             * Tin nhắn hệ thống (messageType === 'system'): hiển thị giữa khung chat,
             * không avatar / bong bóng / menu xóa-trả lời — do server tạo khi có sự kiện nhóm.
             */
            if (isSystemMessage(m)) {
              const currentDate = new Date(m.createdAt);
              const previousDate = previousMessage ? new Date(previousMessage.createdAt) : null;
              const hasValidCurrentDate = !Number.isNaN(currentDate.getTime());
              const hasValidPreviousDate = previousDate && !Number.isNaN(previousDate.getTime());
              const isFirstMessage = index === 0;
              const isNewDay =
                hasValidCurrentDate && hasValidPreviousDate
                  ? !isSameDate(currentDate, previousDate)
                  : false;
              const isOverThirtyMinutes =
                hasValidCurrentDate && hasValidPreviousDate
                  ? currentDate.getTime() - previousDate.getTime() > 30 * 60 * 1000
                  : false;
              const shouldShowTimestampSeparator = isFirstMessage || isNewDay || isOverThirtyMinutes;
              const separatorText = formatVietnameseChatTime(m.createdAt);

              return (
                <div key={String(m._id)} className="my-5 scroll-mt-4">
                  {shouldShowTimestampSeparator && separatorText ? (
                    <div className="mb-4 text-center text-[11px] text-primary/40">{separatorText}</div>
                  ) : null}
                  <div className="flex justify-center px-2">
                    <p className="max-w-[min(100%,320px)] text-center text-xs leading-relaxed text-gray-400">
                      {m.content}
                    </p>
                  </div>
                </div>
              );
            }

            const isMine = isMessageMine(m, currentUserId);

            // So sánh prevMessage / nextMessage để biết tin đứng đầu hay cuối nhóm gom
            const { isFirstInGroup, isLastInGroup } = getMessageGroupPosition(
              m,
              previousMessage,
              nextMessage
            );

            const currentDate = new Date(m.createdAt);
            const previousDate = previousMessage ? new Date(previousMessage.createdAt) : null;

            const hasValidCurrentDate = !Number.isNaN(currentDate.getTime());
            const hasValidPreviousDate = previousDate && !Number.isNaN(previousDate.getTime());
            const isFirstMessage = index === 0;
            const isNewDay =
              hasValidCurrentDate && hasValidPreviousDate ? !isSameDate(currentDate, previousDate) : false;
            const isOverThirtyMinutes =
              hasValidCurrentDate && hasValidPreviousDate
                ? currentDate.getTime() - previousDate.getTime() > 30 * 60 * 1000
                : false;
            const shouldShowTimestampSeparator = isFirstMessage || isNewDay || isOverThirtyMinutes;
            const separatorText = formatVietnameseChatTime(m.createdAt);
            const hoverTime = formatHoverTime(m.createdAt);
            const avatarUser = resolveMessageAvatar(m, isMine, {
              user,
              friend,
              memberMap,
              currentUserId,
              isGroupChat
            });
            const peerUser = avatarUser;
            const senderLabel =
              !isMine && isGroupChat && isFirstInGroup
                ? groupBubbleSenderName(m, peerUser, localNicknames)
                : null;

            // mt-0.5 trong cùng nhóm; mt-4 khi bắt đầu nhóm mới (khác người gửi / > 30 phút)
            const groupSpacingClass = isFirstInGroup && index > 0 ? "mt-4" : !isFirstInGroup ? "mt-0.5" : "";

            return (
              <div
                key={String(m._id)}
                ref={(el) => {
                  if (el) messageRefs.current[String(m._id)] = el;
                }}
                className={`w-full scroll-mt-4 transition-[box-shadow] duration-300 ${groupSpacingClass}`}
              >
                {shouldShowTimestampSeparator && separatorText ? (
                  <div className="my-4 text-center text-[11px] text-primary/40">{separatorText}</div>
                ) : null}

                <div
                  className={`group/message-row group flex w-full ${isMine ? "justify-end" : "justify-start"}`}
                  data-message-row-root
                >
                  <MessageItem
                    message={m}
                    isMine={isMine}
                    isFirstInGroup={isFirstInGroup}
                    isLastInGroup={isLastInGroup}
                    hoverTime={hoverTime}
                    onOpenImage={setLightboxUrl}
                    avatarUser={avatarUser}
                    senderLabel={senderLabel}
                    isGroupChat={isGroupChat}
                    readReceiptUser={!isGroupChat ? friend : null}
                    onUnsend={handleUnsendMessage}
                    onRemoveForMe={handleRemoveForMe}
                    onReply={handleReplyToMessage}
                    onScrollToReply={scrollToMessage}
                    onReact={handleSendReaction}
                    currentUserId={currentUserId}
                    friend={friend}
                    memberMap={memberMap}
                    showSeenReceipt={
                      !isGroupChat &&
                      isMine &&
                      lastMyMessageId === String(m._id) &&
                      Boolean(m.isRead) &&
                      !m.pending
                    }
                    groupSeenViewers={
                      isGroupChat && isMine ? groupSeenAvatarMap.get(String(m._id)) || [] : []
                    }
                    nicknames={localNicknames}
                  />
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

export default MessageList;
