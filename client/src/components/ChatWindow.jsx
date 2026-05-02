import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import api from "../api";
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

function ChatWindow({ friend, currentUserId }) {
  const { socket, connected } = useSocket();
  const [messages, setMessages] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [draft, setDraft] = useState("");
  const [avatarErr, setAvatarErr] = useState(false);
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

  useEffect(() => {
    setAvatarErr(false);
  }, [friend?.avatar, friendId]);

  const friendInitial = useMemo(() => {
    const base = friend?.firstName || friend?.lastName || friend?.email || "?";
    return base[0]?.toUpperCase() || "?";
  }, [friend]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loadingHistory]);

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
          {friend?.avatar && !avatarErr ? (
            <img
              src={friend.avatar}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setAvatarErr(true)}
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
            <p className="py-8 text-center text-sm text-primary/45">Chưa có tin nhắn nào. Hãy bắt đầu!</p>
          ) : (
            messages.map((m) => {
              const isMine = String(m.sender) === String(currentUserId);
              return (
                <div key={String(m._id)} className={`flex w-full ${isMine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[min(85%,420px)] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                      isMine
                        ? "rounded-br-md bg-primary text-light"
                        : "rounded-bl-md bg-gray-100 text-primary"
                    } ${m.pending ? "opacity-90" : ""}`}
                  >
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
                    <p
                      className={`mt-1 text-[10px] ${isMine ? "text-light/70" : "text-primary/45"}`}
                    >
                      {formatMessageTime(m.createdAt)}
                    </p>
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
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary shadow-md shadow-secondary/25 transition hover:brightness-95 disabled:opacity-40"
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
