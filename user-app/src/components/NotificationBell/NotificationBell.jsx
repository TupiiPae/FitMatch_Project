import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { toast } from "react-toastify";
import { getSocket } from "../../lib/socket";
import {
  listNotifications,
  markNotificationRead,
} from "../../api/notification";
import "./NotificationBell.css";

const safeArr = (v) => (Array.isArray(v) ? v : []);
const unwrapItems = (payload) => payload?.items ?? payload?.data?.items ?? [];
const getNextCursor = (payload) => payload?.nextCursor ?? payload?.data?.nextCursor ?? null;

const isChatNoti = (n) => {
  const type = String(n?.type || "");
  const d = n?.data || {};
  return type === "chat_message" || d?.screen === "Messages";
};

const isFirstContactChat = (n) => {
  const d = n?.data || {};
  return isChatNoti(n) && d?.firstContact === true;
};

const shouldShowInBell = (n) => {
  // Bell = thông báo tổng (trừ chat), + chat chỉ khi firstContact
  if (!n) return false;
  if (isChatNoti(n)) return isFirstContactChat(n);
  return true;
};

const getConversationId = (n) => {
  const d = n?.data || {};
  return String(d?.conversationId || d?.cid || "");
};

export default function NotificationBell() {
  const nav = useNavigate();
  const socket = useMemo(() => getSocket(), []);
  const boxRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [rawItems, setRawItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(null);

  const items = useMemo(() => safeArr(rawItems).filter(shouldShowInBell), [rawItems]);

  const unread = useMemo(
    () => items.reduce((sum, x) => sum + (x?.readAt ? 0 : 1), 0),
    [items]
  );

  const loadFirst = async () => {
    try {
      setLoading(true);
      const l = await listNotifications({ limit: 30 });
      const fetched = unwrapItems(l);
      setRawItems(fetched);
      setCursor(getNextCursor(l));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (!cursor) return;
    try {
      setLoading(true);
      const l = await listNotifications({ limit: 30, cursor });
      const fetched = unwrapItems(l);
      setRawItems((prev) => [...safeArr(prev), ...fetched]);
      setCursor(getNextCursor(l));
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

  // realtime
  useEffect(() => {
    const onNew = (n) => {
      if (!shouldShowInBell(n)) return;

      setRawItems((prev) => {
        const id = String(n?._id || "");
        if (id && safeArr(prev).some((x) => String(x?._id) === id)) return prev;
        return [n, ...safeArr(prev)];
      });

      // toast:
      // - không toast chat thường (đã tách sang ChatBell)
      // - toast non-chat và toast chat firstContact
      const title = n?.title || "Bạn có thông báo mới";
      if (!isChatNoti(n) || isFirstContactChat(n)) toast.info(title);
    };

    const onReadUpdate = ({ id, readAt }) => {
      setRawItems((prev) =>
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

  const goByNoti = (n) => {
    const type = String(n?.type || "");
    const d = n?.data || {};

    // 1) Chat first-contact -> mở đúng conversation
    if (isFirstContactChat(n)) {
      const cid = getConversationId(n);
      if (cid) {
        nav(`/tin-nhan?conversationId=${encodeURIComponent(cid)}`, {
          state: { conversationId: cid },
        });
        return;
      }
      nav("/tin-nhan");
      return;
    }

    // 2) Connect / Match / Group
    if (d?.screen === "Connect" || type.startsWith("match_") || type.startsWith("group_")) {
      const mode = String(d?.mode || "");
      if (mode === "group" || type.includes("_group") || type.startsWith("group_")) {
        nav("/ket-noi/nhom");
        return;
      }
      nav("/ket-noi/duo");
      return;
    }

    // 3) fallback path
    if (d?.path) nav(d.path);
    else nav("/home");
  };

  const onClickItem = async (n) => {
    try {
      if (!n?.readAt && n?._id) await markNotificationRead(n._id);
    } catch {}
    setOpen(false);
    goByNoti(n);
  };

  const onMarkAllVisible = async () => {
    // ✅ Chỉ mark-read các noti đang hiển thị trong bell
    const unreadList = items.filter((x) => !x?.readAt && x?._id);
    if (!unreadList.length) return;

    try {
      await Promise.all(unreadList.map((x) => markNotificationRead(x._id).catch(() => null)));
      setRawItems((prev) =>
        safeArr(prev).map((x) =>
          unreadList.some((u) => String(u._id) === String(x?._id))
            ? { ...x, readAt: x.readAt || new Date().toISOString() }
            : x
        )
      );
    } catch {
      toast.error("Không thể đánh dấu đã đọc");
    }
  };

  return (
    <div className="fm-noti" ref={boxRef}>
      <button
        type="button"
        className="fm-noti-btn"
        onClick={() => setOpen((v) => !v)}
        title="Thông báo"
        aria-haspopup="menu"
        aria-expanded={open ? "true" : "false"}
      >
        <i className="fa-regular fa-bell" />
        {unread > 0 ? (
          <span className="fm-noti-badge">{unread > 99 ? "99+" : unread}</span>
        ) : null}
      </button>

      <div className={`noti-pop ${open ? "is-open" : ""}`} role="menu" onClick={(e) => e.stopPropagation()}>
        <div className="noti-head">
          <div className="noti-title">Thông báo</div>
          <div className="noti-actions">
            <button type="button" className="noti-btn" onClick={onMarkAllVisible}>
              Đã đọc tất cả
            </button>
          </div>
        </div>

        <div className="noti-list">
          {loading && !items.length ? <div className="noti-empty">Đang tải…</div> : null}
          {!loading && !items.length ? <div className="noti-empty">Chưa có thông báo.</div> : null}

          {items.map((n) => (
            <div
              key={n._id}
              className={`noti-item ${n.readAt ? "read" : "unread"}`}
              role="menuitem"
              tabIndex={0}
              onClick={() => onClickItem(n)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClickItem(n);
                }
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div className="noti-item-title">{n.title || "Thông báo"}</div>

                <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                  <div className="noti-item-time">
                    {n.createdAt ? dayjs(n.createdAt).format("HH:mm DD/MM") : ""}
                  </div>

                  {!n.readAt ? (
                    <button
                      type="button"
                      title="Đánh dấu đã đọc"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try { await markNotificationRead(n._id); } catch {}
                      }}
                      style={{
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        fontWeight: 900,
                        opacity: 0.8,
                        color: "inherit",
                      }}
                    >
                      ✓
                    </button>
                  ) : null}
                </div>
              </div>

              {n.body ? <div className="noti-item-body">{n.body}</div> : null}
            </div>
          ))}

          {cursor ? (
            <button type="button" className="noti-btn" style={{ width: "100%", margin: 10 }} onClick={loadMore} disabled={loading}>
              {loading ? "Đang tải…" : "Xem thêm"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
