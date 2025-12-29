import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { toast } from "react-toastify";
import { getSocket } from "../../lib/socket";
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../api/notification";
import "./NotificationBell.css";

const safeArr = (v) => (Array.isArray(v) ? v : []);
const unwrapItems = (payload) => payload?.items ?? payload?.data?.items ?? [];

export default function NotificationBell() {
  const nav = useNavigate();
  const socket = useMemo(() => getSocket(), []);

  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(null);
  const boxRef = useRef(null);

  const loadFirst = async () => {
    try {
      setLoading(true);
      const [c, l] = await Promise.all([
        getUnreadCount(),
        listNotifications({ limit: 20 }),
      ]);
      setUnread(c?.unread ?? 0);
      setItems(unwrapItems(l));
      setCursor(l?.nextCursor ?? null);
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
      const l = await listNotifications({ limit: 20, cursor });
      setItems((prev) => [...safeArr(prev), ...unwrapItems(l)]);
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

  // realtime
  useEffect(() => {
    const onNew = (n) => {
      setItems((prev) => [n, ...safeArr(prev)]);
      if (!n?.readAt) setUnread((x) => x + 1);
      toast.info(n?.title || "Bạn có thông báo mới");
    };
    const onCount = (p) => {
      if (typeof p?.unread === "number") setUnread(p.unread);
    };
    const onReadUpdate = ({ id, readAt }) => {
      setItems((prev) =>
        safeArr(prev).map((x) =>
          String(x?._id) === String(id) ? { ...x, readAt } : x
        )
      );
    };

    socket.on("noti:new", onNew);
    socket.on("noti:count", onCount);
    socket.on("noti:read_update", onReadUpdate);

    return () => {
      socket.off("noti:new", onNew);
      socket.off("noti:count", onCount);
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

  // ✅ Đồng bộ route với ConnectSidebar: /ket-noi/duo | /ket-noi/nhom
  const goByNoti = (n) => {
    const type = String(n?.type || "");
    const d = n?.data || {};

    // 1) Chat → mở đúng conversation
    if (type === "chat_message" || d?.screen === "Messages") {
      const cid = d?.conversationId;
      if (cid) {
        nav(`/tin-nhan?conversationId=${encodeURIComponent(String(cid))}`, {
          state: { conversationId: String(cid) },
        });
        return;
      }
      nav("/tin-nhan");
      return;
    }

    // 2) Connect → duo/team route
    if (d?.screen === "Connect" || type.startsWith("match_") || type.startsWith("group_")) {
      const isGroup =
        String(d?.mode || "").toLowerCase() === "group" ||
        type.includes("_group") ||
        type.startsWith("group_");

      nav(isGroup ? "/ket-noi/nhom" : "/ket-noi/duo");
      return;
    }

    // fallback
    if (d?.path) nav(d.path);
    else nav("/home");
  };

  const optimisticMarkRead = (id) => {
    if (!id) return;
    setItems((prev) =>
      safeArr(prev).map((x) =>
        String(x?._id) === String(id) ? { ...x, readAt: x.readAt || new Date().toISOString() } : x
      )
    );
    setUnread((c) => Math.max(0, Number(c || 0) - 1));
  };

  const onClickItem = async (n) => {
    const id = n?._id;
    try {
      if (id && !n?.readAt) {
        optimisticMarkRead(id);
        await markNotificationRead(id);
      }
    } catch {}
    setOpen(false);
    goByNoti(n);
  };

  const onMarkAll = async () => {
    try {
      await markAllNotificationsRead();
      setItems((prev) =>
        safeArr(prev).map((x) => ({ ...x, readAt: x.readAt || new Date().toISOString() }))
      );
      setUnread(0);
    } catch (e) {
      toast.error("Không thể đánh dấu đã đọc");
    }
  };

  const onMarkOne = async (e, n) => {
    e.stopPropagation();
    const id = n?._id;
    if (!id || n?.readAt) return;
    try {
      optimisticMarkRead(id);
      await markNotificationRead(id);
    } catch {}
  };

  const onItemKeyDown = (e, n) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClickItem(n);
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

      {open ? (
        <div className="noti-pop is-open" role="menu" onClick={(e) => e.stopPropagation()}>
          <div className="noti-head">
            <div className="noti-title">Thông báo</div>
            <div className="noti-actions">
              <button type="button" className="noti-btn" onClick={onMarkAll}>
                Đã đọc tất cả
              </button>
            </div>
          </div>

          <div className="noti-list">
            {loading && !items.length ? <div className="noti-empty">Đang tải…</div> : null}
            {!loading && !items.length ? <div className="noti-empty">Chưa có thông báo.</div> : null}

            {items.map((n) => (
              // ✅ div role=button để không lồng button trong button
              <div
                key={n._id}
                className={`noti-item ${n.readAt ? "read" : "unread"}`}
                role="menuitem"
                tabIndex={0}
                onClick={() => onClickItem(n)}
                onKeyDown={(e) => onItemKeyDown(e, n)}
              >
                <div className="noti-item-top">
                  <div className="noti-item-title">{n.title || "Thông báo"}</div>

                  <div className="noti-item-right">
                    <div className="noti-item-time">
                      {n.createdAt ? dayjs(n.createdAt).format("HH:mm DD/MM") : ""}
                    </div>

                    {!n.readAt ? (
                      <button
                        type="button"
                        className="noti-mini-btn"
                        title="Đánh dấu đã đọc"
                        onClick={(e) => onMarkOne(e, n)}
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
              <button className="noti-loadmore" onClick={loadMore} disabled={loading}>
                {loading ? "Đang tải…" : "Xem thêm"}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
