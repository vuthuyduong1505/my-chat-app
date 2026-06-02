/**
 * ============================================================================
 * SƠ ĐỒ PHÂN CẤP COMPONENT (PARENT-CHILD HIERARCHY) CỦA THƯ MỤC CHAT
 * ============================================================================
 *
 * 1. ChatWindow.jsx (Component Cha / Controller chính)
 *    │   ├── Quản lý toàn bộ State (tin nhắn, nhóm, trạng thái gửi/modal/sidebar...)
 *    │   ├── Quản lý các Socket listeners (Real-time events) và gọi các APIs
 *    │   │
 *    │   ├── ChatHeader.jsx (Component Con)
 *    │   │   └── Hiển thị thanh tiêu đề đầu trang (Avatar, Tên, Trạng thái online/thành viên)
 *    │   │
 *    │   ├── MessageList.jsx (Component Con)
 *    │   │   ├── Hiển thị vùng cuộn tin nhắn, tin nhắn hệ thống, thanh phân cách thời gian
 *    │   │   └── MessageItem.jsx (Component Con của MessageList)
 *    │   │       ├── Bong bóng chat đơn lẻ (Text, Ảnh, Tệp đính kèm)
 *    │   │       ├── Cảm xúc Reactions (Thả và đếm hiển thị)
 *    │   │       ├── Menu tùy chọn "..." (Thu hồi / Xóa tin nhắn)
 *    │   │       └── Trích dẫn tin nhắn trả lời (Reply Quotes)
 *    │   │
 *    │   ├── ChatInput.jsx (Component Con)
 *    │   │   ├── Nhập liệu tin nhắn, đính kèm nhiều tệp, dán hình ảnh từ clipboard
 *    │   │   └── AttachmentPreviewStrip (Xem trước các file/ảnh trong hàng chờ gửi)
 *    │   │
 *    │   └── ChatSidebar.jsx (Component Con)
 *    │       ├── Thông tin chi tiết cuộc trò chuyện bên phải (Messenger-style)
 *    │       ├── Accordion ảnh/tệp tin chia sẻ (ChatMediaGallerySection)
 *    │       └── Danh sách thành viên nhóm chat và tùy chọn tương tác trực tiếp
 *    │
 *    ├── [Modals] - Các hộp thoại popup dùng chung (Rename, Add Members, Leave, Nickname)
 *
 * ============================================================================
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "../api";
import { getDisplayName } from "../utils/displayName";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

// Import các component con đã được phân tách
import ChatHeader from "./chat/ChatHeader";
import MessageList from "./chat/MessageList";
import ChatInput from "./chat/ChatInput";
import ChatSidebar from "./chat/ChatSidebar";

// Import các hàm tiện ích dùng chung
import {
  getSenderId,
  isMessageMine,
  isSystemMessage,
  replyAuthorName,
  replyContentLabel,
  buildReplySnapshot,
  buildGroupSeenAvatarMap,
  mergeSeenByEntry,
  createQueuedAttachment,
  displayUserName
} from "./chat/chatUtils";

// Import các Modal phụ trợ
import RenameGroupModal from "./RenameGroupModal";
import AddGroupMembersModal from "./AddGroupMembersModal";
import LeaveGroupConfirmModal from "./LeaveGroupConfirmModal";
import NicknameModal from "./NicknameModal";

function ChatWindow({
  friend,
  group,
  groupId: routeGroupId,
  currentUserId,
  nicknames: initialNicknames = [],
  onGroupChange,
  onLeaveGroup
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, connected, onlineUsers } = useSocket();
  const isGroupChat = Boolean(group);

  // States quản lý mở/đóng Sidebar & Modals
  const [infoSidebarOpen, setInfoSidebarOpen] = useState(false);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showLeaveConfirmModal, setShowLeaveConfirmModal] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);

  // States quản lý dữ liệu cục bộ
  const [localGroup, setLocalGroup] = useState(group);
  const [localNicknames, setLocalNicknames] = useState(initialNicknames);
  const [leavingGroup, setLeavingGroup] = useState(false);
  const [updatingGroup, setUpdatingGroup] = useState(false);

  // States quản lý tin nhắn và file gửi
  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [sending, setSending] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState("");
  const [replyTarget, setReplyTarget] = useState(null);

  // DOM Refs
  const bottomRef = useRef(null);
  const messageRefs = useRef({});
  const attachmentsRef = useRef(attachments);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    setLocalGroup(group);
  }, [group]);

  useEffect(() => {
    setLocalNicknames(initialNicknames || []);
  }, [initialNicknames]);

  const activeGroup = isGroupChat ? localGroup || group : null;

  const chatId = useMemo(() => {
    if (isGroupChat) {
      if (routeGroupId) return String(routeGroupId);
      return activeGroup ? String(activeGroup._id || activeGroup.id || "") : null;
    }
    if (!friend) return null;
    return String(friend._id || friend.id || "");
  }, [friend, activeGroup, isGroupChat, routeGroupId]);

  const memberMap = useMemo(() => {
    const map = new Map();
    (activeGroup?.members || []).forEach((member) => {
      map.set(String(member._id || member.id), member);
    });
    return map;
  }, [activeGroup]);

  const groupCreatorId = useMemo(() => {
    const raw = activeGroup?.creator;
    if (raw && typeof raw === "object") return String(raw._id || raw.id || "");
    if (activeGroup?.creatorId) return String(activeGroup.creatorId);
    if (raw) return String(raw);
    return "";
  }, [activeGroup]);

  /** Đồng bộ state cục bộ của group (khi fetch tin nhắn) */
  const syncLocalGroup = useCallback((updated) => {
    if (!updated) return;
    setLocalGroup(updated);
  }, []);

  /** Đồng bộ group sau khi tương tác user / nhận socket update */
  const publishGroupUpdate = useCallback(
    (updated) => {
      if (!updated) return;
      setLocalGroup(updated);
      onGroupChange?.(updated);
      window.dispatchEvent(new CustomEvent("groups-updated"));
    },
    [onGroupChange]
  );

  const chatTitle = useMemo(() => {
    if (isGroupChat) return activeGroup?.name || "Nhóm chat";
    return getDisplayName(friend?._id || friend?.id, localNicknames, friend) || "Bạn bè";
  }, [friend, activeGroup, isGroupChat, localNicknames]);

  const chatSubtitle = useMemo(() => {
    if (isGroupChat) {
      const count = activeGroup?.memberCount || activeGroup?.members?.length || 0;
      return `${count} thành viên`;
    }
    const fid = chatId;
    const online = fid && (onlineUsers instanceof Set ? onlineUsers : new Set()).has(String(fid));
    if (!connected) return "Đang kết nối máy chủ…";
    return online ? "Đang hoạt động" : "Offline";
  }, [isGroupChat, activeGroup, chatId, connected, onlineUsers]);

  // Đóng sidebar khi đổi phòng chat
  useEffect(() => {
    setInfoSidebarOpen(false);
    setShowLeaveConfirmModal(false);
    setShowRenameModal(false);
  }, [chatId]);

  // Lắng nghe socket cập nhật thông tin nhóm
  useEffect(() => {
    if (!socket || !isGroupChat || !chatId) return undefined;

    const onGroupUpdated = ({ group: updated }) => {
      if (!updated || String(updated._id) !== String(chatId)) return;
      publishGroupUpdate(updated);
    };

    socket.on("group_updated", onGroupUpdated);
    return () => socket.off("group_updated", onGroupUpdated);
  }, [socket, isGroupChat, chatId, publishGroupUpdate]);

  const handleConfirmRenameGroup = async (trimmed) => {
    if (!chatId || updatingGroup || !trimmed) return;
    setUpdatingGroup(true);
    try {
      const res = await api.put(`/groups/${chatId}`, { name: trimmed });
      publishGroupUpdate(res.data?.group);
      setShowRenameModal(false);
      toast.success("Đã đổi tên nhóm.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Không thể đổi tên nhóm.");
    } finally {
      setUpdatingGroup(false);
    }
  };

  const handleGroupAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !chatId) return;
    const form = new FormData();
    form.append("avatar", file);
    setUpdatingGroup(true);
    try {
      const res = await api.put(`/groups/${chatId}`, form, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      publishGroupUpdate(res.data?.group);
      toast.success("Đã cập nhật ảnh nhóm.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Không thể đổi ảnh nhóm.");
    } finally {
      setUpdatingGroup(false);
    }
  };

  const handleConfirmLeaveGroup = async () => {
    if (!chatId || leavingGroup) return;
    setLeavingGroup(true);
    try {
      await api.post(`/groups/${chatId}/leave`);
      setShowLeaveConfirmModal(false);
      toast.success("Đã rời nhóm.");
      onLeaveGroup?.();
      navigate("/");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Không thể rời nhóm.");
    } finally {
      setLeavingGroup(false);
    }
  };

  const handleSaveNickname = async (targetUserId, nickname) => {
    if (!chatId) return;
    try {
      const res = await api.put(`/conversations/${chatId}/nickname`, {
        targetUserId,
        nickname
      });
      const updatedNicknames = res.data?.nicknames || [];
      setLocalNicknames(updatedNicknames);

      // Phát CustomEvent đồng bộ HomePage
      window.dispatchEvent(
        new CustomEvent("nickname-locally-updated", {
          detail: { chatId, isGroup: isGroupChat, nicknames: updatedNicknames }
        })
      );

      toast.success("Cập nhật biệt danh thành công.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Không thể cập nhật biệt danh.");
      throw err;
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!chatId) return;
    const confirmDelete = window.confirm("Bạn có chắc chắn muốn xóa thành viên này khỏi nhóm không?");
    if (!confirmDelete) return;

    try {
      const res = await api.delete(`/groups/${chatId}/members/${memberId}`);
      toast.success("Đã xóa thành viên khỏi nhóm.");
      publishGroupUpdate(res.data?.group);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Không thể xóa thành viên khỏi nhóm.");
    }
  };

  // Phát hiện sự kiện bị xóa khỏi nhóm
  useEffect(() => {
    const handleRemoved = (e) => {
      const { groupId } = e.detail;
      if (chatId && String(groupId) === String(chatId)) {
        toast.error("Bạn đã bị xóa khỏi nhóm này.");
        onLeaveGroup?.();
        navigate("/");
      }
    };
    window.addEventListener("removed-from-group", handleRemoved);
    return () => window.removeEventListener("removed-from-group", handleRemoved);
  }, [chatId, onLeaveGroup, navigate]);

  // Đồng bộ biệt danh qua Socket
  useEffect(() => {
    if (!socket || !chatId) return undefined;

    const onNicknameUpdated = (data) => {
      const { groupId, peerId, nicknames } = data;
      if (isGroupChat && groupId && String(groupId) === String(chatId)) {
        setLocalNicknames(nicknames || []);
      } else if (!isGroupChat && peerId && String(peerId) === String(chatId)) {
        setLocalNicknames(nicknames || []);
      }
    };

    socket.on("nickname_updated", onNicknameUpdated);
    return () => socket.off("nickname_updated", onNicknameUpdated);
  }, [socket, chatId, isGroupChat]);

  // Tự động cuộn xuống dưới khi có tin nhắn mới
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cuộn ngay lập tức khi tải phòng chat mới xong
  useEffect(() => {
    if (!chatId || loadingHistory) return undefined;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "auto" });
      });
    });
    return () => cancelAnimationFrame(id);
  }, [chatId, loadingHistory]);

  const scrollToMessage = useCallback((messageId) => {
    const el = messageRefs.current[String(messageId)];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-[#00BFA5]/50", "rounded-2xl");
      window.setTimeout(() => {
        el.classList.remove("ring-2", "ring-[#00BFA5]/50", "rounded-2xl");
      }, 1600);
    }
  }, []);

  const handleReplyToMessage = useCallback((message) => {
    if (!message || message.isRecalled || message.pending || isSystemMessage(message)) return;
    setReplyTarget(buildReplySnapshot(message));
  }, []);

  useEffect(() => {
    setReplyTarget(null);
    messageRefs.current = {};
  }, [chatId]);

  // Tải lịch sử tin nhắn
  useEffect(() => {
    if (!chatId || loadingHistory) return undefined;
    let cancelled = false;
    const load = async () => {
      setLoadingHistory(true);
      try {
        const url = isGroupChat ? `/groups/${chatId}/messages` : `/chat/${chatId}`;
        const res = await api.get(url);
        if (!cancelled) {
          setMessages(res.data?.messages || []);
          if (isGroupChat && res.data?.group) syncLocalGroup(res.data.group);
        }
      } catch {
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [chatId, isGroupChat, syncLocalGroup]);

  // Kết nối và thoát phòng chat Socket
  useEffect(() => {
    if (!socket || !chatId) return undefined;

    const join = () => {
      if (isGroupChat) {
        socket.emit("join_group_chat", { groupId: chatId });
      } else {
        socket.emit("join_chat", { friendId: chatId });
      }
    };

    join();
    socket.on("connect", join);

    return () => {
      socket.off("connect", join);
      if (isGroupChat) {
        socket.emit("leave_group_chat", { groupId: chatId });
      } else {
        socket.emit("leave_chat", { friendId: chatId });
      }
    };
  }, [socket, chatId, isGroupChat]);

  /** Cơ chế "Đã xem" */
  const markAsRead = useCallback(() => {
    if (!socket?.connected || !chatId) return;
    if (isGroupChat) {
      socket.emit("mark_as_read", { groupId: chatId });
    } else {
      socket.emit("mark_as_read", { friendId: chatId });
    }
  }, [socket, chatId, isGroupChat]);

  useEffect(() => {
    if (!chatId || loadingHistory) return;
    markAsRead();
  }, [chatId, loadingHistory, markAsRead]);

  // Nhận tin nhắn mới, cập nhật tin nhắn & cảm xúc realtime
  useEffect(() => {
    if (!socket || !chatId || !currentUserId) return undefined;

    const onNew = (msg) => {
      const me = String(currentUserId);
      const msgSenderId = getSenderId(msg);
      const inConv = isGroupChat
        ? String(msg.groupId) === String(chatId)
        : (msgSenderId === me && msg.receiver === String(chatId)) ||
        (msgSenderId === String(chatId) && msg.receiver === me);
      if (!inConv) return;

      setMessages((prev) => {
        if (msg.tempId) {
          const idx = prev.findIndex((m) => m.tempId === msg.tempId);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = { ...msg, pending: false };
            return next;
          }
        }
        if (prev.some((m) => String(m._id) === String(msg._id))) return prev;
        return [...prev, msg];
      });

      if (isGroupChat && getSenderId(msg) !== me) {
        markAsRead();
      } else if (!isGroupChat && getSenderId(msg) === String(chatId)) {
        markAsRead();
      }
    };

    const onGroupMessageSeen = ({ groupId, userId, user, messageIds }) => {
      if (!isGroupChat || String(groupId) !== String(chatId)) return;
      const ids = new Set((messageIds || []).map(String));
      if (!ids.size) return;

      setMessages((prev) =>
        prev.map((m) => {
          if (!ids.has(String(m._id))) return m;
          return { ...m, seenBy: mergeSeenByEntry(m.seenBy, user || { _id: userId }) };
        })
      );
    };

    const onMessagesRead = ({ readBy }) => {
      if (isGroupChat) return;
      const me = String(currentUserId);
      const fid = String(chatId);
      if (String(readBy) !== fid) return;
      setMessages((prev) =>
        prev.map((m) => (getSenderId(m) === me && String(m.receiver) === fid ? { ...m, isRead: true } : m))
      );
    };

    const onMessageUpdated = (updated) => {
      const me = String(currentUserId);
      const updatedSenderId = getSenderId(updated);
      const inConv = isGroupChat
        ? String(updated.groupId) === String(chatId)
        : (updatedSenderId === me && updated.receiver === String(chatId)) ||
        (updated.receiver === me && updatedSenderId === String(chatId));
      if (!inConv) return;

      if ((updated.hiddenFor || []).map(String).includes(me)) {
        setMessages((prev) => prev.filter((m) => String(m._id) !== String(updated._id)));
        return;
      }

      setMessages((prev) =>
        prev.map((m) => (String(m._id) === String(updated._id) ? { ...m, ...updated, pending: false } : m))
      );
    };

    const onReactionUpdated = ({ messageId, reactions }) => {
      if (!messageId) return;
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(messageId)
            ? { ...m, reactions: reactions || [] }
            : m
        )
      );
    };

    socket.on("new_message", onNew);
    socket.on("group_message_seen", onGroupMessageSeen);
    socket.on("messages_read", onMessagesRead);
    socket.on("message_updated", onMessageUpdated);
    socket.on("message_reaction_updated", onReactionUpdated);
    return () => {
      socket.off("new_message", onNew);
      socket.off("group_message_seen", onGroupMessageSeen);
      socket.off("messages_read", onMessagesRead);
      socket.off("message_updated", onMessageUpdated);
      socket.off("message_reaction_updated", onReactionUpdated);
    };
  }, [socket, chatId, currentUserId, markAsRead, isGroupChat]);

  const revokePreview = (item) => {
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
  };

  const addFilesToQueue = (files) => {
    const list = Array.from(files || []).filter(Boolean);
    if (!list.length) return;
    setAttachments((prev) => [...prev, ...list.map((file) => createQueuedAttachment(file))]);
  };

  const removeQueuedAttachment = (id) => {
    setAttachments((prev) => {
      const target = prev.find((item) => item.id === id);
      revokePreview(target);
      return prev.filter((item) => item.id !== id);
    });
  };

  const uploadSingleFile = async (file, onProgress) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post("/chat/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (event) => {
        if (!event.total) return;
        onProgress(Math.round((event.loaded * 100) / event.total));
      }
    });
    return res.data;
  };

  /** Thu hồi tin nhắn */
  const handleUnsendMessage = useCallback(
    (message) => {
      if (!socket?.connected || !message?._id || message.pending) return;
      socket.emit("delete_message", { messageId: String(message._id), mode: "everyone" });
    },
    [socket]
  );

  /** Xóa tin nhắn ở phía tôi */
  const handleRemoveForMe = useCallback(
    (message) => {
      if (!socket?.connected || !message?._id || message.pending) return;
      socket.emit("delete_message", { messageId: String(message._id), mode: "self" });
    },
    [socket]
  );

  /** Gửi hoặc bỏ cảm xúc reaction */
  const handleSendReaction = useCallback(
    (message, emoji) => {
      if (!socket?.connected || !message?._id || message.pending) return;
      socket.emit("send_reaction", { messageId: String(message._id), emoji });
    },
    [socket]
  );

  const emitChatMessage = ({ content = "", fileUrl = "", fileType = "", fileName = "" }) => {
    const tempId = `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const meId = String(currentUserId);
    const replySnap = replyTarget ? { ...replyTarget } : null;
    const senderProfile = user
      ? {
        _id: meId,
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        email: user.email || "",
        avatar: user.avatar || ""
      }
      : meId;
    const optimistic = {
      _id: tempId,
      tempId,
      sender: senderProfile,
      senderId: meId,
      receiver: isGroupChat ? "" : chatId,
      groupId: isGroupChat ? chatId : "",
      content,
      fileUrl,
      fileType,
      fileName,
      isRead: false,
      seenBy: [],
      isRecalled: false,
      hiddenFor: [],
      replyTo: replySnap,
      replyToId: replySnap?._id || "",
      senderName: isGroupChat ? displayUserName(user) : "",
      createdAt: new Date().toISOString(),
      pending: true
    };

    setMessages((prev) => [...prev, optimistic]);
    socket.emit("send_message", {
      ...(isGroupChat ? { groupId: chatId } : { receiverId: chatId }),
      content,
      fileUrl,
      fileType,
      fileName,
      tempId,
      ...(replySnap?._id && !String(replySnap._id).startsWith("t-") ? { replyToId: replySnap._id } : {})
    });
  };

  const send = async () => {
    const text = draft.trim();
    const queue = attachments.filter((item) => item.status === "queued" || item.status === "error");

    if ((!text && queue.length === 0) || sending || !socket?.connected || !chatId || !currentUserId) return;

    setSending(true);
    setDraft("");
    const hadReply = Boolean(replyTarget);

    try {
      if (text) {
        emitChatMessage({ content: text });
      }

      for (const item of queue) {
        setAttachments((prev) =>
          prev.map((entry) => (entry.id === item.id ? { ...entry, status: "uploading", progress: 0, error: false } : entry))
        );

        try {
          const uploaded = await uploadSingleFile(item.file, (progress) => {
            setAttachments((prev) =>
              prev.map((entry) => (entry.id === item.id ? { ...entry, progress } : entry))
            );
          });

          emitChatMessage({
            fileUrl: uploaded?.fileUrl || "",
            fileType: uploaded?.fileType || "file",
            fileName: uploaded?.fileName || item.fileName
          });

          revokePreview(item);
          setAttachments((prev) => prev.filter((entry) => entry.id !== item.id));
        } catch {
          setAttachments((prev) =>
            prev.map((entry) => (entry.id === item.id ? { ...entry, status: "error", progress: 0 } : entry))
          );
          toast.error(`Không thể tải lên: ${item.fileName}`);
        }
      }
    } finally {
      setSending(false);
      if (hadReply) setReplyTarget(null);
    }
  };

  const handleChooseFile = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    addFilesToQueue(files);
  };

  const handlePaste = (event) => {
    const clipboardItems = Array.from(event.clipboardData?.items || []);
    const pastedImages = clipboardItems
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter(Boolean);

    if (!pastedImages.length) return;

    event.preventDefault();
    addFilesToQueue(pastedImages);
  };

  const hasQueuedAttachments = attachments.some((item) => item.status === "queued" || item.status === "error");
  const canSend = Boolean(draft.trim() || hasQueuedAttachments);

  const visibleMessages = useMemo(() => {
    const me = String(currentUserId);
    return messages.filter((m) => !(m.hiddenFor || []).map(String).includes(me));
  }, [messages, currentUserId]);

  const lastMyMessageId = useMemo(() => {
    const me = String(currentUserId);
    for (let i = visibleMessages.length - 1; i >= 0; i -= 1) {
      const m = visibleMessages[i];
      if (isSystemMessage(m)) continue;
      if (isMessageMine(m, me) && !m.isRecalled && !m.pending) return String(m._id);
    }
    return null;
  }, [visibleMessages, currentUserId]);

  const groupSeenAvatarMap = useMemo(() => {
    if (!isGroupChat) return new Map();
    return buildGroupSeenAvatarMap(visibleMessages, currentUserId, memberMap);
  }, [visibleMessages, currentUserId, isGroupChat, memberMap]);

  const onlineUserSet = useMemo(
    () => (onlineUsers instanceof Set ? onlineUsers : new Set(Array.isArray(onlineUsers) ? onlineUsers.map(String) : [])),
    [onlineUsers]
  );

  useEffect(() => {
    setDraft("");
    setSending(false);
    setAttachments((prev) => {
      prev.forEach(revokePreview);
      return [];
    });
  }, [chatId]);

  useEffect(
    () => () => {
      attachmentsRef.current.forEach(revokePreview);
    },
    []
  );

  if (!chatId || (!isGroupChat && !friend) || (isGroupChat && !activeGroup)) {
    return (
      <div className="relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-primary/8 bg-gradient-to-br from-accent via-light to-accent/90 p-6 shadow-inner">
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_top_right,rgba(0,191,165,0.12),transparent_50%)]" />
        <div className="relative flex h-full flex-col items-center justify-center text-center">
          <div className="mb-5 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl bg-primary text-light shadow-lg shadow-primary/25 ring-4 ring-secondary/20 transition-transform duration-300 hover:scale-105">
            <MessageCircle size={34} strokeWidth={1.75} />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-primary md:text-2xl">
            {isGroupChat ? "Chọn một nhóm để bắt đầu trò chuyện" : "Chọn một người bạn để bắt đầu trò chuyện"}
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-primary/8 bg-gradient-to-br from-accent via-light to-accent/90 shadow-inner">
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_top_right,rgba(0,191,165,0.08),transparent_55%)]" />

      {/* Khung chat chính */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <ChatHeader
          isGroupChat={isGroupChat}
          activeGroup={activeGroup}
          friend={friend}
          chatTitle={chatTitle}
          chatSubtitle={chatSubtitle}
          infoSidebarOpen={infoSidebarOpen}
          setInfoSidebarOpen={setInfoSidebarOpen}
        />

        <MessageList
          visibleMessages={visibleMessages}
          loadingHistory={loadingHistory}
          isGroupChat={isGroupChat}
          currentUserId={currentUserId}
          friend={friend}
          memberMap={memberMap}
          localNicknames={localNicknames}
          lastMyMessageId={lastMyMessageId}
          groupSeenAvatarMap={groupSeenAvatarMap}
          messageRefs={messageRefs}
          bottomRef={bottomRef}
          setLightboxUrl={setLightboxUrl}
          handleUnsendMessage={handleUnsendMessage}
          handleRemoveForMe={handleRemoveForMe}
          handleReplyToMessage={handleReplyToMessage}
          scrollToMessage={scrollToMessage}
          handleSendReaction={handleSendReaction}
        />

        <ChatInput
          connected={connected}
          sending={sending}
          attachments={attachments}
          replyTarget={replyTarget}
          draft={draft}
          setDraft={setDraft}
          canSend={canSend}
          send={send}
          handleChooseFile={handleChooseFile}
          removeQueuedAttachment={removeQueuedAttachment}
          handlePaste={handlePaste}
          setReplyTarget={setReplyTarget}
          currentUserId={currentUserId}
          friend={friend}
          memberMap={memberMap}
        />

        {lightboxUrl ? (
          <button
            type="button"
            className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 p-4"
            onClick={() => setLightboxUrl("")}
            aria-label="Đóng xem ảnh"
          >
            <img src={lightboxUrl} alt="Ảnh phóng to" className="max-h-full max-w-full rounded-xl object-contain shadow-xl" />
          </button>
        ) : null}
      </div>

      {/* Sidebar thông tin bên phải */}
      <ChatSidebar
        infoSidebarOpen={infoSidebarOpen}
        isGroupChat={isGroupChat}
        activeGroup={activeGroup}
        chatTitle={chatTitle}
        chatSubtitle={chatSubtitle}
        updatingGroup={updatingGroup}
        leavingGroup={leavingGroup}
        visibleMessages={visibleMessages}
        chatId={chatId}
        setLightboxUrl={setLightboxUrl}
        currentUserId={currentUserId}
        friend={friend}
        onlineUserSet={onlineUserSet}
        localNicknames={localNicknames}
        onChangeGroupAvatar={handleGroupAvatarChange}
        onShowRenameModal={() => setShowRenameModal(true)}
        onShowNicknameModal={() => setShowNicknameModal(true)}
        onShowAddMembersModal={() => setShowAddMembersModal(true)}
        onShowLeaveConfirmModal={() => setShowLeaveConfirmModal(true)}
        onRemoveMember={handleRemoveMember}
        onNavigateToChat={(mid) => {
          setInfoSidebarOpen(false);
          navigate(`/chat/${mid}`);
        }}
      />

      {/* Các Modals quản lý từ Controller chính */}
      {isGroupChat ? (
        <>
          <RenameGroupModal
            open={showRenameModal}
            initialName={activeGroup?.name || ""}
            onClose={() => setShowRenameModal(false)}
            onConfirm={handleConfirmRenameGroup}
            submitting={updatingGroup}
          />
          <AddGroupMembersModal
            open={showAddMembersModal}
            onClose={() => setShowAddMembersModal(false)}
            groupId={chatId}
            existingMemberIds={(activeGroup?.members || []).map((m) => String(m._id || m.id))}
            onAdded={publishGroupUpdate}
          />
          <LeaveGroupConfirmModal
            open={showLeaveConfirmModal}
            onClose={() => setShowLeaveConfirmModal(false)}
            onConfirm={handleConfirmLeaveGroup}
            submitting={leavingGroup}
          />
        </>
      ) : null}

      <NicknameModal
        open={showNicknameModal}
        onClose={() => setShowNicknameModal(false)}
        participants={isGroupChat ? activeGroup?.members || [] : [user, friend].filter(Boolean)}
        nicknames={localNicknames}
        onSave={handleSaveNickname}
      />
    </div>
  );
}

export default ChatWindow;
