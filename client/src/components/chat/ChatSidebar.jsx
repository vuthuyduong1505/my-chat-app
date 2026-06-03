import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Image,
  FileText,
  Loader2,
  Camera,
  Edit2,
  UserPlus,
  MoreVertical,
  MessageCircle,
  UserMinus,
  LogOut
} from "lucide-react";
import GroupAvatar from "../GroupAvatar";
import UserAvatar from "../common/UserAvatar";
import api from "../../api";
import { getDisplayName } from "../../utils/displayName";
import { downloadFile, extractSharedMediaFromMessages } from "./chatUtils";

function memberFullName(member) {
  const name = `${member?.firstName || ""} ${member?.lastName || ""}`.trim();
  return name || member?.email || "Thành viên";
}

function personFullName(person) {
  const name = `${person?.firstName || ""} ${person?.lastName || ""}`.trim();
  return name || person?.email || "Người dùng";
}

export function ChatMediaGallerySection({ chatId, isGroupChat, messages, onOpenImage }) {
  const [accordionOpen, setAccordionOpen] = useState(false);
  const [mediaTab, setMediaTab] = useState("media");
  const [loading, setLoading] = useState(false);
  const [fetchedMedia, setFetchedMedia] = useState({ images: [], files: [] });

  const fromMessages = useMemo(() => extractSharedMediaFromMessages(messages), [messages]);

  const { images, files } = useMemo(() => {
    const imageMap = new Map();
    const fileMap = new Map();
    [...fetchedMedia.images, ...fromMessages.images].forEach((item) => imageMap.set(item._id, item));
    [...fetchedMedia.files, ...fromMessages.files].forEach((item) => fileMap.set(item._id, item));
    const byNewest = (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return {
      images: Array.from(imageMap.values()).sort(byNewest),
      files: Array.from(fileMap.values()).sort(byNewest)
    };
  }, [fetchedMedia, fromMessages]);

  useEffect(() => {
    setAccordionOpen(false);
    setMediaTab("media");
    setFetchedMedia({ images: [], files: [] });
  }, [chatId]);

  useEffect(() => {
    if (!accordionOpen || !chatId) return undefined;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const url = isGroupChat ? `/groups/${chatId}/media` : `/chat/${chatId}/media`;
        const res = await api.get(url);
        if (!cancelled) {
          setFetchedMedia({
            images: res.data?.images || [],
            files: res.data?.files || []
          });
        }
      } catch {
        if (!cancelled) setFetchedMedia({ images: [], files: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [accordionOpen, chatId, isGroupChat]);

  const emptyHint = "Chưa có tài nguyên nào được chia sẻ";

  return (
    <div className="border-b border-[#003B44]/8 py-2">
      <button
        type="button"
        onClick={() => setAccordionOpen((v) => !v)}
        className="flex w-full items-center justify-between px-6 py-4 text-left text-sm font-semibold text-[#003B44]"
      >
        <span>File phương tiện và File</span>
        <ChevronDown
          size={18}
          className={`text-[#00BFA5] transition-transform duration-200 ${accordionOpen ? "rotate-180" : ""}`}
        />
      </button>

      {accordionOpen ? (
        <div className="space-y-3 px-4 pb-6">
          <div className="flex gap-1 rounded-full bg-[#003B44]/5 p-1">
            <button
              type="button"
              onClick={() => setMediaTab("media")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-medium transition ${mediaTab === "media"
                ? "bg-[#003B44] text-[#00BFA5]"
                : "text-[#003B44]/55 hover:text-[#003B44]"
                }`}
            >
              <Image size={14} />
              File phương tiện
            </button>
            <button
              type="button"
              onClick={() => setMediaTab("files")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-medium transition ${mediaTab === "files"
                ? "bg-[#003B44] text-[#00BFA5]"
                : "text-[#003B44]/55 hover:text-[#003B44]"
                }`}
            >
              <FileText size={14} />
              File
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 size={20} className="animate-spin text-[#00BFA5]" />
            </div>
          ) : mediaTab === "media" ? (
            images.length === 0 ? (
              <p className="py-4 text-center text-xs text-[#003B44]/45">{emptyHint}</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {images.map((item) => (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => onOpenImage(item.fileUrl)}
                    className="aspect-square overflow-hidden rounded-xl ring-1 ring-[#003B44]/10 transition hover:ring-[#00BFA5]/50"
                  >
                    <img src={item.fileUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )
          ) : files.length === 0 ? (
            <p className="py-4 text-center text-xs text-[#003B44]/45">{emptyHint}</p>
          ) : (
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {files.map((item) => (
                <li key={item._id}>
                  <button
                    type="button"
                    onClick={() => downloadFile(item.fileUrl, item.fileName)}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-[#003B44]/5"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#003B44]/8 text-[#00BFA5]">
                      <FileText size={16} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-[#003B44]">
                      {item.fileName || "Tệp đính kèm"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Component ChatSidebar
 * Sidebar thông tin chi tiết cuộc trò chuyện bên phải (Messenger-style)
 */
function ChatSidebar({
  infoSidebarOpen,
  isGroupChat,
  activeGroup,
  chatTitle,
  chatSubtitle,
  updatingGroup,
  leavingGroup,
  visibleMessages,
  chatId,
  setLightboxUrl,
  currentUserId,
  friend,
  onlineUserSet,
  localNicknames,
  onChangeGroupAvatar,
  onShowRenameModal,
  onShowNicknameModal,
  onShowAddMembersModal,
  onShowLeaveConfirmModal,
  onRemoveMember,
  onNavigateToChat
}) {
  const navigate = useNavigate();
  const groupAvatarInputRef = useRef(null);
  const [membersAccordionOpen, setMembersAccordionOpen] = useState(true);
  const [activeMemberMenuId, setActiveMemberMenuId] = useState(null);

  const groupCreatorId = useMemo(() => {
    const raw = activeGroup?.creator;
    if (raw && typeof raw === "object") return String(raw._id || raw.id || "");
    if (activeGroup?.creatorId) return String(activeGroup.creatorId);
    if (raw) return String(raw);
    return "";
  }, [activeGroup]);

  useEffect(() => {
    setMembersAccordionOpen(true);
    setActiveMemberMenuId(null);
  }, [chatId]);

  useEffect(() => {
    if (!activeMemberMenuId) return undefined;
    const close = (e) => {
      if (e.target.closest("[data-member-menu]")) return;
      setActiveMemberMenuId(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [activeMemberMenuId]);

  const handleGroupAvatarPick = () => {
    groupAvatarInputRef.current?.click();
  };

  if (!chatId) return null;

  return (
    <aside
      className={`relative z-20 flex shrink-0 flex-col overflow-hidden border-l border-[#003B44]/8 bg-light/98 backdrop-blur-md transition-all duration-300 ease-out ${infoSidebarOpen ? "w-[min(100%,340px)] opacity-100" : "w-0 opacity-0 pointer-events-none border-l-0"
        }`}
      aria-hidden={!infoSidebarOpen}
    >
      <div className="flex h-full w-[min(100vw,340px)] flex-col overflow-y-auto rounded-l-2xl">
        {isGroupChat ? (
          <>
            <input
              ref={groupAvatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onChangeGroupAvatar}
            />
            <div className="flex flex-col items-center border-b border-[#003B44]/8 px-6 pb-8 pt-10 text-center">
              <div className="mb-4">
                <GroupAvatar group={activeGroup} size="lg" className="ring-3 ring-[#00BFA5]/15" />
              </div>
              <h3 className="max-w-full truncate text-lg font-bold tracking-tight text-[#003B44]">
                {chatTitle}
              </h3>
              <p className="mt-1.5 text-xs text-[#003B44]/45">{chatSubtitle}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={handleGroupAvatarPick}
                  disabled={updatingGroup}
                  className="inline-flex items-center gap-2 rounded-full border border-[#003B44]/10 bg-white px-4 py-2.5 text-xs font-medium text-[#003B44] shadow-sm transition hover:bg-[#003B44]/5 disabled:opacity-50"
                >
                  {updatingGroup ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} className="text-[#00BFA5]" />}
                  Thay đổi ảnh
                </button>
                <button
                  type="button"
                  onClick={onShowRenameModal}
                  disabled={updatingGroup}
                  className="inline-flex items-center gap-2 rounded-full border border-[#003B44]/10 bg-white px-4 py-2.5 text-xs font-medium text-[#003B44] shadow-sm transition hover:bg-[#003B44]/5 disabled:opacity-50"
                >
                  <Edit2 size={14} className="text-[#00BFA5]" />
                  Đổi tên
                </button>
              </div>
            </div>

            <div className="border-b border-[#003B44]/8 py-1">
              <button
                type="button"
                onClick={onShowNicknameModal}
                className="flex w-full items-center justify-between px-6 py-4 text-left text-sm font-semibold text-[#003B44] transition hover:bg-[#003B44]/5"
              >
                <span className="flex items-center gap-2">
                  <Edit2 size={16} className="text-[#00BFA5]" />
                  Chỉnh sửa biệt danh
                </span>
              </button>
            </div>

            <ChatMediaGallerySection
              chatId={chatId}
              isGroupChat
              messages={visibleMessages}
              onOpenImage={setLightboxUrl}
            />

            <div className="border-b border-[#003B44]/8 py-2">
              <button
                type="button"
                onClick={() => setMembersAccordionOpen((v) => !v)}
                className="flex w-full items-center justify-between px-6 py-4 text-left text-sm font-semibold text-[#003B44]"
              >
                <span>Thành viên</span>
                <ChevronDown
                  size={18}
                  className={`text-[#00BFA5] transition-transform duration-200 ${membersAccordionOpen ? "rotate-180" : ""}`}
                />
              </button>
              {membersAccordionOpen ? (
                <div className="space-y-3 px-4 pb-6">
                  <button
                    type="button"
                    onClick={onShowAddMembersModal}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-[#00BFA5]/40 bg-[#00BFA5]/[0.04] py-3 text-sm font-medium text-[#003B44] transition hover:bg-[#00BFA5]/10"
                  >
                    <UserPlus size={16} className="text-[#00BFA5]" />
                    Thêm người
                  </button>
                  <ul className="max-h-72 space-y-1 overflow-y-auto pr-1">
                    {(activeGroup?.members || []).map((member) => {
                      const mid = String(member._id || member.id);
                      const isCreator = mid === groupCreatorId;
                      const isOnline = onlineUserSet.has(mid);
                      const isMe = mid === String(currentUserId);
                      return (
                        <li
                          key={mid}
                          className="relative flex items-center gap-4 rounded-2xl px-3 py-3 transition hover:bg-[#003B44]/[0.04]"
                        >
                          <div className="relative shrink-0">
                            <UserAvatar user={member} size="sm" alt="" />
                            {isOnline ? (
                              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-light bg-[#00BFA5]" />
                            ) : null}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium leading-snug text-[#003B44]">
                              {memberFullName(member)}
                            </p>
                            {isCreator ? (
                              <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-[#00BFA5]/90">
                                Người tạo nhóm
                              </p>
                            ) : null}
                          </div>

                          <div className="relative shrink-0" data-member-menu>
                            <button
                              type="button"
                              onClick={() => setActiveMemberMenuId(activeMemberMenuId === mid ? null : mid)}
                              className="flex h-7 w-7 items-center justify-center rounded-full text-[#003B44]/60 hover:bg-[#003B44]/10 hover:text-[#003B44]"
                              aria-label="Tuỳ chọn thành viên"
                              aria-expanded={activeMemberMenuId === mid}
                            >
                              <MoreVertical size={14} />
                            </button>
                            {activeMemberMenuId === mid && (
                              <div className="absolute right-0 top-full z-50 mt-1 min-w-[150px] overflow-hidden rounded-xl border border-[#003B44]/10 bg-white py-1 shadow-lg shadow-[#003B44]/8 ring-1 ring-[#003B44]/5 animate-in fade-in slide-in-from-top-1 duration-150">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMemberMenuId(null);
                                    onNavigateToChat(mid);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-[#003B44] transition hover:bg-[#003B44]/5"
                                >
                                  <MessageCircle size={14} className="text-[#00BFA5]" />
                                  Nhắn tin
                                </button>

                                {String(currentUserId) === String(groupCreatorId) && !isMe && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMemberMenuId(null);
                                      onRemoveMember(mid);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-red-500 transition hover:bg-red-50"
                                  >
                                    <UserMinus size={14} className="text-red-500" />
                                    Xóa khỏi nhóm
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="mt-auto px-6 py-8">
              <button
                type="button"
                onClick={onShowLeaveConfirmModal}
                disabled={leavingGroup}
                className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-medium text-gray-500 transition hover:bg-[#003B44]/5 hover:text-[#003B44] disabled:opacity-50"
              >
                {leavingGroup ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
                Rời khỏi nhóm
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col items-center justify-start border-b border-[#003B44]/8 px-6 pb-8 pt-10 text-center">
              <UserAvatar user={friend} size="lg" className="!h-20 !w-20 rounded-full ring-3 ring-[#00BFA5]/15" alt="" />
              <h3 className="mt-4 max-w-full truncate text-lg font-bold tracking-tight text-[#003B44]">
                {getDisplayName(friend?._id || friend?.id, localNicknames, friend)}
              </h3>
              {getDisplayName(friend?._id || friend?.id, localNicknames, friend) !== personFullName(friend) && (
                <p className="mt-1.5 text-xs text-[#003B44]/55">
                  {personFullName(friend)}
                </p>
              )}
            </div>
            <div className="border-b border-[#003B44]/8 py-1">
              <button
                type="button"
                onClick={onShowNicknameModal}
                className="flex w-full items-center justify-between px-6 py-4 text-left text-sm font-semibold text-[#003B44] transition hover:bg-[#003B44]/5"
              >
                <span className="flex items-center gap-2">
                  <Edit2 size={16} className="text-[#00BFA5]" />
                  Chỉnh sửa biệt danh
                </span>
              </button>
            </div>
            <ChatMediaGallerySection
              chatId={chatId}
              isGroupChat={false}
              messages={visibleMessages}
              onOpenImage={setLightboxUrl}
            />
          </>
        )}
      </div>
    </aside>
  );
}

export default ChatSidebar;
