import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { getSocket } from "../../lib/socket";
import { listNotifications, markNotificationRead } from "../../api/notification";
import "./ChatBell.css";

const safeArr = (v) => (Array.isArray(v) ? v : []);
const unwrapItems = (payload) => payload?.items ?? payload?.data?.items ?? [];

const isChatNoti = (n) => {
  const type = String(n?.type || "");
  const d = n?.data || {};
  return type === "chat_message" || d?.screen === "Messages";
};

const getConversationId = (n) => {
  const d = n?.data || {};
  return String(d?.conversationId || d?.cid || d?.conversation || "");
};

export default function ChatBell() {
  const nav = useNavigate();
  const socket = useMemo(() => getSocket(), []);
  const boxRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [raw, setRaw] = useState([]);

  const loadFirst = async () => {
    try {
      setLoading(true);
      const l = await listNotifications({ limit: 40 });
      setRaw(unwrapItems(l));
      setCursor(l?.nextCursor ?? null);
    } catch (e) {
      console.error(e);
      setRaw([]);
      setCursor(null);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!cursor) return;
    try {
      setLoading(true);
      const l = await listNotifications({ limit: 40, cursor });
      setRaw((prev) => [...safeArr(prev), ...unwrapItems(l)]);
      setCursor(l?.nextCursor ?? null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFirst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // realtime: chỉ nhận noti chat_message
  useEffect(() => {
    const onNew = (n) => {
      if (!n || !isChatNoti(n)) return;
      setRaw((prev) => [n, ...safeArr(prev)]);
    };

    const onReadUpdate = ({ id, readAt }) => {
      setRaw((prev) =>
        safeArr(prev).map((x) => (String(x?._id) === String(id) ? { ...x, readAt } : x))
      );
    };

    socket.on("noti:new", onNew);
    socket.on("noti:read_update", onReadUpdate);

    return () => {
      socket.off("noti:new", onNew);
      socket.off("noti:read_update", onReadUpdate);
    };
  }, [socket]);

  // click outside close
  useEffect(() => {
    const onDown = (e) => {
      if (!open) return;
      if (boxRef.current && boxRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Group theo conversation: lấy message mới nhất + đếm unread (trong phạm vi loaded)
  const grouped = useMemo(() => {
    const chats = safeArr(raw).filter(isChatNoti);
    const byCid = new Map();

    for (const n of chats) {
      const cid = getConversationId(n);
      if (!cid) continue;

      const ts = n?.createdAt ? new Date(n.createdAt).getTime() : 0;
      const cur = byCid.get(cid);

      if (!cur) {
        byCid.set(cid, {
          cid,
          latest: n,
          latestTs: ts,
          unreadCount: n?.readAt ? 0 : 1,
          all: [n],
        });
      } else {
        cur.all.push(n);
        if (!n?.readAt) cur.unreadCount += 1;
        if (ts >= cur.latestTs) {
          cur.latest = n;
          cur.latestTs = ts;
        }
      }
    }

    return Array.from(byCid.values()).sort((a, b) => (b.latestTs || 0) - (a.latestTs || 0));
  }, [raw]);

  const unreadTotal = useMemo(
    () => grouped.reduce((sum, g) => sum + Number(g.unreadCount || 0), 0),
    [grouped]
  );

  const openConversation = async (g) => {
    const cid = g?.cid;
    if (!cid) {
      nav("/tin-nhan");
      return;
    }

    // mark read các noti chat (trong phạm vi loaded) của conversation này
    const toMark = safeArr(g?.all).filter((x) => !x?.readAt && x?._id);
    if (toMark.length) {
      await Promise.all(toMark.map((x) => markNotificationRead(x._id).catch(() => null)));
    }

    setOpen(false);
    nav(`/tin-nhan?conversationId=${encodeURIComponent(String(cid))}`, {
      state: { conversationId: String(cid) },
    });
  };

  return (
    <div className="cnb-wrap" ref={boxRef}>
      <button
        type="button"
        className="cnb-btn"
        onClick={() => setOpen((v) => !v)}
        title="Tin nhắn"
        aria-haspopup="menu"
        aria-expanded={open ? "true" : "false"}
      >
        <i className="fa-solid fa-message" />
        {unreadTotal > 0 ? (
          <span className="cnb-badge">{unreadTotal > 99 ? "99+" : unreadTotal}</span>
        ) : null}
      </button>

      {open ? (
        <div className="cnb-pop" role="menu" onClick={(e) => e.stopPropagation()}>
          <div className="cnb-head">
            <div className="cnb-title">Tin nhắn</div>
            <button
              type="button"
              className="cnb-openinbox"
              onClick={() => {
                setOpen(false);
                nav("/tin-nhan");
              }}
            >
              Mở hộp thư
            </button>
          </div>

          <div className="cnb-list">
            {loading && !grouped.length ? <div className="cnb-empty">Đang tải…</div> : null}
            {!loading && !grouped.length ? <div className="cnb-empty">Chưa có tin nhắn.</div> : null}

            {grouped.map((g) => {
              const n = g.latest || {};
              const title = n?.title || "Tin nhắn mới";
              const body = n?.body || "";
              const time = n?.createdAt ? dayjs(n.createdAt).format("HH:mm DD/MM") : "";

              return (
                <div
                  key={g.cid}
                  className={`cnb-item ${g.unreadCount > 0 ? "cnb-unread" : "cnb-read"}`}
                  role="menuitem"
                  tabIndex={0}
                  onClick={() => openConversation(g)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      openConversation(g);
                    }
                  }}
                >
                  <div className="cnb-top">
                    <div className="cnb-item-title">{title}</div>
                    <div className="cnb-right">
                      <div className="cnb-time">{time}</div>
                      {g.unreadCount > 0 ? <span className="cnb-pill">{g.unreadCount}</span> : null}
                    </div>
                  </div>
                  {body ? <div className="cnb-body">{body}</div> : null}
                </div>
              );
            })}

            {cursor ? (
              <button className="cnb-loadmore" onClick={loadMore} disabled={loading} type="button">
                {loading ? "Đang tải…" : "Xem thêm"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
