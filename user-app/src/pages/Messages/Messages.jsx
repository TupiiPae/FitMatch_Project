import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import "./Messages.css";
import ChatBox from "../Chat/ChatBox";
import AiChatBox from "../Chat/AiChatBox";
import UserSideModal from "../UserProfile/UserSideModal";

import { getMe } from "../../api/account";
import { getSocket } from "../../lib/socket";
import api from "../../lib/api";
import {
  listDmConversations,
  createOrGetDmConversation,
  searchDmUsers,
} from "../../api/chat";

const safeArr = (v) => (Array.isArray(v) ? v : []);
const pick = (...v) => v.find((x) => x !== undefined && x !== null && x !== "");

const getId = (u) => String(pick(u?._id, u?.id, u?.userId, u?.uid) || "");
const getProfile = (u) => u?.profile || u?.user?.profile || u?.userProfile || {};
const getName = (u) =>
  pick(
    getProfile(u)?.nickname,
    u?.nickname,
    u?.name,
    u?.fullName,
    u?.username,
    u?.email,
    "Người dùng"
  );
const getAvatar = (u) =>
  pick(
    getProfile(u)?.avatarUrl,
    getProfile(u)?.avatar,
    u?.avatarUrl,
    u?.avatar,
    u?.photoUrl,
    u?.imageUrl
  ) || "/images/avatar.png";

function useQueryUserId() {
  const loc = useLocation();
  return useMemo(() => {
    const sp = new URLSearchParams(loc.search);
    const u = sp.get("u");
    return u ? String(u) : "";
  }, [loc.search]);
}

function useQueryOpenAi() {
  const loc = useLocation();
  return useMemo(() => {
    const sp = new URLSearchParams(loc.search);
    const v = String(sp.get("ai") || "").toLowerCase().trim();
    return v === "1" || v === "true" || v === "ai";
  }, [loc.search]);
}

const normType = (t) => String(t || "").toLowerCase().trim();
const isDmConv = (c, meId = "") => {
  const t = normType(c?.type || c?.kind || c?.conversationType);
  if (t) return t === "dm" || t === "direct";
  if (c?.roomId || c?.matchRoomId || c?.room || c?.matchRoom) return false;
  const members = safeArr(c?.members);
  if (members.length !== 2) return false;
  return true;
};

const ensurePeer = (c, meId = "") => {
  if (c?.peer) return c;
  const mems = safeArr(c?.members)
    .map((m) => m?.user || m)
    .filter(Boolean);
  const peer = mems.find((u) => getId(u) && getId(u) !== String(meId)) || null;
  return { ...c, peer };
};

const unwrapItems = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  return [];
};

const AI_CONV_ID = "ai";
const AI_TITLE = "Fitmatch AI";
const AI_SUB = "Quét ảnh món ăn • Gợi ý thực đơn • Gợi ý lịch tập";
const AI_HELP_PAGES = [
  {
    key: "scan",
    title: "Quét ảnh món ăn",
    sub: "Gửi kèm ảnh món ăn để AI ước tính kcal & macro.",
    prompts: [
      "Mình gửi ảnh món ăn này, giúp ước tính kcal + protein/carb/fat cho 1 phần.",
      "Ảnh này là món gì? Ước tính dinh dưỡng giúp mình.",
      "Món trong ảnh này khoảng bao nhiêu kcal? Cho mình luôn macro nhé.",
      "Giúp mình ước lượng khẩu phần (gram) và kcal cho món trong ảnh.",
      "Nếu mình ăn món trong ảnh này, nên ghi log khẩu phần như thế nào?",
    ],
  },
  {
    key: "menu_rec",
    title: "Gợi ý thực đơn (DB FitMatch)",
    sub: "AI sẽ lấy mục tiêu + calo của bạn và gợi ý thực đơn phù hợp trong FitMatch.",
    prompts: [
      "Gợi ý thực đơn phù hợp với mục tiêu của mình.",
      "Gợi ý thực đơn 3–5 ngày cho mình theo calo mục tiêu.",
      "Gợi ý thực đơn trong khoảng 2200-2400 kcal/ngày.",
      "Mình muốn thực đơn ít tinh bột - tăng đạm, gợi ý giúp mình.",
      "Cho mình vài thực đơn FitMatch phù hợp để mình lưu lại.",
    ],
  },
  {
    key: "menu_gen",
    title: "Tạo thực đơn mới (AI tự tạo)",
    sub: "Dùng khi không thấy thực đơn phù hợp trong FitMatch.",
    prompts: [
      "Tạo thực đơn mới 3 ngày cho mình theo calo mục tiêu.",
      "Mình không ưng các thực đơn trên, tạo thực đơn mới giúp mình.",
      "Tạo thực đơn mới ít dầu mỡ, dễ làm, đủ calo mục tiêu.",
      "Tạo thực đơn mới cho mục tiêu tăng cơ, ưu tiên đạm cao.",
    ],
  },
  {
    key: "plan_rec",
    title: "Gợi ý lịch tập (DB FitMatch)",
    sub: "AI sẽ ưu tiên theo mục tiêu + cường độ tập của bạn.",
    prompts: [
      "Gợi ý lịch tập phù hợp với mục tiêu của mình.",
      "Gợi ý lịch tập tại nhà cho mình.",
      "Gợi ý lịch tập tại gym cho mình.",
      "Gợi ý lịch tập Cardio và HIIT cho mình.",
      "Cho mình vài lịch tập FitMatch phù hợp để mình lưu lại.",
    ],
  },
  {
    key: "plan_gen",
    title: "Tạo lịch tập mới (AI tự tạo)",
    sub: "Dùng khi không thấy lịch tập phù hợp trong FitMatch.",
    prompts: [
      "Mình không ưng các lịch tập trên, tạo lịch tập mới giúp mình.",
      "Tạo lịch tập mới 3 buổi/tuần cho người mới bắt đầu.",
      "Tạo lịch tập mới 4 buổi/tuần để tăng cơ.",
      "Tạo lịch tập mới ưu tiên giảm mỡ, tăng sức bền.",
    ],
  },
  {
    key: "nutrition",
    title: "Hỏi nhanh dinh dưỡng / macro",
    sub: "Hỏi kiến thức dinh dưỡng chung (không cần thực đơn DB).",
    prompts: [
      "1 ngày mình nên chia protein/carb/fat thế nào để phù hợp mục tiêu?",
      "Ăn trước tập nên ăn gì để đủ năng lượng mà không nặng bụng?",
      "Sau tập nên ăn gì để phục hồi và tăng cơ?",
      "Một bữa nên có bao nhiêu protein là hợp lý?",
      "Mình muốn giảm mỡ nhưng không mất cơ, nên chú ý gì về ăn uống?",
    ],
  },
];

const AI_HELP_INTERVAL_MS = 3000;


export default function Messages() {
  const nav = useNavigate();
  const qUserId = useQueryUserId();
  const qAi = useQueryOpenAi();

  const socket = useMemo(() => getSocket(), []);

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);

  const [convs, setConvs] = useState([]);

  const [tab, setTab] = useState("all"); // all | new | unread
  const [searchText, setSearchText] = useState("");
  const [searchGlobal, setSearchGlobal] = useState([]);
  const searchTimer = useRef(null);

  const [activeConvId, setActiveConvId] = useState("");
  const [activePeer, setActivePeer] = useState(null);

  const [dmLock, setDmLock] = useState({ locked: false, text: "" });

  const resetDmLock = () => setDmLock({ locked: false, text: "" });

  const lockDm = (msg) =>
    setDmLock({
      locked: true,
      text: msg || "Người này hiện không nhận tin nhắn từ người lạ",
    });

  // ===== AI preview (for sidebar) =====
  const [aiPreview, setAiPreview] = useState({
    lastText: "Nhắn để bắt đầu…",
    lastAt: null,
    unread: 0,
  });

  const isAiActive = String(activeConvId || "") === AI_CONV_ID;

    const onAiHelpPointerDown = (e) => {
    // chỉ xử lý khi dropdown đang mở
    if (!aiHelpOpen) return;

    setAiHelpAuto(false); // user chạm => tắt auto
    setAiHelpDragging(true);

    aiHelpDragRef.current = {
      active: true,
      startX: e.clientX,
      pointerId: e.pointerId,
    };

  };

  const onAiHelpPointerMove = (e) => {
    if (!aiHelpDragRef.current.active) return;
    const dx = e.clientX - aiHelpDragRef.current.startX;
    setAiHelpDragX(dx);
  };

  const onAiHelpPointerEnd = (e) => {
    if (!aiHelpDragRef.current.active) return;

    const dx = e.clientX - aiHelpDragRef.current.startX;
    const w = aiHelpViewportRef.current?.clientWidth || 1;
    const threshold = Math.min(90, w * 0.22);

    if (dx > threshold) {
      // prev
      setAiHelpIndex((i) => (i - 1 + AI_HELP_PAGES.length) % AI_HELP_PAGES.length);
    } else if (dx < -threshold) {
      // next
      setAiHelpIndex((i) => (i + 1) % AI_HELP_PAGES.length);
    }

    setAiHelpDragX(0);
    setAiHelpDragging(false);
    aiHelpDragRef.current = { active: false, startX: 0, pointerId: null };

    try {
      aiHelpViewportRef.current?.releasePointerCapture?.(e.pointerId);
    } catch {}
  };

    // ===== AI Help dropdown (carousel) =====
  const [aiHelpOpen, setAiHelpOpen] = useState(false);
  const [aiHelpIndex, setAiHelpIndex] = useState(0);
  const [aiHelpAuto, setAiHelpAuto] = useState(true);

  const aiHelpRef = useRef(null);
  const aiHelpBtnRef = useRef(null);
  const aiHelpViewportRef = useRef(null);

  const [aiHelpDragX, setAiHelpDragX] = useState(0);
  const [aiHelpDragging, setAiHelpDragging] = useState(false);
  const aiHelpDragRef = useRef({ active: false, startX: 0, pointerId: null });

  const closeAiHelp = () => {
    setAiHelpOpen(false);
    setAiHelpDragX(0);
    setAiHelpDragging(false);
    aiHelpDragRef.current = { active: false, startX: 0, pointerId: null };
  };

  const toggleAiHelp = () => {
    setAiHelpOpen((v) => {
      const next = !v;
      if (next) {
        setAiHelpIndex(0);     // mở ra luôn ở trang 1
        setAiHelpAuto(true);   // bật auto khi mở
      }
      return next;
    });
  };

  const copyPromptText = async (text) => {
    const t = String(text || "").trim();
    if (!t) return;

    try {
      await navigator.clipboard.writeText(t);
      toast.success("Đã copy câu hỏi mẫu ");
    } catch {
      // fallback cho môi trường chặn clipboard
      try {
        const ta = document.createElement("textarea");
        ta.value = t;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        toast.success("Đã copy câu hỏi mẫu");
      } catch {
        toast.error("Không thể copy. Bạn thử copy thủ công giúp mình nhé.");
      }
    }
  };

  const goToAiHelp = (idx) => {
    const n = AI_HELP_PAGES.length;
    const next = ((Number(idx) || 0) % n + n) % n;
    setAiHelpIndex(next);
    setAiHelpAuto(false); // user đã can thiệp => tắt auto
  };

  const openAi = () => {
    setActiveConvId(AI_CONV_ID);
    setActivePeer(null);
    setAiPreview((p) => ({ ...p, unread: 0 }));
  };

  // ===== delete conversation (box chat) =====
  const [delOpen, setDelOpen] = useState(false);
  const [delConv, setDelConv] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [aiResetSeq, setAiResetSeq] = useState(0);

  const openDelete = (c) => {
    if (!c?._id) return;
    setDelConv(c);
    setDelOpen(true);
  };

  const closeDelete = () => {
    if (deleting) return;
    setDelOpen(false);
    setDelConv(null);
  };

  const confirmDelete = async () => {
    const cid = String(delConv?._id || "");
    if (!cid) return;

    try {
      setDeleting(true);

      if (cid === AI_CONV_ID) {
        await api.delete("/ai/messages"); // baseURL đang là /api => thành /api/ai/messages

        // reset preview + remount AiChatBox
        setAiPreview({ lastText: "Nhắn để bắt đầu…", lastAt: null, unread: 0 });
        setAiResetSeq((s) => s + 1);

        // dọn session (nếu còn kẹt prefill từ AI)
        try { sessionStorage.removeItem("fm_ai_food_prefill"); } catch {}

        toast.success("Đã xóa đoạn chat với FitMatch AI");
        closeDelete();
        return;
      }

      // ✅ DM: delete conversation
      await api.delete(`/chat/dm/conversations/${cid}`);

      setConvs((prev) => safeArr(prev).filter((x) => String(x?._id || "") !== cid));

      if (String(activeConvId || "") === cid) {
        setActiveConvId(AI_CONV_ID);
        setActivePeer(null);
      }

      toast.success("Đã xóa đoạn lịch sử tin nhắn");
      closeDelete();
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Không thể xóa đoạn chat");
    } finally {
      setDeleting(false);
    }
  };

  // ESC để đóng modal
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && delOpen) closeDelete();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [delOpen, deleting]);

  // header: shared team
  const [sharedInfo, setSharedInfo] = useState({ loading: false, text: "" });

  const [sideOpen, setSideOpen] = useState(false);
  const [sideUser, setSideUser] = useState(null);

  const openUser = (u) => {
    const id = getId(u);
    if (!id) return;
    setSideUser(u);
    setSideOpen(true);
  };

  const convByPeer = useMemo(() => {
    const m = new Map();
    safeArr(convs).forEach((c) => {
      const pid = getId(c?.peer);
      if (pid) m.set(pid, c);
    });
    return m;
  }, [convs]);

  const isNewConv = (c) => !!c?.otherSent && !c?.meSent;
  const isAllConv = (c) => !!c?.meSent;
  const isUnreadConv = (c) => !!c?.meSent && Number(c?.unread || 0) > 0;

  const newConvs = useMemo(() => safeArr(convs).filter(isNewConv), [convs]);
  const allConvs = useMemo(() => safeArr(convs).filter(isAllConv), [convs]);
  const unreadConvs = useMemo(() => safeArr(convs).filter(isUnreadConv), [convs]);

  const newCount = newConvs.length;
  const unreadCount = unreadConvs.length;

  const listByTab = useMemo(() => {
    if (tab === "new") return newConvs;
    if (tab === "unread") return unreadConvs;
    return allConvs;
  }, [tab, newConvs, unreadConvs, allConvs]);

  const loadMeAndConvs = async () => {
    try {
      setLoading(true);

      const meData = await getMe();
      setMe(meData);

      const listRaw = await listDmConversations();
      const rawArr = unwrapItems(listRaw);

      const meId = String(meData?._id || "");
      const arr = rawArr
        .filter((c) => isDmConv(c, meId))
        .map((c) => ensurePeer(c, meId));

      arr.sort((a, b) => new Date(b?.lastMessageAt || 0) - new Date(a?.lastMessageAt || 0));
      setConvs(arr);

      // Không auto-open nếu user vào theo ?u= hoặc ?ai=1
      if (!qUserId && !qAi) {
        const pickConv = arr.find((c) => isAllConv(c)) || arr[0] || null;
        if (pickConv?._id) {
          setActiveConvId(String(pickConv._id));
          setActivePeer(pickConv.peer || null);
        } else {
          openAi();
        }
      }

      // Nếu vào theo ?ai=1 => ép mở AI
      if (qAi) {
        openAi();
      }
    } catch (e) {
      console.error(e);
      toast.error("Không tải được tin nhắn");
      // vẫn mở AI để user có chỗ chat
      openAi();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeAndConvs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== realtime update (DM only) =====
  useEffect(() => {
    const onConvUpdate = (p) => {
      const pType = normType(p?.type || p?.kind || p?.conversationType);
      if (pType && pType !== "dm" && pType !== "direct") return;

      const cid = String(p?.conversationId || "");
      if (!cid) return;

      setConvs((prev) => {
        const arr = safeArr(prev);
        const idx = arr.findIndex((x) => String(x?._id || "") === cid);

        // DM mới xuất hiện -> reload list
        if (idx === -1) {
          listDmConversations()
            .then((raw) => {
              const meId = String(me?._id || "");
              const nextRaw = unwrapItems(raw);
              const next = nextRaw
                .filter((c) => isDmConv(c, meId))
                .map((c) => ensurePeer(c, meId));

              next.sort((a, b) => new Date(b?.lastMessageAt || 0) - new Date(a?.lastMessageAt || 0));
              setConvs(next);
            })
            .catch(() => {});
          return prev;
        }

        const cur = arr[idx];
        const senderId = String(p?.lastMessage?.senderId || "");
        const meId = String(me?._id || "");
        const patchFlags =
          senderId && meId
            ? {
                meSent: senderId === meId ? true : cur?.meSent,
                otherSent: senderId && senderId !== meId ? true : cur?.otherSent,
              }
            : {};

        const next = {
          ...cur,
          ...patchFlags,
          lastMessage: p?.lastMessage ?? cur?.lastMessage,
          lastMessageAt:
            p?.lastMessage?.createdAt ??
            p?.lastMessageAt ??
            cur?.lastMessageAt ??
            cur?.lastMessage?.createdAt ??
            null,
          unread: typeof p?.unread === "number" ? p.unread : cur?.unread,
        };

        const copy = [...arr];
        copy[idx] = next;
        copy.sort((a, b) => new Date(b?.lastMessageAt || 0) - new Date(a?.lastMessageAt || 0));
        return copy;
      });
    };

    socket.on("chat:conversation_update", onConvUpdate);
    return () => socket.off("chat:conversation_update", onConvUpdate);
  }, [socket, me]);

  // reload list khi hide_for_me (optional)
  useEffect(() => {
    const onHidden = () => {
      listDmConversations()
        .then((raw) => {
          const meId = String(me?._id || "");
          const arrRaw = unwrapItems(raw);
          const arr = arrRaw
            .filter((c) => isDmConv(c, meId))
            .map((c) => ensurePeer(c, meId));

          arr.sort((a, b) => new Date(b?.lastMessageAt || 0) - new Date(a?.lastMessageAt || 0));
          setConvs(arr);
        })
        .catch(() => {});
    };
    socket.on("chat:hidden_update", onHidden);
    return () => socket.off("chat:hidden_update", onHidden);
  }, [socket, me]);

  // ===== open by query /tin-nhan?u=USERID =====
  useEffect(() => {
    (async () => {
      if (!qUserId) return;
      if (!me?._id) return;

      if (qUserId === String(me._id)) {
        toast.info("Bạn không thể nhắn tin cho chính mình.");
        nav("/tin-nhan", { replace: true });
        return;
      }

      const existed = convByPeer.get(String(qUserId));
      if (existed?._id) {
        setActiveConvId(String(existed._id));
        setActivePeer(existed.peer || null);
        nav("/tin-nhan", { replace: true });
        return;
      }

      try {
      const conv = await createOrGetDmConversation(qUserId);
      const cid = String(conv?._id || "");
      if (cid) {
        setActiveConvId(cid);
        if (conv?.peer) setActivePeer(conv.peer);

        if (conv?.canSend === false) lockDm("Người này hiện không nhận tin nhắn từ người lạ");
        else resetDmLock();
      }
      } catch (e) {
        console.error(e);
        toast.error("Không thể mở đoạn chat");
      } finally {
        nav("/tin-nhan", { replace: true });
      }
    })();
  }, [qUserId, me, convByPeer, nav]);

  // ===== search global users =====
  useEffect(() => {
    const q = String(searchText || "").trim();
    if (!q) {
      setSearchGlobal([]);
      return;
    }
    if (searchTimer.current) clearTimeout(searchTimer.current);

    searchTimer.current = setTimeout(async () => {
      try {
        const rsRaw = await searchDmUsers(q);
        const rs = unwrapItems(rsRaw);
        setSearchGlobal(rs);
      } catch (e) {
        console.error(e);
        setSearchGlobal([]);
      }
    }, 250);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchText]);

  const openConv = (c) => {
    const meId = String(me?._id || "");
    if (!isDmConv(c, meId)) {
      toast.info("Đoạn chat này thuộc Connect (Duo/Group), không hiển thị trong Tin nhắn.");
      return;
    }
    const cid = String(c?._id || "");
    if (!cid) return;
    setActiveConvId(cid);
    setActivePeer(c?.peer || null);
    resetDmLock();
  };

  const openDmWithUser = async (userId) => {
    const uid = String(userId || "");
    if (!uid) return;
    if (uid === String(me?._id || "")) return toast.info("Bạn không thể nhắn tin cho chính mình.");

    const existed = convByPeer.get(uid);
    if (existed?._id) {
      openConv(existed);
      setSearchText("");
      setSearchGlobal([]);
      return;
    }

    try {
    const conv = await createOrGetDmConversation(uid);
    const cid = String(conv?._id || "");
    if (cid) {
      setActiveConvId(cid);
      if (conv?.peer) setActivePeer(conv.peer);

      // ✅ lock input nếu bị chặn
      if (conv?.canSend === false) {
        lockDm("Người này hiện không nhận tin nhắn từ người lạ");
      } else {
        resetDmLock();
      }
    }

      setSearchText("");
      setSearchGlobal([]);
    } catch (e) {
      console.error("createOrGetDmConversation error:", e?.response?.data || e);
      toast.error(e?.response?.data?.message || e?.message || "Không thể tạo đoạn chat");
    }
  };

  // ===== header: shared team info =====
  useEffect(() => {
    let alive = true;

    const run = async () => {
      if (isAiActive) {
        if (alive) setSharedInfo({ loading: false, text: "" });
        return;
      }

      const peerId = getId(activePeer);
      const peerName = getName(activePeer);

      if (!peerId || !peerName) {
        if (alive) setSharedInfo({ loading: false, text: "" });
        return;
      }

      try {
        if (alive) setSharedInfo({ loading: true, text: "" });

        const r = await api.get("/chat/shared-team", { params: { userId: peerId } });
        const data = r.data?.data ?? r.data;

        if (!alive) return;

        if (data?.shared && data?.room?.name) {
          setSharedInfo({
            loading: false,
            text: `Bạn đang cùng nhóm "${data.room.name}" với ${peerName}`,
          });
        } else {
          setSharedInfo({
            loading: false,
            text: `Bạn và ${peerName} chưa có nhóm chung`,
          });
        }
      } catch {
        if (!alive) return;
        setSharedInfo({
          loading: false,
          text: `Bạn và ${peerName} chưa có nhóm chung`,
        });
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [activePeer, isAiActive]);

    // đóng dropdown nếu rời khỏi AI chat
  useEffect(() => {
    if (!isAiActive) closeAiHelp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAiActive]);

  // auto slide mỗi 3s khi open và còn auto
  useEffect(() => {
    if (!aiHelpOpen || !aiHelpAuto) return;

    const t = setInterval(() => {
      setAiHelpIndex((i) => (i + 1) % AI_HELP_PAGES.length);
    }, AI_HELP_INTERVAL_MS);

    return () => clearInterval(t);
  }, [aiHelpOpen, aiHelpAuto]);

  // click outside + ESC để đóng
  useEffect(() => {
    if (!aiHelpOpen) return;

    const onDown = (e) => {
      const el = aiHelpRef.current;
      const btn = aiHelpBtnRef.current;
      if (el?.contains(e.target)) return;
      if (btn?.contains(e.target)) return;
      closeAiHelp();
    };

    const onKey = (e) => {
      if (e.key === "Escape") closeAiHelp();
    };

    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [aiHelpOpen]);

  const chatMembers = useMemo(() => {
    const meId = String(me?._id || "");
    const peerId = getId(activePeer);
    const out = [];
    if (meId) {
      out.push({
        _id: meId,
        id: meId,
        name: getName(me),
        nickname: getProfile(me)?.nickname,
        avatarUrl: getAvatar(me),
        imageUrl: getAvatar(me),
        rawUser: me,
      });
    }
    if (peerId) {
      out.push({
        _id: peerId,
        id: peerId,
        name: getName(activePeer),
        nickname: getProfile(activePeer)?.nickname,
        avatarUrl: getAvatar(activePeer),
        imageUrl: getAvatar(activePeer),
        rawUser: activePeer,
      });
    }
    return out;
  }, [me, activePeer]);

  // ===== render AI item =====
  const renderAiItem = () => {
    const active = isAiActive;
    const unread = Number(aiPreview?.unread || 0);
    const lastText = String(aiPreview?.lastText || AI_SUB);
    const lastAt = aiPreview?.lastAt || null;

    return (
      <div
        className={`msg-item is-ai ${active ? "is-active" : ""}`}
        role="button"
        tabIndex={0}
        onClick={openAi}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openAi();
          }
        }}
      >
        <div className="msg-ava-box msg-ava-ai" aria-hidden="true">
          <img className="msg-ava" src="/images/ai-chatbot.png" alt="FitMatch AI" />
        </div>

        <div className="msg-mid">
          <div className="msg-top">
            <div className="msg-name">
              {AI_TITLE} <span className="msg-pill msg-pill-ai">AI</span>
            </div>
            {unread > 0 ? <span className="msg-badge">{unread}</span> : null}
          </div>

          <div className="msg-sub">
            <span className="msg-last">{lastText || " "}</span>
            {lastAt ? <span className="msg-dot">•</span> : null}
            {lastAt ? <span className="msg-time">{dayjs(lastAt).format("HH:mm")}</span> : null}
          </div>

          <button
            type="button"
            className="msg-trash"
            title="Xóa đoạn chat AI"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openDelete({ _id: AI_CONV_ID, peer: { name: AI_TITLE } });
            }}
          >
            <i className="fa-solid fa-trash" />
          </button>
        </div>
      </div>
    );
  };

  // ===== render list (DM item) =====
  const renderConvItem = (c) => {
    const active = String(activeConvId) === String(c?._id || "");
    const peer = c.peer;
    const unread = Number(c?.unread || 0);

    const lastText = String(c?.lastMessage?.text || c?.lastMessage?.content || "").trim();
    const lastAt = c?.lastMessageAt || c?.lastMessage?.createdAt || null;

    return (
      <div
        key={String(c._id)}
        className={`msg-item ${active ? "is-active" : ""}`}
        role="button"
        tabIndex={0}
        onClick={() => openConv(c)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openConv(c);
          }
        }}
      >
        <img
          className="msg-ava"
          src={getAvatar(peer)}
          alt=""
          onError={(e) => (e.currentTarget.src = "/images/avatar.png")}
        />

        <div className="msg-mid">
          <div className="msg-top">
            <div className="msg-name">
              {getName(peer)}
              {isNewConv(c) ? <span className="msg-pill">Mới</span> : null}
            </div>
            {unread > 0 ? <span className="msg-badge">{unread}</span> : null}
          </div>

          <div className="msg-sub">
            <span className="msg-last">{lastText || " "}</span>
            {lastAt ? <span className="msg-dot">•</span> : null}
            {lastAt ? <span className="msg-time">{dayjs(lastAt).format("HH:mm")}</span> : null}
          </div>
        </div>

        <button
          type="button"
          className="msg-trash"
          title="Xóa đoạn chat"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            openDelete(c);
          }}
        >
          <i className="fa-solid fa-trash" />
        </button>
      </div>
    );
  };

  const isDelAi = String(delConv?._id || "") === AI_CONV_ID;

  return (
    <>
      <div className="msg-page">
        <aside className="msg-left">
          <div className="msg-left-head">
            <div className="msg-head-row">
              <div className="msg-title">Tin nhắn</div>
            </div>

            <div className="msg-search">
              <i className="fa-solid fa-magnifying-glass" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Tìm kiếm người dùng xung quanh bạn "
              />
              {!!searchText && (
                <button
                  className="msg-clear"
                  onClick={() => {
                    setSearchText("");
                    setSearchGlobal([]);
                  }}
                  title="Xóa"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              )}
            </div>

            <div className="msg-tabs">
              <button className={`msg-tab ${tab === "all" ? "is-on" : ""}`} onClick={() => setTab("all")}>
                Tất cả
              </button>

              <button className={`msg-tab ${tab === "unread" ? "is-on" : ""}`} onClick={() => setTab("unread")}>
                Chưa đọc
                {unreadCount > 0 ? <span className="msg-tab-badge">{unreadCount}</span> : null}
              </button>

              <button className={`msg-tab ${tab === "new" ? "is-on" : ""}`} onClick={() => setTab("new")}>
                Mới
                {newCount > 0 ? <span className="msg-tab-badge">{newCount}</span> : null}
              </button>
            </div>
          </div>

          <div className="msg-left-body">
            {loading ? <div className="msg-loading">Đang tải…</div> : null}

            {/* ✅ AI pinned luôn ở đầu */}
            <div className="msg-pinned">{renderAiItem()}</div>

            {!!String(searchText || "").trim() ? (
              <>
                <div className="msg-section">
                  <div className="msg-sec-title">Cuộc trò chuyện</div>
                  {safeArr(convs)
                    .filter((c) =>
                      getName(c?.peer).toLowerCase().includes(String(searchText).toLowerCase())
                    )
                    .map(renderConvItem)}
                  {!safeArr(convs).some((c) =>
                    getName(c?.peer).toLowerCase().includes(String(searchText).toLowerCase())
                  ) ? <div className="msg-empty">Không có cuộc trò chuyện phù hợp</div> : null}
                </div>

                <div className="msg-section">
                  <div className="msg-sec-title">Người dùng</div>
                  {!searchGlobal.length ? (
                    <div className="msg-empty">Không có kết quả</div>
                  ) : (
                    safeArr(searchGlobal).map((u) => (
                      <button
                        key={getId(u)}
                        className="msg-item"
                        onClick={() => openDmWithUser(getId(u))}
                      >
                        <img
                          className="msg-ava"
                          src={getAvatar(u)}
                          alt=""
                          onError={(e) => (e.currentTarget.src = "/images/avatar.png")}
                        />
                        <div className="msg-mid">
                          <div className="msg-top">
                            <div className="msg-name">{getName(u)}</div>
                          </div>
                          <div className="msg-sub">
                            <span className="msg-last">Mở khung chat</span>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                {!listByTab.length && !loading ? (
                  <div className="msg-empty">
                    {tab === "new"
                      ? "Chưa có tin nhắn mới."
                      : tab === "unread"
                      ? "Không có tin nhắn chưa đọc."
                      : "Chưa có cuộc trò chuyện nào."}
                  </div>
                ) : null}

                {listByTab.map(renderConvItem)}
              </>
            )}
          </div>
        </aside>

        <main className="msg-right">
          <div className="msg-right-box">
            {!activeConvId ? (
              <div className="msg-placeholder">
                <div className="msg-ph-title">Chọn một đoạn chat</div>
                <div className="msg-ph-sub">Tìm người dùng để bắt đầu cuộc trò chuyện.</div>
              </div>
            ) : isAiActive ? (
              <div className="msg-right-wrap">
                <div className="msg-right-head">
                  <div className="msg-peer">
                    <div className="msg-peer-ava msg-peer-ava-ai" aria-hidden="true">
                      <img className="msg-ava" src="/images/ai-chatbot.png" alt="FitMatch AI" />
                    </div>
                    <div className="msg-peer-text">
                      <div className="msg-peer-name">{AI_TITLE}</div>
                      <div className="msg-peer-sub">{AI_SUB}</div>
                    </div>
                  </div>

                  <div className="msg-head-spacer" />

                  {/* ✅ Help icon + dropdown carousel */}
                  <div className="msg-ai-help" ref={aiHelpRef}>
                    <button
                      ref={aiHelpBtnRef}
                      type="button"
                      className={`msg-ai-help-btn ${aiHelpOpen ? "is-on" : ""}`}
                      title="Gợi ý câu hỏi cho FitMatch AI"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleAiHelp();
                      }}
                    >
                      <i className="fa-solid fa-circle-question" />
                    </button>

                    {aiHelpOpen && (
                      <div className="msg-ai-dd" role="dialog" aria-label="Gợi ý câu hỏi FitMatch AI">
                        <div className="msg-ai-dd-head">
                          <div className="msg-ai-dd-title">Gợi ý câu hỏi</div>
                          <div className="msg-ai-dd-hint">Nhấp vào câu để copy</div>
                        </div>

                        <div
                          className="msg-ai-dd-viewport"
                          ref={aiHelpViewportRef}
                          onPointerDown={onAiHelpPointerDown}
                          onPointerMove={onAiHelpPointerMove}
                          onPointerUp={onAiHelpPointerEnd}
                          onPointerCancel={onAiHelpPointerEnd}
                        >
                          <div
                            className="msg-ai-dd-track"
                            style={{
                              transform: `translate3d(calc(${-aiHelpIndex * 100}% + ${aiHelpDragX}px), 0, 0)`,
                              transition: aiHelpDragging ? "none" : "transform .22s ease",
                            }}
                          >
                            {AI_HELP_PAGES.map((pg) => (
                              <div className="msg-ai-dd-page" key={pg.key}>
                                <div className="msg-ai-dd-page-top">
                                  <div className="msg-ai-dd-page-title">{pg.title}</div>
                                  {pg.sub ? <div className="msg-ai-dd-page-sub">{pg.sub}</div> : null}
                                </div>

                                <div className="msg-ai-dd-page-body msg-ai-dd-grid">
                                  <div className="msg-ai-dd-list">
                                    {safeArr(pg.prompts).map((q, idx) => (
                                      <div
                                        key={`${pg.key}-${idx}`}
                                        className="msg-ai-dd-item"
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => copyPromptText(q)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            copyPromptText(q);
                                          }
                                        }}
                                        title="Nhấp để copy"
                                      >
                                        {q}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="msg-ai-dd-dots" aria-label="Chuyển trang gợi ý">
                          {AI_HELP_PAGES.map((_, i) => (
                            <button
                              key={`dot-${i}`}
                              type="button"
                              className={`msg-ai-dd-dot ${i === aiHelpIndex ? "is-on" : ""}`}
                              onClick={() => goToAiHelp(i)}
                              aria-label={`Trang ${i + 1}`}
                              title={`Trang ${i + 1}`}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="msg-chat">
                  <AiChatBox
                    key={`ai-${aiResetSeq}`}
                    meId={String(me?._id || "")}
                    height={"100%"}
                    emptyText={
                      "Bắt đầu hỏi FitMatch AI… (có thể gửi kèm ảnh món ăn)\n" +
                      "Gợi ý nhanh: “Gợi ý thực đơn…”, “Gợi ý lịch tập…”, “Tạo thực đơn mới”.\n" +
                      "Nhấn biểu tượng (?) ở góc phải để xem thêm câu hỏi mẫu."
                    }
                    onPreview={({ lastText, lastAt }) => {
                      setAiPreview((p) => ({
                        ...p,
                        lastText: lastText || p.lastText,
                        lastAt: lastAt || p.lastAt,
                      }));
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="msg-right-wrap">
                <div className="msg-right-head">
                  <button className="msg-peer" onClick={() => activePeer && openUser(activePeer)}>
                    <img
                      className="msg-peer-ava"
                      src={getAvatar(activePeer)}
                      alt=""
                      onError={(e) => (e.currentTarget.src = "/images/avatar.png")}
                    />
                    <div className="msg-peer-text">
                      <div className="msg-peer-name">{getName(activePeer)}</div>
                      <div className="msg-peer-sub">
                        {sharedInfo.loading ? "Đang kiểm tra nhóm chung…" : (sharedInfo.text || "")}
                      </div>
                    </div>
                  </button>
                </div>

                <div className="msg-chat">
                  {dmLock.locked ? (
                    <div className="msg-dm-locked">
                      <div className="msg-dm-locked-txt">
                        {dmLock.text || "Người này hiện không nhận tin nhắn từ người lạ"}
                      </div>
                    </div>
                  ) : (
                    <ChatBox
                      conversationId={activeConvId}
                      meId={String(me?._id || "")}
                      members={chatMembers}
                      height={"100%"}
                      onOpenUser={(u) => openUser(u)}
                      emptyText={"Chưa có tin nhắn nào giữa 2 bạn."}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {delOpen && (
        <div
          className="msg-modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDelete();
          }}
        >
          <div className="msg-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="msg-modal-title">
              {isDelAi ? "Xóa đoạn chat AI?" : "Xóa đoạn chat?"}
            </div>

            <div className="msg-modal-sub">
              {isDelAi ? (
                <>Bạn sẽ xóa toàn bộ nội dung trò chuyện với <b>{AI_TITLE}</b>. Thao tác này không thể hoàn tác.</>
              ) : (
                <>Bạn sẽ xóa lịch sử tin nhắn với <b>{getName(delConv?.peer)}</b>. Thao tác này không thể hoàn tác.</>
              )}
            </div>

            <div className="msg-modal-actions">
              <button className="msg-btn ghost" onClick={closeDelete} disabled={deleting}>
                Hủy
              </button>
              <button className="msg-btn danger" onClick={confirmDelete} disabled={deleting}>
                {deleting ? "Đang xóa..." : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      )}

      <UserSideModal
        open={sideOpen}
        user={sideUser}
        meId={String(me?._id || "")}
        onClose={() => setSideOpen(false)}
        onStartChat={(uid) => {
          setSideOpen(false);
          openDmWithUser(uid);
        }}
      />
    </>
  );
}
