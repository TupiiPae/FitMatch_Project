// user-app/src/pages/Chat/ChatBox.jsx
import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { getChatMessages, uploadChatImage } from "../../api/chat";
import { getSocket } from "../../lib/socket";
import "./ChatBox.css";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";

const safeArr = (v) => (Array.isArray(v) ? v : []);
const uniq = (arr) => {
  const m = new Map();
  for (const x of safeArr(arr)) {
    const k = String(x?._id || x?.clientMsgId || "");
    if (k) m.set(k, x);
  }
  return Array.from(m.values()).sort(
    (a, b) => new Date(a?.createdAt || 0) - new Date(b?.createdAt || 0)
  );
};
const sameDay = (a, b) =>
  dayjs(a).isValid() &&
  dayjs(b).isValid() &&
  dayjs(a).format("YYYY-MM-DD") === dayjs(b).format("YYYY-MM-DD");
const clip = (s, n = 90) => {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};

const EMOJIS = [
  { k: "like", c: "👍", t: "Thích" },
  { k: "heart", c: "❤️", t: "Tim" },
  { k: "laugh", c: "😂", t: "Cười" },
  { k: "wow", c: "😮", t: "Bất ngờ" },
  { k: "sad", c: "😢", t: "Buồn" },
  { k: "angry", c: "😡", t: "Phẫn nộ" },
];
const emojiChar = (key) => EMOJIS.find((x) => x.k === key)?.c || "";
const isImg = (a) => String(a?.type || "image") === "image" && !!a?.url;

const uidOf = (u) => String(u?._id || u || "");
const emojiKeyFromChar = (ch) => {
  const s = String(ch || "").trim();
  if (!s) return null;
  const map = {
    "👍": "like",
    "❤️": "heart",
    "❤": "heart",
    "😂": "laugh",
    "😆": "laugh",
    "😮": "wow",
    "😲": "wow",
    "🤯": "wow",
    "😢": "sad",
    "😭": "sad",
    "😡": "angry",
    "😠": "angry",
  };
  if (map[s]) return map[s];
  const found = EMOJIS.find((e) => e.c === s);
  return found?.k || null;
};

export default function ChatBox({
  conversationId,
  meId,
  members = [],
  height = 520,
  onOpenUser,
  emptyText,
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const [replyTo, setReplyTo] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reactFor, setReactFor] = useState(null);
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);

  const [sendMark, setSendMark] = useState(null);
  const sendMarkRef = useRef(null);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);

  const socket = useMemo(() => getSocket(), []);
  const myId = String(meId || "");

  useEffect(() => {
    sendMarkRef.current = sendMark;
  }, [sendMark]);

  useEffect(() => {
    setSendMark(null);
  }, [conversationId]);

  // ===== Image viewer =====
  const [imgView, setImgView] = useState(null);
  const closeImg = () => setImgView(null);

  useEffect(() => {
    if (!imgView) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeImg();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [imgView]);

  // ===== Seen =====
  const seenSentRef = useRef("");
  const emitSeenLatest = (mid) => {
    const id = String(mid || "");
    if (!conversationId || !id || id.startsWith("tmp_")) return;
    if (seenSentRef.current === id) return;
    seenSentRef.current = id;
    socket.emit("chat:seen", { conversationId, messageId: id }, () => {});
  };

  const applySeenLocal = (messageId, userId, seenAt) => {
    const mid = String(messageId || "");
    const uid = String(userId || "");
    if (!mid || !uid) return;
    setItems((prev) =>
      uniq(
        prev.map((m) => {
          if (String(m?._id || "") !== mid) return m;
          const list = safeArr(m?.seenBy);
          const kept = list.filter(
            (x) => String(x?.userId?._id || x?.userId || "") !== uid
          );
          return {
            ...m,
            seenBy: [
              ...kept,
              { userId: uid, seenAt: seenAt || new Date().toISOString() },
            ],
          };
        })
      )
    );
  };

  // ===== Drag reaction =====
  const [dragOverMid, setDragOverMid] = useState(null);

  // ===== Menu (⋯) + delete-for-me with undo 5s (NO localStorage) =====
  const [menuFor, setMenuFor] = useState(null); // {mid}
  const menuPopRef = useRef(null);
  const [menuShift, setMenuShift] = useState(0);

  // hidden only for immediate UI
  const [hiddenSet, setHiddenSet] = useState(new Set());
  const hiddenRef = useRef(new Set());

  // mid -> { token, timeoutId }
  const pendingHideRef = useRef(new Map());

  useEffect(() => {
    hiddenRef.current = hiddenSet;
  }, [hiddenSet]);

  useEffect(() => {
    // reset when changing room
    for (const v of pendingHideRef.current.values()) {
      try {
        clearTimeout(v.timeoutId);
      } catch {}
    }
    pendingHideRef.current.clear();
    setHiddenSet(new Set());
  }, [conversationId]);

  const commitHideToServer = (mid) => {
    const id = String(mid || "");
    if (!conversationId || !id || id.startsWith("tmp_")) return;

    socket.emit("chat:hide_for_me", { conversationId, messageId: id }, (ack) => {
      if (!ack?.ok) {
        // revert UI if server failed
        setHiddenSet((prev) => {
          const ns = new Set(prev);
          ns.delete(id);
          return ns;
        });
        toast.error(ack?.message || "Xóa phía tôi thất bại");
        // optional hard reload:
        // load();
      }
    });
  };

  const undoHide = (mid) => {
    const id = String(mid || "");
    if (!id) return;

    const rec = pendingHideRef.current.get(id);
    if (rec) {
      try {
        clearTimeout(rec.timeoutId);
      } catch {}
      pendingHideRef.current.delete(id);
    }

    setHiddenSet((prev) => {
      const ns = new Set(prev);
      ns.delete(id);
      return ns;
    });
  };

  const hideForMe = (m) => {
    const id = String(m?._id || "");
    if (!id || id.startsWith("tmp_")) return;
    if (hiddenRef.current.has(id)) return;

    // hide immediately in UI
    setHiddenSet((prev) => {
      const ns = new Set(prev);
      ns.add(id);
      return ns;
    });

    toast(
      ({ closeToast }) => (
        <div className="fm-chat-undo">
          <div className="fm-chat-undo-txt">Đã xóa tin nhắn (chỉ phía bạn)</div>
          <button
            className="fm-chat-undo-btn"
            onClick={() => {
              undoHide(id);
              closeToast?.();
            }}
          >
            Hoàn tác
          </button>
        </div>
      ),
      { autoClose: 5000, closeOnClick: false, closeButton: true }
    );

    // anti-race token
    const token = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const timeoutId = setTimeout(() => {
      const cur = pendingHideRef.current.get(id);
      if (!cur || cur.token !== token) return; // already undone / replaced
      pendingHideRef.current.delete(id);
      commitHideToServer(id);
    }, 5000);

    pendingHideRef.current.set(id, { token, timeoutId });
  };

  // ===== Refs for popups shift =====
  const reactPopRef = useRef(null);
  const [reactShift, setReactShift] = useState(0);
  const [reactModal, setReactModal] = useState(null); // {mid,filter:"all"|emojiKey}
  const closeReactModal = () => setReactModal(null);

  useEffect(() => {
    if (!reactModal) return;
    const onKey = (e) => {
      if (e.key === "Escape") closeReactModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reactModal]);

  // avoid overflow for react popup
  useEffect(() => {
    if (!reactFor) {
      setReactShift(0);
      return;
    }
    const calc = () => {
      const pop = reactPopRef.current,
        list = listRef.current;
      if (!pop || !list) return;
      const pr = pop.getBoundingClientRect();
      const lr = list.getBoundingClientRect();
      const pad = 10;
      let dx = 0;
      if (pr.left < lr.left + pad) dx = lr.left + pad - pr.left;
      if (pr.right > lr.right - pad) dx = lr.right - pad - pr.right;
      setReactShift(dx);
    };
    const tick = () =>
      requestAnimationFrame(() => requestAnimationFrame(calc));
    tick();
    window.addEventListener("resize", tick);
    const list = listRef.current;
    list?.addEventListener("scroll", tick, { passive: true });
    return () => {
      window.removeEventListener("resize", tick);
      list?.removeEventListener("scroll", tick);
    };
  }, [reactFor]);

  // avoid overflow for menu popup
  useEffect(() => {
    if (!menuFor) {
      setMenuShift(0);
      return;
    }
    const calc = () => {
      const pop = menuPopRef.current,
        list = listRef.current;
      if (!pop || !list) return;
      const pr = pop.getBoundingClientRect();
      const lr = list.getBoundingClientRect();
      const pad = 10;
      let dx = 0;
      if (pr.left < lr.left + pad) dx = lr.left + pad - pr.left;
      if (pr.right > lr.right - pad) dx = lr.right - pad - pr.right;
      setMenuShift(dx);
    };
    const tick = () =>
      requestAnimationFrame(() => requestAnimationFrame(calc));
    tick();
    window.addEventListener("resize", tick);
    const list = listRef.current;
    list?.addEventListener("scroll", tick, { passive: true });
    return () => {
      window.removeEventListener("resize", tick);
      list?.removeEventListener("scroll", tick);
    };
  }, [menuFor]);

  // scrolling class
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    let t = null;
    const onScroll = () => {
      el.classList.add("is-scrolling");
      if (t) clearTimeout(t);
      t = setTimeout(() => el.classList.remove("is-scrolling"), 2000);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (t) clearTimeout(t);
    };
  }, []);

  // lock body when modal open
  useEffect(() => {
    const open = !!reactModal || !!imgView;
    if (!open) return;
    const b = document.body;
    const prevOverflow = b.style.overflow;
    const prevPad = b.style.paddingRight;
    b.style.overflow = "hidden";
    b.style.paddingRight = prevPad; // keep as is
    return () => {
      b.style.overflow = prevOverflow;
      b.style.paddingRight = prevPad;
    };
  }, [reactModal, imgView]);

  // ===== Maps =====
  const memberMap = useMemo(() => {
    const m = new Map();
    safeArr(members).forEach((x) => {
      const id = String(x?.id || x?._id || "");
      if (id) m.set(id, x);
    });
    return m;
  }, [members]);

  const msgMap = useMemo(() => {
    const m = new Map();
    safeArr(items).forEach((x) => {
      const id = String(x?._id || "");
      if (id && !String(id).startsWith("tmp_")) m.set(id, x);
    });
    return m;
  }, [items]);

  // ===== Load messages =====
  const scrollBottom = (smooth = false) => {
    requestAnimationFrame(() => {
      const el = listRef.current;
      if (!el) return;
      if (smooth) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      else el.scrollTop = el.scrollHeight;
    });
  };

  const load = async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const data = await getChatMessages(conversationId, { limit: 80 });
      const arr = uniq(data?.items || []);
      setItems(arr);
      scrollBottom(false);

      const last = arr
        .filter((x) => {
          const id = String(x?._id || "");
          if (!id || id.startsWith("tmp_")) return false;
          if (x?.deletedAt) return false;
          return true;
        })
        .slice(-1)[0];

      if (last) emitSeenLatest(last._id);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Không tải được tin nhắn");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // ===== Socket room & events =====
  useEffect(() => {
    if (!conversationId) return;

    socket.emit("chat:join", { conversationId }, (ack) => {
      if (!ack?.ok)
        toast.error(ack?.message || "Không vào được phòng chat");
    });

    const onNew = (msg) => {
      if (String(msg?.conversationId || "") !== String(conversationId)) return;
      setItems((prev) => uniq([...prev, msg]));
      scrollBottom(true);

      try {
        const sid = String(msg?.senderId?._id || msg?.senderId || "");
        if (sid && sid !== myId) emitSeenLatest(msg?._id);
      } catch {}

      // clear sendMark when a new non-mine arrives after sent mark
      try {
        const sid = String(msg?.senderId?._id || msg?.senderId || "");
        const mine = sid === myId;
        const cur = sendMarkRef.current;
        if (!mine && cur?.state === "sent") {
          const tNew = new Date(msg?.createdAt || 0).getTime();
          const tSent = new Date(cur?.at || 0).getTime();
          if (!Number.isNaN(tNew) && !Number.isNaN(tSent) ? tNew >= tSent : true)
            setSendMark(null);
        }
      } catch {}
    };

    const onDeleted = ({ conversationId: cid, messageId, deletedAt } = {}) => {
      if (String(cid) !== String(conversationId) || !messageId) return;
      setItems((prev) =>
        uniq(
          prev.map((m) =>
            String(m?._id || "") === String(messageId)
              ? {
                  ...m,
                  deletedAt: deletedAt || new Date().toISOString(),
                  content: "",
                  attachments: [],
                }
              : m
          )
        )
      );
    };

    const onReact = ({ conversationId: cid, message } = {}) => {
      if (String(cid) !== String(conversationId) || !message?._id) return;
      setItems((prev) =>
        uniq(
          prev.map((m) =>
            String(m?._id || "") === String(message._id) ? message : m
          )
        )
      );
    };

    const onSeen = ({ conversationId: cid, messageId, userId, seenAt } = {}) => {
      if (String(cid) !== String(conversationId) || !messageId || !userId)
        return;
      applySeenLocal(messageId, userId, seenAt);
    };

    // optional: sync hidden across tabs/devices
    const onHiddenUpdate = ({ conversationId: cid, messageId, hidden } = {}) => {
      if (String(cid) !== String(conversationId) || !messageId) return;
      const mid = String(messageId);
      setHiddenSet((prev) => {
        const ns = new Set(prev);
        if (hidden) ns.add(mid);
        else ns.delete(mid);
        return ns;
      });
    };

    socket.on("chat:new", onNew);
    socket.on("chat:deleted", onDeleted);
    socket.on("chat:revoke_update", onDeleted);
    socket.on("chat:reaction_update", onReact);
    socket.on("chat:react_update", onReact);
    socket.on("chat:seen_update", onSeen);
    socket.on("chat:hidden_update", onHiddenUpdate);

    return () => {
      socket.off("chat:new", onNew);
      socket.off("chat:deleted", onDeleted);
      socket.off("chat:revoke_update", onDeleted);
      socket.off("chat:reaction_update", onReact);
      socket.off("chat:react_update", onReact);
      socket.off("chat:seen_update", onSeen);
      socket.off("chat:hidden_update", onHiddenUpdate);
      socket.emit("chat:leave", { conversationId });
    };
  }, [socket, conversationId, myId]);

  // close popups when click outside
  useEffect(() => {
    const onDoc = (e) => {
      const t = e.target;
      if (!t) return;
      if (
        !t.closest?.(".fm-chat-input-emoji") &&
        !t.closest?.(".fm-chat-emoji-pop")
      )
        setPickerOpen(false);
      if (!t.closest?.(".fm-chat-reactpop") && !t.closest?.(".fm-chat-act-emoji"))
        setReactFor(null);
      if (!t.closest?.(".fm-chat-menupop") && !t.closest?.(".fm-chat-act-menu"))
        setMenuFor(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!menuFor) return;
    const onKey = (e) => {
      if (e.key === "Escape") setMenuFor(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuFor]);

  // ===== File preview urls =====
  const fileUrlMapRef = useRef(new Map());
  const fileUrl = (f) => {
    const m = fileUrlMapRef.current;
    if (!m.has(f)) m.set(f, URL.createObjectURL(f));
    return m.get(f);
  };
  useEffect(() => {
    const m = fileUrlMapRef.current;
    const cur = new Set(files);
    for (const [k, u] of m.entries()) {
      if (!cur.has(k)) {
        try {
          URL.revokeObjectURL(u);
        } catch {}
        m.delete(k);
      }
    }
  }, [files]);
  useEffect(
    () => () => {
      const m = fileUrlMapRef.current;
      for (const u of m.values()) {
        try {
          URL.revokeObjectURL(u);
        } catch {}
      }
      m.clear();
    },
    []
  );

  // ===== Reply =====
  const startReply = (m) => {
    if (!m || m.deletedAt) return;
    setReplyTo(m);
    requestAnimationFrame(() => inputRef.current?.focus?.());
  };
  const clearReply = () => setReplyTo(null);

  // ===== Pick images =====
  const pickFiles = () => fileRef.current?.click?.();

  const pushFiles = (list) => {
    const ok = [];
    for (const f of list || []) {
      if (!String(f?.type || "").startsWith("image/")) {
        toast.info("Chỉ hỗ trợ ảnh.");
        continue;
      }
      if (f.size > 5 * 1024 * 1024) {
        toast.info("Ảnh phải nhỏ hơn 5MB.");
        continue;
      }
      ok.push(f);
    }
    if (!ok.length) return;
    setFiles((prev) => [...prev, ...ok].slice(0, 6));
  };

  const onPickFile = (e) => {
    const list = Array.from(e.target.files || []);
    e.target.value = "";
    if (!list.length) return;
    pushFiles(list);
  };

  const dataUrlToFile = (dataUrl, filename = "pasted.png") => {
    try {
      const m = String(dataUrl || "").match(
        /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
      );
      if (!m) return null;
      const mime = m[1],
        b64 = m[2];
      const bin = atob(b64);
      const len = bin.length;
      const u8 = new Uint8Array(len);
      for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
      return new File([u8], filename, { type: mime });
    } catch {
      return null;
    }
  };

  const pickDataImgFromHtml = (html = "") => {
    const s = String(html || "");
    const m = s.match(/<img[^>]+src=["'](data:image\/[^"']+)["']/i);
    return m?.[1] || "";
  };

  const removeFile = (idx) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  // ===== Reactions =====
  function summarizeReacts(m) {
    const list = safeArr(m?.reactions);
    const byEmoji = new Map();
    let myKey = "";
    for (const r of list) {
      const k = String(r?.emoji || "");
      const uid = uidOf(r?.userId);
      if (!k || !uid) continue;
      byEmoji.set(k, (byEmoji.get(k) || 0) + 1);
      if (uid === myId) myKey = k;
    }
    const top = [...byEmoji.entries()]
      .map(([emoji, count]) => ({ emoji, count }))
      .sort((a, b) => b.count - a.count);
    const total = list.length;
    return { top, myEmoji: myKey, total };
  }

  const applyLocalReaction = (messageId, emojiKey) => {
    setItems((prev) =>
      uniq(
        prev.map((m) => {
          if (String(m?._id || "") !== String(messageId)) return m;
          const list = safeArr(m?.reactions);
          const cur = list.find((r) => uidOf(r?.userId) === myId) || null;
          const kept = list.filter((r) => uidOf(r?.userId) !== myId);
          if (cur?.emoji === emojiKey) return { ...m, reactions: kept };
          return {
            ...m,
            reactions: [
              ...kept,
              { emoji: emojiKey, userId: myId, reactedAt: new Date().toISOString() },
            ],
          };
        })
      )
    );
  };

  const sendReaction = (messageId, emojiKey) => {
    if (!conversationId || !messageId || !emojiKey) return;
    socket.emit("chat:react", { conversationId, messageId, emoji: emojiKey }, (ack) => {
      if (!ack?.ok) {
        toast.error(ack?.message || "Không thể thả cảm xúc");
        load();
        return;
      }
      const serverMsg = ack?.message || ack?.data?.message || null;
      if (serverMsg?._id)
        setItems((prev) =>
          uniq(prev.map((m) => (String(m?._id || "") === String(serverMsg._id) ? serverMsg : m)))
        );
    });
  };

  const retract = (m) => {
    const id = String(m?._id || "");
    const sid = String(m?.senderId?._id || m?.senderId || "");
    const mine = sid === myId;
    if (!id || !mine || m?.deletedAt) return;
    setItems((prev) =>
      uniq(
        prev.map((x) =>
          String(x?._id || "") === id
            ? { ...x, deletedAt: new Date().toISOString(), content: "", attachments: [] }
            : x
        )
      )
    );
    socket.emit("chat:revoke", { conversationId, messageId: id }, (ack) => {
      if (!ack?.ok) toast.error(ack?.message || "Thu hồi thất bại");
    });
  };

  // ===== Copy =====
  const copyText = async (txt) => {
    const s = String(txt || "");
    if (!s) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(s);
        return true;
      }
    } catch {}
    try {
      const ta = document.createElement("textarea");
      ta.value = s;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  };

  const copyMessage = async (m) => {
    if (!m) return;
    if (m?.deletedAt) {
      toast.info("Tin nhắn đã thu hồi");
      return;
    }
    const imgs = safeArr(m?.attachments).filter(isImg);
    const hasText = !!String(m?.content || "").trim();
    const payload = hasText
      ? String(m.content || "")
      : imgs.length
      ? imgs.map((x) => x.url).filter(Boolean).join("\n")
      : "";
    if (!payload) {
      toast.info("Không có nội dung để copy");
      return;
    }
    const ok = await copyText(payload);
    ok ? toast.success("Đã copy") : toast.error("Copy thất bại");
  };

  // ===== Emoji insert =====
  const insertEmojiToInput = (char) => {
    if (!char) return;
    const el = inputRef.current;
    if (!el) {
      setText((t) => t + char);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + char + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + char.length;
      el.setSelectionRange?.(pos, pos);
    });
  };

  // ===== Drop/paste on input =====
  const onInputDrop = (e) => {
    try {
      const dt = e.dataTransfer;
      const key = dt?.getData?.("application/x-emoji-key") || "";
      const ch = dt?.getData?.("text/plain") || "";
      const maybeKey = key || emojiKeyFromChar(ch);
      const hasFiles = dt?.files && dt.files.length > 0;
      if (maybeKey) {
        e.preventDefault();
        e.stopPropagation();
        insertEmojiToInput(emojiChar(maybeKey) || ch);
        return;
      }
      if (hasFiles) {
        e.preventDefault();
        e.stopPropagation();
        pushFiles([...dt.files]);
      }
    } catch {}
  };

  const onInputPaste = (e) => {
    try {
      if (uploading) return;
      const dt = e.clipboardData;
      if (!dt) return;

      const items = Array.from(dt.items || []);
      const imgFiles = [];
      for (const it of items) {
        if (it?.kind === "file" && String(it.type || "").startsWith("image/")) {
          const f = it.getAsFile?.();
          if (f) imgFiles.push(f);
        }
      }

      if (imgFiles.length) {
        pushFiles(imgFiles);
        const hasText = !!String(dt.getData?.("text/plain") || "").trim();
        if (!hasText) {
          e.preventDefault();
          e.stopPropagation();
        }
        return;
      }

      const html = dt.getData?.("text/html") || "";
      const dataImg = pickDataImgFromHtml(html);
      if (dataImg) {
        const f = dataUrlToFile(dataImg, `pasted_${Date.now()}.png`);
        if (f) {
          pushFiles([f]);
          const hasText = !!String(dt.getData?.("text/plain") || "").trim();
          if (!hasText) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      }
    } catch {}
  };

  // ===== Drop reaction on message =====
  const onMsgDrop = (mid) => (e) => {
    try {
      const dt = e.dataTransfer;
      const key = dt?.getData?.("application/x-emoji-key") || "";
      const ch = dt?.getData?.("text/plain") || "";
      const emojiKey = key || emojiKeyFromChar(ch);
      if (!emojiKey) return;
      e.preventDefault();
      e.stopPropagation();
      setDragOverMid(null);
      applyLocalReaction(String(mid), emojiKey);
      sendReaction(String(mid), emojiKey);
    } catch {
      setDragOverMid(null);
    }
  };
  const onMsgDragOver = (mid) => (e) => {
    const dt = e.dataTransfer;
    const key = dt?.getData?.("application/x-emoji-key") || "";
    const ch = dt?.getData?.("text/plain") || "";
    const emojiKey = key || emojiKeyFromChar(ch);
    if (!emojiKey) return;
    e.preventDefault();
    setDragOverMid(String(mid));
  };
  const onMsgDragLeave = (mid) => () => {
    if (String(dragOverMid || "") === String(mid)) setDragOverMid(null);
  };

  // ===== Send =====
  const send = async () => {
    if (!conversationId) return;
    const content = String(text || "").trim();
    if (!content && !files.length) return;

    const clientMsgId = `c_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const tmp = {
      _id: `tmp_${clientMsgId}`,
      conversationId,
      senderId: myId,
      content,
      attachments: [],
      clientMsgId,
      replyTo: replyTo?._id || null,
      createdAt: new Date().toISOString(),
      _tmp: true,
    };

    setSending(true);
    setText("");

    setPickerOpen(false);

    setItems((prev) => uniq([...prev, tmp]));
    setSendMark({ state: "sending", msgId: tmp._id, at: tmp.createdAt });
    scrollBottom(true);

    let attachments = [];
    try {
      if (files.length) {
        setUploading(true);
        for (const f of files) {
          const up = await uploadChatImage(conversationId, f);
          if (up?.url)
            attachments.push({
              type: "image",
              url: up.url,
              name: up.name || f.name,
              size: up.size || f.size,
            });
        }
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || "Upload ảnh thất bại");
      setItems((prev) =>
        prev.filter((x) => String(x?._id || "") !== String(tmp._id || ""))
      );
      setSending(false);
      setUploading(false);
      setSendMark(null);
      return;
    } finally {
      setUploading(false);
      setFiles([]);
    }

    socket.emit(
      "chat:send",
      {
        conversationId,
        clientMsgId,
        content,
        attachments,
        replyTo: replyTo?._id || null,
      },
      (ack) => {
        setSending(false);
        setReplyTo(null);
        if (!ack?.ok) {
          toast.error(ack?.message || "Gửi thất bại");
          setItems((prev) =>
            prev.filter((x) => String(x?._id || "") !== String(tmp._id || ""))
          );
          setText(content);

          setSendMark(null);
          return;
        }
        const serverMsg = ack?.message;
        if (serverMsg) {
          setItems((prev) => {
            const filtered = prev.filter(
              (x) => String(x?._id || "") !== String(tmp._id || "")
            );
            return uniq([...filtered, serverMsg]);
          });
          setSendMark({
            state: "sent",
            msgId: serverMsg._id,
            at: serverMsg.createdAt,
          });
          scrollBottom(true);
        } else setSendMark(null);
      }
    );
  };

  // ===== Timeline (apply hiddenSet) + TIME SHIFT for image-only =====
  const timeline = useMemo(() => {
    const hidden = hiddenSet;
    const arr = safeArr(items).filter((x) => {
      const id = String(x?._id || "");
      return !id || !hidden.has(id);
    });

    const sidOf = (m) => String(m?.senderId?._id || m?.senderId || "");
    const hasImgsOf = (m) => safeArr(m?.attachments).some(isImg);
    const hasTextOf = (m) => !!String(m?.content || "").trim();
    const hasReplyOf = (m) => !!String(m?.replyTo || "").trim();
    const showTextBlockOf = (m) => hasReplyOf(m) || hasTextOf(m);

    // meta for grouping + time shifting
    const meta = arr.map((m, i) => {
      const sid = sidOf(m);
      const prev = arr[i - 1];
      const next = arr[i + 1];
      const prevSid = sidOf(prev);
      const nextSid = sidOf(next);

      const start =
        i === 0 ||
        !prev ||
        prevSid !== sid ||
        !sameDay(prev?.createdAt, m?.createdAt);

      const end =
        !next ||
        nextSid !== sid ||
        !sameDay(next?.createdAt, m?.createdAt);

      const hasImgs = hasImgsOf(m);
      const showTextBlock = showTextBlockOf(m);
      const imageOnly = !m?.deletedAt && hasImgs && !showTextBlock;

      return { start, end, sid, hasImgs, showTextBlock, imageOnly };
    });

    // Decide which message row will show the time
    // Default: the "end" message shows time
    // Exception: if the end message is image-only => shift time to previous text/reply message in the same sender/day cluster
    const showTimeKeySet = new Set();

    const keyOf = (m, i) => String(m?._id || m?.clientMsgId || i);

    for (let i = 0; i < arr.length; i++) {
      if (!meta[i]?.end) continue;

      // Normal case: end msg is not image-only => it owns time
      if (!meta[i].imageOnly) {
        showTimeKeySet.add(keyOf(arr[i], i));
        continue;
      }

      // Image-only end => shift time backwards to nearest message in same sender/day cluster that has text/reply
      const sid = meta[i].sid;
      const day = arr[i]?.createdAt;

      let owner = -1;
      for (let j = i - 1; j >= 0; j--) {
        if (meta[j].sid !== sid) break;
        if (!sameDay(arr[j]?.createdAt, day)) break;

        if (!arr[j]?.deletedAt && meta[j].showTextBlock) {
          owner = j;
          break;
        }
      }

      if (owner >= 0) showTimeKeySet.add(keyOf(arr[owner], owner));
      // else: no previous text => no time shown (as requested)
    }

    // Build timeline output (date separators + msg rows)
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      const m = arr[i];
      const p = arr[i - 1];

      if (i === 0 && m?.createdAt)
        out.push({
          t: "date",
          k: `d0_${m.createdAt}`,
          v: dayjs(m.createdAt).format("DD/MM/YYYY"),
        });
      else if (m?.createdAt && p?.createdAt && !sameDay(m.createdAt, p.createdAt))
        out.push({
          t: "date",
          k: `d_${m.createdAt}`,
          v: dayjs(m.createdAt).format("DD/MM/YYYY"),
        });

      const k = keyOf(m, i);
      out.push({
        t: "msg",
        k,
        m,
        start: meta[i].start,
        end: meta[i].end,
        showTime: showTimeKeySet.has(k),
      });
    }

    return out;
  }, [items, hiddenSet]);

  const toggleReactFor = (id) => {
    setMenuFor(null);
    setReactFor((cur) =>
      String(cur || "") === String(id || "") ? null : String(id || "")
    );
  };
  const toggleMenuFor = (id) => {
    setReactFor(null);
    setMenuFor((cur) =>
      String(cur?.mid || "") === String(id || "") ? null : { mid: String(id || "") }
    );
  };

  const lastReadableId = useMemo(() => {
    const hidden = hiddenSet;
    const arr = safeArr(items).filter((x) => {
      const id = String(x?._id || "");
      if (!id || hidden.has(id) || id.startsWith("tmp_")) return false;
      if (x?.deletedAt) return false;
      return true;
    });
    return String(arr.length ? arr[arr.length - 1]._id : "");
  }, [items, hiddenSet]);

  const lastSeenUsers = useMemo(() => {
    const id = String(lastReadableId || "");
    if (!id) return [];
    const m = msgMap.get(id) || safeArr(items).find((x) => String(x?._id || "") === id) || null;
    const ids = safeArr(m?.seenBy)
      .map((s) => String(s?.userId?._id || s?.userId || ""))
      .filter((uid) => uid && uid !== myId);
    return Array.from(new Set(ids));
  }, [lastReadableId, msgMap, items, myId]);

  const reactModalMsg = useMemo(() => {
    const mid = String(reactModal?.mid || "");
    if (!mid) return null;
    return msgMap.get(mid) || safeArr(items).find((x) => String(x?._id || "") === mid) || null;
  }, [reactModal, msgMap, items]);

  const reactModalSummary = useMemo(
    () => (reactModalMsg ? summarizeReacts(reactModalMsg) : { top: [], myEmoji: "", total: 0 }),
    [reactModalMsg]
  );

  const reactModalRows = useMemo(() => {
    const m = reactModalMsg;
    if (!m) return [];
    return safeArr(m?.reactions)
      .map((r) => ({
        emoji: String(r?.emoji || ""),
        userId: uidOf(r?.userId),
        at: r?.reactedAt ? new Date(r.reactedAt).getTime() : 0,
      }))
      .filter((x) => x.emoji && x.userId)
      .sort((a, b) => b.at - a.at);
  }, [reactModalMsg]);

  const reactFilter = String(reactModal?.filter || "all");
  const reactModalRowsFiltered = useMemo(
    () => (reactFilter === "all" ? reactModalRows : reactModalRows.filter((r) => r.emoji === reactFilter)),
    [reactModalRows, reactFilter]
  );

  return (
    <div className="fm-chat" style={{ height }}>
      {imgView?.url && (
        <div
          className="fm-chat-imgview"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeImg();
          }}
        >
          <button
            type="button"
            className="fm-chat-imgview-x"
            onClick={closeImg}
            aria-label="Đóng"
          >
            <i className="fa-solid fa-xmark" />
          </button>
          <div className="fm-chat-imgview-box">
            <img src={imgView.url} alt={imgView.name || "image"} />
          </div>
        </div>
      )}

      {!!reactModalMsg && (
        <div
          className="fm-chat-reactmodal"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeReactModal();
          }}
        >
          <div className="fm-chat-reactmodal-box" onMouseDown={(e) => e.stopPropagation()}>
            <div className="fm-chat-reactmodal-hd">
              <div className="fm-chat-reactmodal-title">Cảm xúc về tin nhắn</div>
              <button
                type="button"
                className="fm-chat-reactmodal-x"
                onClick={closeReactModal}
                aria-label="Đóng"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div className="fm-chat-reactmodal-filters">
              <button
                type="button"
                className={"fm-chat-rf" + (reactFilter === "all" ? " is-on" : "")}
                onClick={() => setReactModal((s) => (s ? { ...s, filter: "all" } : s))}
              >
                Tất cả{" "}
                {reactModalSummary.total > 0 ? (
                  <span className="ct">{reactModalSummary.total}</span>
                ) : null}
              </button>

              {safeArr(reactModalSummary.top).map((x) => (
                <button
                  key={x.emoji}
                  type="button"
                  className={"fm-chat-rf" + (reactFilter === x.emoji ? " is-on" : "")}
                  onClick={() => setReactModal((s) => (s ? { ...s, filter: x.emoji } : s))}
                >
                  <span className="em">{emojiChar(x.emoji)}</span>
                  <span className="ct">{x.count}</span>
                </button>
              ))}
            </div>

            <div className="fm-chat-reactmodal-body">
              {!reactModalRowsFiltered.length ? (
                <div className="fm-chat-reactmodal-empty">Chưa có cảm xúc.</div>
              ) : null}

              {reactModalRowsFiltered.map((r, idx) => {
                const u = memberMap.get(String(r.userId)) || null;
                const isMe = String(r.userId) === String(myId);
                const name = (u?.name || u?.nickname || "Người dùng") + (isMe ? " (Bạn)" : "");
                const ava = u?.avatarUrl || u?.imageUrl || "/images/avatar.png";
                const canOpen = !!onOpenUser && !isMe;

                return (
                  <button
                    key={idx}
                    type="button"
                    className={"fm-chat-reactrow" + (canOpen ? " is-click" : "")}
                    onClick={() => canOpen && onOpenUser(u?.rawUser || u || { _id: r.userId })}
                  >
                    <div className="fm-chat-reactrow-left">
                      <img
                        className="fm-chat-reactrow-ava"
                        src={ava}
                        alt={name}
                        onError={(e) => {
                          e.currentTarget.src = "/images/avatar.png";
                        }}
                      />
                      <div className="fm-chat-reactrow-name">{name}</div>
                    </div>
                    <div className="fm-chat-reactrow-em">{emojiChar(r.emoji)}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div ref={listRef} className="fm-chat-list">
        {loading ? <div className="fm-chat-loading">Đang tải…</div> : null}

        {timeline.map((row) => {
          if (row.t === "date")
            return (
              <div key={row.k} className="fm-chat-date">
                <span>{row.v}</span>
              </div>
            );

          const m = row.m;
          const rid = String(m?._id || "");
          const sid = String(m?.senderId?._id || m?.senderId || "");
          const mine = sid === myId;

          const sender = memberMap.get(sid) || null;
          const name = sender?.name || sender?.nickname || "";
          const ava = sender?.avatarUrl || sender?.imageUrl || "/images/avatar.png";
          const canOpen = !!onOpenUser && !!sid && !mine;

          const isTmp = Boolean(m?._tmp);
          const isDeleted = !!m?.deletedAt;

          const replyId = String(m?.replyTo || "");
          const replyMsg = replyId ? msgMap.get(replyId) || null : null;
          const replySenderId = replyMsg ? String(replyMsg?.senderId?._id || replyMsg?.senderId || "") : "";
          const replySender = replySenderId ? memberMap.get(replySenderId) || null : null;
          const replyName = replySender?.name || replySender?.nickname || "";
          const replyText = replyMsg?.deletedAt
            ? "Tin nhắn đã thu hồi"
            : clip(replyMsg?.content || "", 90);

          const { top: reactTop, myEmoji, total } = summarizeReacts(m);
          const badgeEmojis = reactTop.map((x) => x.emoji).filter(Boolean);
          const badgeCount = total || 0;
          const hasReactBadge = !isDeleted && badgeCount > 0 && badgeEmojis.length;

          const showSendMark =
            mine && row.end && !!sendMark?.state && String(sendMark?.msgId || "") === rid && !isDeleted;
          const showSeen = mine && row.end && rid && String(rid) === String(lastReadableId) && lastSeenUsers.length > 0;
          const seenShow = showSeen ? lastSeenUsers.slice(0, 5) : [];
          const seenMore = showSeen ? Math.max(0, lastSeenUsers.length - 5) : 0;

          const dragOn = String(dragOverMid || "") === rid;
          const reactOpen = String(reactFor || "") === rid;
          const menuOpen = String(menuFor?.mid || "") === rid;

          const reactPopup =
            reactOpen && !isDeleted ? (
              <div
                ref={reactPopRef}
                className="fm-chat-reactpop is-acts"
                style={{
                  "--shift": `${reactShift}px`,
                  transform: `translateX(calc(-50% + ${reactShift}px))`,
                  zIndex: 2000,
                }}
              >
                {EMOJIS.map((e) => {
                  const active = myEmoji === e.k;
                  return (
                    <button
                      key={e.k}
                      type="button"
                      className={"fm-chat-reactbtn" + (active ? " is-active" : "")}
                      title={active ? `${e.t} (đang chọn)` : e.t}
                      onClick={() => {
                        applyLocalReaction(rid, e.k);
                        sendReaction(rid, e.k);
                        setReactFor(null);
                      }}
                    >
                      {e.c}
                    </button>
                  );
                })}
              </div>
            ) : null;

          const imgs = safeArr(m?.attachments).filter(isImg);
          const hasImgs = imgs.length > 0;
          const hasText = !!String(m?.content || "").trim();
          const showTextBlock = !!replyId || hasText;
          const cols = Math.min(3, Math.max(1, imgs.length));
          const timeNode = row.showTime ? (
            <div className={"fm-chat-time" + (mine ? " is-mine" : "")}>
              {m?.createdAt ? dayjs(m.createdAt).format("HH:mm") : ""}
            </div>
          ) : null;

          const reactBadgeNode = hasReactBadge ? (
            <button
              type="button"
              className="fm-chat-reactbadge"
              onClick={() => setReactModal({ mid: rid, filter: "all" })}
              title="Xem cảm xúc"
            >
              <span className="ems">
                {badgeEmojis.map((k) => (
                  <span key={k} className="em">
                    {emojiChar(k)}
                  </span>
                ))}
              </span>
              {badgeCount > 1 ? <span className="ct">{badgeCount}</span> : null}
            </button>
          ) : null;

          const canDrop = !isDeleted && !isTmp;
          const bindDrop = canDrop
            ? { onDragOver: onMsgDragOver(rid), onDrop: onMsgDrop(rid), onDragLeave: onMsgDragLeave(rid) }
            : {};

          const copyLabel = !hasText && hasImgs ? "Copy hình ảnh" : "Copy tin nhắn";
          const menuPopup =
            menuOpen && !isDeleted ? (
              <div
                ref={menuPopRef}
                className="fm-chat-menupop"
                style={{
                  "--shift": `${menuShift}px`,
                  transform: `translateX(calc(-50% + ${menuShift}px))`,
                  zIndex: 2600,
                }}
              >
                <button
                  type="button"
                  className="fm-chat-menuit"
                  onClick={() => {
                    setMenuFor(null);
                    copyMessage(m);
                  }}
                >
                  <i className="fa-regular fa-copy" /> {copyLabel}
                </button>

                {mine && !isTmp ? (
                  <>
                    <div className="fm-chat-menusep" />
                    <button
                      type="button"
                      className="fm-chat-menuit"
                      onClick={() => {
                        setMenuFor(null);
                        retract(m);
                      }}
                    >
                      <i className="fa-solid fa-rotate-left" /> Thu hồi tin nhắn
                    </button>
                  </>
                ) : null}

                <div className="fm-chat-menusep" />
                <button
                  type="button"
                  className="fm-chat-menuit is-danger"
                  onClick={() => {
                    setMenuFor(null);
                    hideForMe(m);
                  }}
                >
                  <i className="fa-regular fa-trash-can" /> Xóa chỉ ở phía tôi
                </button>
              </div>
            ) : null;

          return (
            <div
              key={row.k}
              className={
                "fm-chat-row" +
                (mine ? " is-mine" : "") +
                (isTmp ? " is-tmp" : "") +
                (row.start ? " is-start" : "") +
                (row.end ? " is-end" : "") +
                (showSendMark ? " has-sendmark" : "") +
                (hasReactBadge ? " has-reactbadge" : "")
              }
            >
              {!mine &&
                (row.start ? (
                  <button
                    type="button"
                    className="fm-chat-ava"
                    onClick={() => canOpen && onOpenUser(sender?.rawUser || sender)}
                    title={name || "User"}
                  >
                    <img
                      src={ava}
                      alt={name || "User"}
                      onError={(e) => {
                        e.currentTarget.src = "/images/avatar.png";
                      }}
                    />
                  </button>
                ) : (
                  <div className="fm-chat-ava-spacer" />
                ))}

              <div className={"fm-chat-main" + (mine ? " is-mine" : "")}>
                {!isDeleted && mine && (
                  <div
                    className={"fm-chat-sideacts is-left" + (reactOpen || menuOpen ? " is-open" : "")}
                    style={reactOpen || menuOpen ? { zIndex: 1200 } : undefined}
                  >
                    <button type="button" className="fm-chat-act" onClick={() => startReply(m)} title="Trả lời">
                      <i className="fa-solid fa-reply" />
                    </button>

                    <div className="fm-chat-reactwrap">
                      <button
                        type="button"
                        className={"fm-chat-act fm-chat-act-emoji" + (reactOpen ? " is-on" : "")}
                        onClick={() => toggleReactFor(rid)}
                        title="Thả emoji"
                      >
                        <i className="fa-regular fa-face-smile" />
                      </button>
                      {reactPopup}
                    </div>

                    <div className="fm-chat-menuwrap">
                      <button
                        type="button"
                        className={"fm-chat-act fm-chat-act-menu" + (menuOpen ? " is-on" : "")}
                        onClick={() => toggleMenuFor(rid)}
                        title="Tùy chọn"
                      >
                        <i className="fa-solid fa-ellipsis" />
                      </button>
                      {menuPopup}
                    </div>
                  </div>
                )}

                <div className={"fm-chat-bubblewrap" + (mine ? " is-mine" : "")}>
                  {isDeleted ? (
                    <div
                      className={
                        "fm-chat-bubble is-deleted" +
                        (mine ? " is-mine" : "") +
                        (row.start ? " is-start" : "") +
                        (row.end ? " is-end" : "")
                      }
                    >
                      {!mine && row.start && !!name && <div className="fm-chat-inname">{name}</div>}
                      <div className="fm-chat-deleted">
                        <i className="fa-solid fa-ban" /> Tin nhắn đã thu hồi
                      </div>
                      {timeNode}
                    </div>
                  ) : (
                    <>
                      {showTextBlock && (
                        <div
                          className={
                            "fm-chat-bubble" +
                            (mine ? " is-mine" : "") +
                            (row.start ? " is-start" : "") +
                            (row.end && !hasImgs ? " is-end" : "") +
                            (dragOn ? " is-dragover" : "")
                          }
                          {...bindDrop}
                        >
                          {!mine && row.start && !!name && <div className="fm-chat-inname">{name}</div>}

                          {!!replyId && (
                            <div className="fm-chat-replyline">
                              <div className="fm-chat-replybar" />
                              <div className="fm-chat-replymeta">
                                <div className="fm-chat-replyname">{replyName || "Tin nhắn"}</div>
                                <div className="fm-chat-replytext">
                                  {replyMsg ? replyText : "(Không thể tải tin nhắn gốc)"}
                                </div>
                              </div>
                            </div>
                          )}

                          {hasText ? <div className="fm-chat-text">{m.content}</div> : null}
                          {timeNode}
                          {!hasImgs ? reactBadgeNode : null}
                        </div>
                      )}

                      {hasImgs && (
                        <div
                          className={
                            "fm-chat-bubble is-media" +
                            (mine ? " is-mine" : "") +
                            ((!showTextBlock && row.start) ? " is-start" : "") +
                            (row.end ? " is-end" : "") +
                            (dragOn ? " is-dragover" : "")
                          }
                          {...bindDrop}
                        >
                          {!mine && !showTextBlock && row.start && !!name && <div className="fm-chat-inname">{name}</div>}

                          <div className={"fm-chat-atts cols-" + cols}>
                            {imgs.map((a, idx) => (
                              <button
                                key={`${a.url || idx}`}
                                type="button"
                                className="fm-chat-img"
                                onClick={() => setImgView({ url: a.url, name: a.name || "Ảnh" })}
                                title="Xem ảnh"
                              >
                                <img src={a.url} alt={a.name || "image"} />
                              </button>
                            ))}
                          </div>

                          {reactBadgeNode}
                        </div>
                      )}
                    </>
                  )}

                  {showSendMark && (
                    <div className={"fm-chat-sendmark-float" + (mine ? " is-mine" : "")}>
                      {sendMark.state === "sending" ? (
                        <>
                          <i className="fa-solid fa-circle-notch fa-spin" /> Đang gửi
                        </>
                      ) : showSeen ? (
                        <span className="fm-chat-sendseen" title="Đã xem">
                          {seenShow.map((uid) => {
                            const u = memberMap.get(String(uid)) || null;
                            const ava = u?.avatarUrl || u?.imageUrl || "/images/avatar.png";
                            const nm = u?.name || u?.nickname || "Người dùng";
                            return (
                              <img
                                key={uid}
                                className="fm-chat-seen-ava"
                                src={ava}
                                alt={nm}
                                title={`${nm} đã xem`}
                                onError={(e) => {
                                  e.currentTarget.src = "/images/avatar.png";
                                }}
                              />
                            );
                          })}
                          {seenMore > 0 ? <span className="fm-chat-seen-more">+{seenMore}</span> : null}
                        </span>
                      ) : (
                        <>
                          <i className="fa-solid fa-check" /> Đã gửi
                        </>
                      )}
                    </div>
                  )}

                  {showSeen && !showSendMark && (
                    <div className={"fm-chat-seen" + (mine ? " is-mine" : "")}>
                      {lastSeenUsers.map((uid) => {
                        const u = memberMap.get(String(uid)) || null;
                        const ava = u?.avatarUrl || u?.imageUrl || "/images/avatar.png";
                        const nm = u?.name || u?.nickname || "Người dùng";
                        return (
                          <img
                            key={uid}
                            className="fm-chat-seen-ava"
                            src={ava}
                            alt={nm}
                            title={`${nm} đã xem`}
                            onError={(e) => {
                              e.currentTarget.src = "/images/avatar.png";
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>

                {!isDeleted && !mine && (
                  <div
                    className={"fm-chat-sideacts is-right" + (reactOpen || menuOpen ? " is-open" : "")}
                    style={reactOpen || menuOpen ? { zIndex: 1200 } : undefined}
                  >
                    <button type="button" className="fm-chat-act" onClick={() => startReply(m)} title="Trả lời">
                      <i className="fa-solid fa-reply" />
                    </button>

                    <div className="fm-chat-reactwrap">
                      <button
                        type="button"
                        className={"fm-chat-act fm-chat-act-emoji" + (reactOpen ? " is-on" : "")}
                        onClick={() => toggleReactFor(rid)}
                        title="Thả emoji"
                      >
                        <i className="fa-regular fa-face-smile" />
                      </button>
                      {reactPopup}
                    </div>

                    <div className="fm-chat-menuwrap">
                      <button
                        type="button"
                        className={"fm-chat-act fm-chat-act-menu" + (menuOpen ? " is-on" : "")}
                        onClick={() => toggleMenuFor(rid)}
                        title="Tùy chọn"
                      >
                        <i className="fa-solid fa-ellipsis" />
                      </button>
                      {menuPopup}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {!loading && !items.length ? <div className="fm-chat-empty">{emptyText || "Chưa có tin nhắn nào."}</div> : null}
        <div />
      </div>

      <div className="fm-chat-compose">
        {!!replyTo && (
          <div className="fm-chat-replybox">
            <div className="fm-chat-replybox-left">
              <div className="fm-chat-replybox-title">
                <i className="fa-solid fa-reply" /> Đang trả lời
              </div>
              <div className="fm-chat-replybox-text">{clip(replyTo?.content || "", 120)}</div>
            </div>
            <button
              type="button"
              className="fm-chat-replybox-close"
              onClick={clearReply}
              aria-label="Hủy trả lời"
            >
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
        )}

        <div className="fm-chat-inputrow">
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={onPickFile} />
          <button type="button" className="fm-chat-attach" onClick={pickFiles} title="Chọn hình ảnh">
            <i className="fa-regular fa-images"></i>
          </button>

          <div className="fm-chat-inputwrap">
            {!!files.length && (
              <div className="fm-chat-draftimgs">
                {files.map((f, idx) => (
                  <div key={idx} className="fm-chat-draftimg">
                    <img src={fileUrl(f)} alt={f.name} />
                    <button
                      type="button"
                      className="fm-chat-draftimg-x"
                      onClick={() => removeFile(idx)}
                      aria-label="Xóa ảnh"
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="fm-chat-inputbox">
              <textarea
                ref={inputRef}
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  const el = e.target;
                  el.style.height = "0px";
                  el.style.height = Math.min(el.scrollHeight, 140) + "px";
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    e.stopPropagation();
                    send();
                  }
                }}
                onDrop={onInputDrop}
                onPaste={onInputPaste}
                onDragOver={(e) => {
                  const dt = e.dataTransfer;
                  const has =
                    dt?.getData?.("application/x-emoji-key") ||
                    emojiKeyFromChar(dt?.getData?.("text/plain") || "") ||
                    "";
                  if (has || (dt?.files && dt.files.length)) e.preventDefault();
                }}
                placeholder={uploading ? "Đang tải ảnh…" : "Nhập tin nhắn…"}
                className="fm-chat-input fm-chat-textarea"
                disabled={uploading}
                rows={1}
              />

              <button
                type="button"
                className={"fm-chat-input-emoji in-input" + (pickerOpen ? " is-on" : "")}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPickerOpen((v) => !v);
                }}
                onClick={(e) => e.preventDefault()}
                title="Emoji (chèn vào nội dung)"
                disabled={uploading}
              >
                <i className="fa-regular fa-face-smile" />
              </button>

              {pickerOpen && (
                <div className="fm-chat-emoji-pop is-input" onMouseDown={(e) => e.stopPropagation()}>
                  <Picker
                    data={data}
                    locale="vi"
                    theme="dark"
                    previewPosition="none"
                    navPosition="bottom"
                    onEmojiSelect={(emoji) => {
                      insertEmojiToInput(emoji?.native || "");
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <button type="button" className="fm-chat-send" onClick={send} disabled={sending || uploading} title="Gửi">
            <i className="fa-regular fa-paper-plane" />
          </button>
        </div>
      </div>
    </div>
  );
}
