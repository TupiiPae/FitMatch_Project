import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import "./Messages.css";
import ChatBox from "../Chat/ChatBox";
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

const unwrapItems = (payload) => {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload?.data?.items)) return payload.data.items;
  return [];
};

export default function Messages() {
  const nav = useNavigate();
  const qUserId = useQueryUserId();
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

  const [sideOpen, setSideOpen] = useState(false);
  const [sideUser, setSideUser] = useState(null);

    // ===== delete conversation (box chat) =====
  const [delOpen, setDelOpen] = useState(false);
  const [delConv, setDelConv] = useState(null);
  const [deleting, setDeleting] = useState(false);

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

      await api.delete(`/api/chat/dm/conversations/${cid}`);

      // remove khỏi sidebar ngay
      setConvs((prev) => safeArr(prev).filter((x) => String(x?._id || "") !== cid));

      // nếu đang mở đúng conv thì đóng
      if (String(activeConvId || "") === cid) {
        setActiveConvId("");
        setActivePeer(null);
      }

      toast.success("Đã xóa đoạn chat");
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
      const arr = unwrapItems(listRaw);

      arr.sort((a, b) => new Date(b?.lastMessageAt || 0) - new Date(a?.lastMessageAt || 0));
      setConvs(arr);

      // Không auto-open nếu user vào theo ?u=
      if (!qUserId) {
        const pickConv = arr.find((c) => isAllConv(c)) || arr[0] || null;
        if (pickConv?._id) {
          setActiveConvId(String(pickConv._id));
          setActivePeer(pickConv.peer || null);
        } else {
          setActiveConvId("");
          setActivePeer(null);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Không tải được tin nhắn");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeAndConvs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== realtime update =====
  useEffect(() => {
    const onConvUpdate = (p) => {
      const cid = String(p?.conversationId || "");
      if (!cid) return;

      setConvs((prev) => {
        const arr = safeArr(prev);
        const idx = arr.findIndex((x) => String(x?._id || "") === cid);

        // DM mới xuất hiện (VD người khác nhắn lần đầu) -> reload list để có peer + flags
        if (idx === -1) {
          listDmConversations()
            .then((raw) => {
              const next = unwrapItems(raw);
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
          const arr = unwrapItems(raw);
          arr.sort((a, b) => new Date(b?.lastMessageAt || 0) - new Date(a?.lastMessageAt || 0));
          setConvs(arr);
        })
        .catch(() => {});
    };
    socket.on("chat:hidden_update", onHidden);
    return () => socket.off("chat:hidden_update", onHidden);
  }, [socket]);

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
        // tạo/đã có room nhưng sidebar sẽ KHÔNG hiện nếu chưa có tin nhắn (BE đã filter)
        const conv = await createOrGetDmConversation(qUserId);
        const cid = String(conv?._id || "");
        if (cid) {
          setActiveConvId(cid);
          if (conv?.peer) setActivePeer(conv.peer);
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
    const cid = String(c?._id || "");
    if (!cid) return;
    setActiveConvId(cid);
    setActivePeer(c?.peer || null);
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
      if (!cid) throw new Error("No conversationId");

      setActiveConvId(cid);
      if (conv?.peer) setActivePeer(conv.peer);

      // sidebar không hiện nếu chưa có tin nhắn (BE filter) -> OK theo yêu cầu
      setSearchText("");
      setSearchGlobal([]);
    } catch (e) {
      console.error(e);
      toast.error("Không thể tạo đoạn chat");
    }
  };

  // ===== header: shared team info =====
  useEffect(() => {
    let alive = true;

    const run = async () => {
      const peerId = getId(activePeer);
      const peerName = getName(activePeer);

      if (!peerId || !peerName) {
        if (alive) setSharedInfo({ loading: false, text: "" });
        return;
      }

      try {
        if (alive) setSharedInfo({ loading: true, text: "" });

        const r = await api.get("/api/chat/shared-team", { params: { userId: peerId } });
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
  }, [activePeer]);

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

  // ===== render list (normal mode) =====
  const renderConvItem = (c) => {
    const active = String(activeConvId) === String(c?._id || "");
    const peer = c.peer;
    const unread = Number(c?.unread || 0);

    const lastText = String(c?.lastMessage?.text || "").trim();
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
                placeholder="Tìm kiếm người dùng"
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
              <button
                className={`msg-tab ${tab === "all" ? "is-on" : ""}`}
                onClick={() => setTab("all")}
              >
                Tất cả
              </button>

              <button
                className={`msg-tab ${tab === "unread" ? "is-on" : ""}`}
                onClick={() => setTab("unread")}
              >
                Chưa đọc
                {unreadCount > 0 ? <span className="msg-tab-badge">{unreadCount}</span> : null}
              </button>

              <button
                className={`msg-tab ${tab === "new" ? "is-on" : ""}`}
                onClick={() => setTab("new")}
              >
                Mới
                {newCount > 0 ? <span className="msg-tab-badge">{newCount}</span> : null}
              </button>
            </div>
          </div>

          <div className="msg-left-body">
            {loading ? <div className="msg-loading">Đang tải…</div> : null}

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
                  <ChatBox
                    conversationId={activeConvId}
                    meId={String(me?._id || "")}
                    members={chatMembers}
                    height={"100%"}
                    onOpenUser={(u) => openUser(u)}
                    emptyText={"Chưa có tin nhắn nào giữa 2 bạn."}
                  />
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
            <div className="msg-modal-title">Xóa đoạn chat?</div>
            <div className="msg-modal-sub">
              Bạn sẽ xóa toàn bộ tin nhắn với{" "}
              <b>{getName(delConv?.peer)}</b>. Thao tác này không thể hoàn tác.
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
