// user-app/src/pages/Messages/Messages.jsx
import dayjs from "dayjs";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import "./Messages.css";
import ChatBox from "../Chat/ChatBox";
import UserSideModal from "../UserProfile/UserSideModal";

import { getMe } from "../../api/account";
import { getSocket } from "../../lib/socket";
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
  // hỗ trợ nhiều kiểu trả về để tránh vỡ khi bạn đổi BE
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.data)) return payload.data;
  return [];
};

export default function Messages() {
  const nav = useNavigate();
  const qUserId = useQueryUserId();

  const socket = useMemo(() => getSocket(), []);

  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState(null);

  const [convs, setConvs] = useState([]);

  const convByPeer = useMemo(() => {
    const m = new Map();
    safeArr(convs).forEach((c) => {
      const pid = getId(c?.peer);
      if (pid) m.set(pid, c);
    });
    return m;
  }, [convs]);

  const [tab, setTab] = useState("all"); // all | unread
  const [searchText, setSearchText] = useState("");
  const [searchGlobal, setSearchGlobal] = useState([]);
  const searchTimer = useRef(null);

  const [activeConvId, setActiveConvId] = useState("");
  const [activePeer, setActivePeer] = useState(null);

  const [sideOpen, setSideOpen] = useState(false);
  const [sideUser, setSideUser] = useState(null);

  const openUser = (u) => {
    const id = getId(u);
    if (!id) return;
    setSideUser(u);
    setSideOpen(true);
  };

  const filteredConvs = useMemo(() => {
    const base = safeArr(convs);
    if (tab === "unread") return base.filter((c) => Number(c?.unread || 0) > 0);
    return base;
  }, [convs, tab]);

  const loadMeAndConvs = async () => {
    try {
      setLoading(true);

      const meData = await getMe();
      setMe(meData);

      const listRaw = await listDmConversations();
      const arr = unwrapItems(listRaw);

      // sort desc by lastMessageAt
      arr.sort((a, b) => new Date(b?.lastMessageAt || 0) - new Date(a?.lastMessageAt || 0));

      setConvs(arr);

      // ✅ KHÔNG lưu lịch sử activeConv (không localStorage)
      // Nếu không có query ?u=... thì mặc định chọn item đầu
      if (!qUserId) {
        const pickConv = arr[0] || null;
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

  // realtime: conversation update (unread + last msg)
  useEffect(() => {
    const onConvUpdate = (p) => {
      const cid = String(p?.conversationId || "");
      if (!cid) return;

      setConvs((prev) => {
        const arr = safeArr(prev);
        const idx = arr.findIndex((x) => String(x?._id || "") === cid);

        if (idx === -1) {
          // DM mới hoặc list chưa có -> reload nhẹ
          listDmConversations()
            .then((raw) => setConvs(unwrapItems(raw)))
            .catch(() => {});
          return prev;
        }

        const cur = arr[idx];
        const next = {
          ...cur,
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
  }, [socket]);

  // (optional but robust) khi hide_for_me -> reload list
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

  // open DM by query param: /tin-nhan?u=USERID
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

          const raw = await listDmConversations();
          const arr = unwrapItems(raw);
          arr.sort((a, b) => new Date(b?.lastMessageAt || 0) - new Date(a?.lastMessageAt || 0));
          setConvs(arr);

          const found = arr.find((x) => String(x?._id || "") === cid) || null;
          if (found?.peer) setActivePeer(found.peer);
        }
      } catch (e) {
        console.error(e);
        toast.error("Không thể mở đoạn chat");
      } finally {
        nav("/tin-nhan", { replace: true });
      }
    })();
  }, [qUserId, me, convByPeer, nav]);

  // search global users
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
        const filtered = safeArr(rs).filter((u) => !convByPeer.has(getId(u)));
        setSearchGlobal(filtered);
      } catch (e) {
        console.error(e);
        setSearchGlobal([]);
      }
    }, 250);

    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [searchText, convByPeer]);

  const openConv = (c) => {
    const cid = String(c?._id || "");
    if (!cid) return;
    setActiveConvId(cid);
    setActivePeer(c?.peer || null);
  };

  const openDmWithUser = async (userId) => {
    const uid = String(userId || "");
    if (!uid) return;
    if (uid === String(me?._id || ""))
      return toast.info("Bạn không thể nhắn tin cho chính mình.");

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

      const raw = await listDmConversations();
      const arr = unwrapItems(raw);
      arr.sort((a, b) => new Date(b?.lastMessageAt || 0) - new Date(a?.lastMessageAt || 0));
      setConvs(arr);

      const found = arr.find((x) => String(x?._id || "") === cid) || null;
      if (found?.peer) setActivePeer(found.peer);

      setSearchText("");
      setSearchGlobal([]);
    } catch (e) {
      console.error(e);
      toast.error("Không thể tạo đoạn chat");
    }
  };

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

  return (
    <>
      <div className="msg-page">
        <aside className="msg-left">
          <div className="msg-left-head">
            <div className="msg-head-row">
              <div className="msg-title">Đoạn chat</div>
              <div className="msg-actions">
                <button className="msg-icbtn" title="Tùy chọn">⋯</button>
                <button className="msg-icbtn" title="Tin nhắn mới">✎</button>
              </div>
            </div>

            <div className="msg-search">
              <i className="fa-solid fa-magnifying-glass" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Tìm kiếm trên Messenger"
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
              </button>
            </div>
          </div>

          <div className="msg-left-body">
            {loading ? <div className="msg-loading">Đang tải…</div> : null}

            {!!String(searchText || "").trim() ? (
              <>
                <div className="msg-section">
                  <div className="msg-sec-title">Đã nhắn tin</div>
                  {safeArr(convs)
                    .filter((c) =>
                      getName(c?.peer).toLowerCase().includes(String(searchText).toLowerCase())
                    )
                    .map((c) => {
                      const active = String(activeConvId) === String(c?._id || "");
                      const peer = c.peer;
                      const unread = Number(c?.unread || 0);

                      const lastText = String(c?.lastMessage?.text || "").trim();
                      const lastAt = c?.lastMessageAt || c?.lastMessage?.createdAt || null;

                      return (
                        <button
                          key={String(c._id)}
                          className={`msg-item ${active ? "is-active" : ""}`}
                          onClick={() => openConv(c)}
                        >
                          <img
                            className="msg-ava"
                            src={getAvatar(peer)}
                            alt=""
                            onError={(e) => (e.currentTarget.src = "/images/avatar.png")}
                          />
                          <div className="msg-mid">
                            <div className="msg-top">
                              <div className="msg-name">{getName(peer)}</div>
                              {unread > 0 ? <span className="msg-badge">{unread}</span> : null}
                            </div>
                            <div className="msg-sub">
                              <span className="msg-last">{lastText || " "}</span>
                              {lastAt ? <span className="msg-dot">•</span> : null}
                              {lastAt ? (
                                <span className="msg-time">{dayjs(lastAt).format("HH:mm")}</span>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>

                <div className="msg-section">
                  <div className="msg-sec-title">Người dùng khác</div>
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
                            <span className="msg-last">Nhắn tin</span>
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                {!filteredConvs.length && !loading ? (
                  <div className="msg-empty">Chưa có đoạn chat nào.</div>
                ) : null}

                {filteredConvs.map((c) => {
                  const active = String(activeConvId) === String(c?._id || "");
                  const peer = c.peer;
                  const unread = Number(c?.unread || 0);

                  const lastText = String(c?.lastMessage?.text || "").trim();
                  const lastAt = c?.lastMessageAt || c?.lastMessage?.createdAt || null;

                  return (
                    <button
                      key={String(c._id)}
                      className={`msg-item ${active ? "is-active" : ""}`}
                      onClick={() => openConv(c)}
                    >
                      <img
                        className="msg-ava"
                        src={getAvatar(peer)}
                        alt=""
                        onError={(e) => (e.currentTarget.src = "/images/avatar.png")}
                      />
                      <div className="msg-mid">
                        <div className="msg-top">
                          <div className="msg-name">{getName(peer)}</div>
                          {unread > 0 ? <span className="msg-badge">{unread}</span> : null}
                        </div>
                        <div className="msg-sub">
                          <span className="msg-last">{lastText || " "}</span>
                          {lastAt ? <span className="msg-dot">•</span> : null}
                          {lastAt ? (
                            <span className="msg-time">{dayjs(lastAt).format("HH:mm")}</span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </aside>

        <main className="msg-right">
          {!activeConvId ? (
            <div className="msg-placeholder">
              <div className="msg-ph-title">Chọn một đoạn chat</div>
              <div className="msg-ph-sub">Tìm người dùng để bắt đầu cuộc trò chuyện.</div>
            </div>
          ) : (
            <div className="msg-right-wrap">
              <div className="msg-right-head">
                <button
                  className="msg-peer"
                  onClick={() => activePeer && openUser(activePeer)}
                  title="Xem thông tin"
                >
                  <img
                    className="msg-peer-ava"
                    src={getAvatar(activePeer)}
                    alt=""
                    onError={(e) => (e.currentTarget.src = "/images/avatar.png")}
                  />
                  <div className="msg-peer-name">{getName(activePeer)}</div>
                </button>

                <div className="msg-right-actions">
                  <button className="msg-icbtn" title="Gọi">
                    <i className="fa-solid fa-phone" />
                  </button>
                  <button className="msg-icbtn" title="Video">
                    <i className="fa-solid fa-video" />
                  </button>
                  <button
                    className="msg-icbtn"
                    title="Thông tin"
                    onClick={() => activePeer && openUser(activePeer)}
                  >
                    <i className="fa-solid fa-circle-info" />
                  </button>
                </div>
              </div>

              <div className="msg-chat">
                <ChatBox
                  conversationId={activeConvId}
                  meId={String(me?._id || "")}
                  members={chatMembers}
                  height={"100%"}
                  onOpenUser={(u) => openUser(u)}
                />
              </div>
            </div>
          )}
        </main>
      </div>

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
