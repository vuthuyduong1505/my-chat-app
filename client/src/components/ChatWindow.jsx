import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";

function formatMessageTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function MessageRowAvatar({ src, initial, onImageError }) {
  return (
    <div className="h-8 w-8 flex-shrink-0 overflow-hidden rounded-full bg-primary/10 ring-1 ring-primary/15">
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" onError={onImageError} />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[11px] font-bold text-primary">{initial}</div>
      )}
    </div>
  );
}

function ChatWindow({ friend, currentUserId }) {
  const { user } = useAuth();
  const { socket, connected, onlineUsers } = useSocket();
  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [draft, setDraft] = useState("");
  const [friendAvatarErr, setFriendAvatarErr] = useState(false);
  const [myAvatarErr, setMyAvatarErr] = useState(false);
  const bottomRef = useRef(null);

  const friendId = useMemo(() => {
    if (!friend) return null;
    return String(friend._id || friend.id || "");
  }, [friend]);

  const friendName = useMemo(() => {
    if (!friend) return "";
    const n = `${friend.firstName || ""} ${friend.lastName || ""}`.trim();
    return n || friend.email || "Bạn bè";
  }, [friend]);

  const friendInitial = useMemo(() => {
    const base = friend?.firstName || friend?.lastName || friend?.email || "?";
    return base[0]?.toUpperCase() || "?";
  }, [friend]);

  const myInitial = useMemo(() => {
    const base =
      `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || user?.email || currentUserId || "?";
    return base[0]?.toUpperCase() || "?";
  }, [user, currentUserId]);

  const myAvatarUrl = user?.avatar?.trim() || "";

  useEffect(() => {
    setFriendAvatarErr(false);
  }, [friend?.avatar, friendId]);

  useEffect(() => {
    setMyAvatarErr(false);
  }, [myAvatarUrl]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!friendId || loadingHistory) return undefined;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: "auto" });
      });
    });
    return () => cancelAnimationFrame(id);
  }, [friendId, loadingHistory]);

  useEffect(() => {
    if (!friendId) {
      setMessages([]);
      return undefined;
    }

    let cancelled = false;
    const load = async () => {
      setLoadingHistory(true);
      try {
        const res = await api.get(`/chat/${friendId}`);
        if (!cancelled) setMessages(res.data?.messages || []);
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
  }, [friendId]);

  useEffect(() => {
    if (!socket || !friendId) return undefined;

    const join = () => {
      socket.emit("join_chat", { friendId });
    };

    join();
    socket.on("connect", join);

    return () => {
      socket.off("connect", join);
      socket.emit("leave_chat", { friendId });
    };
  }, [socket, friendId]);

  useEffect(() => {
    if (!socket || !friendId || !currentUserId) return undefined;

    const onNew = (msg) => {
      const me = String(currentUserId);
      const fid = String(friendId);
      const inConv =
        (msg.sender === me && msg.receiver === fid) || (msg.sender === fid && msg.receiver === me);
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
    };

    socket.on("new_message", onNew);
    return () => {
      socket.off("new_message", onNew);
    };
  }, [socket, friendId, currentUserId]);

  const send = () => {
    const text = draft.trim();
    if (!text || !socket?.connected || !friendId || !currentUserId) return;

    const tempId = `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const optimistic = {
      _id: tempId,
      tempId,
      sender: String(currentUserId),
      receiver: friendId,
      content: text,
      createdAt: new Date().toISOString(),
      pending: true
    };

    setMessages((prev) => [...prev, optimistic]);
    socket.emit("send_message", { receiverId: friendId, content: text, tempId });
    setDraft("");
  };

  const friendIsOnline = Boolean(friendId && onlineUsers.has(String(friendId)));

  if (!friend || !friendId) {
    return (
      <div className="relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-primary/8 bg-gradient-to-br from-accent via-light to-accent/90 p-6 shadow-inner">
        <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_top_right,rgba(0,191,165,0.12),transparent_50%)]" />
        <div className="relative flex h-full flex-col items-center justify-center text-center">
          <div className="mb-5 flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl bg-primary text-light shadow-lg shadow-primary/25 ring-4 ring-secondary/20 transition-transform duration-300 hover:scale-105">
            <MessageCircle size={34} strokeWidth={1.75} />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-primary md:text-2xl">
            Chọn một người bạn để bắt đầu trò chuyện
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-primary/8 bg-gradient-to-br from-accent via-light to-accent/90 shadow-inner">
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(ellipse_at_top_right,rgba(0,191,165,0.08),transparent_55%)]" />

      <header className="relative z-10 flex shrink-0 items-center gap-3 border-b border-primary/10 bg-light/95 px-4 py-3 backdrop-blur-sm md:px-5">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-primary/10 ring-2 ring-secondary/25">
          {friend?.avatar && !friendAvatarErr ? (
            <img
              src={friend.avatar}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setFriendAvatarErr(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
              {friendInitial}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-primary">{friendName}</p>
          <p className="truncate text-xs text-primary/50">
            {!connected
              ? "Đang kết nối máy chủ…"
              : friendIsOnline
                ? "Đang hoạt động"
                : "Offline"}
          </p>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 md:px-5">
          {loadingHistory ? (
            <div className="flex justify-center py-10 text-primary/45">
              <Loader2 className="animate-spin" size={22} />
            </div>
          ) : messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-primary/45">Chưa có tin nhắn nào</p>
          ) : (
            messages.map((m) => {
              const isMine = String(m.sender) === String(currentUserId);
              const time = formatMessageTime(m.createdAt);

              if (isMine) {
                return (
                  <div key={String(m._id)} className="flex w-full justify-end">
                    <div className="flex w-full max-w-[min(92%,480px)] flex-col items-end">
                      <div className="flex w-full min-w-0 flex-row-reverse items-end gap-2">
                        <MessageRowAvatar
                          src={myAvatarUrl && !myAvatarErr ? myAvatarUrl : null}
                          initial={myInitial}
                          onImageError={() => setMyAvatarErr(true)}
                        />
                        <div
                          className={`min-w-0 max-w-[80%] rounded-3xl rounded-br-2xl bg-primary px-3.5 py-2.5 text-sm text-light shadow-sm ${
                            m.pending ? "opacity-90" : ""
                          }`}
                        >
                          <p className="break-all whitespace-pre-wrap [overflow-wrap:anywhere] leading-snug">
                            {m.content}
                          </p>
                        </div>
                      </div>
                      <span className="mr-10 text-[10px] leading-none tabular-nums text-gray-400">{time}</span>
                    </div>
                  </div>
                );
              }

              return (
                <div key={String(m._id)} className="flex w-full justify-start">
                  <div className="flex w-full max-w-[min(92%,480px)] flex-col items-start">
                    <div className="flex w-full min-w-0 flex-row items-end gap-2">
                      <MessageRowAvatar
                        src={friend?.avatar && !friendAvatarErr ? friend.avatar : null}
                        initial={friendInitial}
                        onImageError={() => setFriendAvatarErr(true)}
                      />
                      <div
                        className={`min-w-0 max-w-[80%] rounded-3xl rounded-bl-2xl bg-gray-100 px-3.5 py-2.5 text-sm text-primary shadow-sm ${
                          m.pending ? "opacity-90" : ""
                        }`}
                      >
                        <p className="break-all whitespace-pre-wrap [overflow-wrap:anywhere] leading-snug">
                          {m.content}
                        </p>
                      </div>
                    </div>
                    <span className="ml-10 text-[10px] leading-none tabular-nums text-gray-400">{time}</span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>

        <div className="relative z-10 shrink-0 border-t border-primary/10 bg-light/90 p-3 backdrop-blur-sm md:p-4">
          <div className="flex items-center gap-2 rounded-2xl border border-primary/10 bg-accent/50 p-2 pl-3 shadow-sm focus-within:shadow-md focus-within:ring-2 focus-within:ring-secondary/30">
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={connected ? "Nhập tin nhắn…" : "Đang kết nối máy chủ…"}
              disabled={!connected}
              className="min-w-0 flex-1 rounded-xl border-0 bg-light px-4 py-2.5 text-sm text-primary placeholder:text-primary/35 outline-none ring-1 ring-primary/10 transition focus:ring-2 focus:ring-secondary disabled:opacity-60"
            />
            <button
              type="button"
              onClick={send}
              disabled={!connected || !draft.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-light shadow-md shadow-primary/25 transition hover:bg-primary/90 disabled:opacity-40"
              aria-label="Gửi"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatWindow;
