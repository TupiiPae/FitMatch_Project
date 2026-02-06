import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import { toast } from "react-toastify";
import api from "../../lib/api";
import { getSocket } from "../../lib/socket";
import { listNotifications, markNotificationRead } from "../../api/notification";
import "./ConnectSuggestBell.css";

const safeArr = (v) => (Array.isArray(v) ? v : []);
const unwrapItems = (payload) => payload?.items ?? payload?.data?.items ?? [];
const getNextCursor = (payload) => payload?.nextCursor ?? payload?.data?.nextCursor ?? null;

const isSuggestNoti = (n) => String(n?.type || "") === "connect_suggest";
const getId = (n) => String(n?._id || n?.id || "");
const isReadNoti = (n) => !!(n?.readAt || n?.isRead);

const apiBase = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) || api.defaults?.baseURL || "";
const toAbs = (u) => {
  if (!u) return u;
  try {
    return new URL(u, apiBase).toString();
  } catch {
    return u;
  }
};
const withBust = (u, t) => (u ? `${u}${u.includes("?") ? "&" : "?"}t=${t}` : u);

export default function ConnectSuggestBell() {
  const nav = useNavigate();
  const socket = useMemo(() => getSocket(), []);
  const bustToken = useMemo(() => Date.now(), []);
  const boxRef = useRef(null);

  const [open, setOpen] = useState(false);
  const [rawItems, setRawItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(null);

  const items = useMemo(() => safeArr(rawItems).filter(isSuggestNoti), [rawItems]);
  const unread = useMemo(
    () => items.reduce((sum, x) => sum + (isReadNoti(x) ? 0 : 1), 0),
    [items]
  );

  const loadFirst = async () => {
    try {
      setLoading(true);
      const l = await listNotifications({ limit: 10 });
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
      const l = await listNotifications({ limit: 10, cursor });
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

  useEffect(() => {
    if (open) loadFirst();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const onNew = (n) => {
      if (!isSuggestNoti(n)) return;

      setRawItems((prev) => {
        const id = getId(n);
        if (id && safeArr(prev).some((x) => getId(x) === id)) return prev;
        return [n, ...safeArr(prev)];
      });

      const name = n?.data?.suggestName || "";
      toast.info(name ? `Gợi ý kết nối mới cho bạn` : "Bạn có gợi ý kết nối mới");
    };

    const onReadUpdate = ({ id, readAt, isRead }) => {
      setRawItems((prev) =>
        safeArr(prev).map((x) =>
          getId(x) === String(id)
            ? { ...x, readAt: readAt ?? x.readAt, isRead: isRead ?? x.isRead }
            : x
        )
      );
    };

    socket.on("notification:new", onNew);
    socket.on("notification:read_update", onReadUpdate);
    socket.on("noti:new", onNew);
    socket.on("noti:read_update", onReadUpdate);

    return () => {
      socket.off("notification:new", onNew);
      socket.off("notification:read_update", onReadUpdate);
      socket.off("noti:new", onNew);
      socket.off("noti:read_update", onReadUpdate);
    };
  }, [socket]);

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
    const d = n?.data || {};
    const qs = new URLSearchParams();
    qs.set("screen", "Connect");
    qs.set("tab", d?.tab || "nearby");
    qs.set("mode", d?.mode || "duo");
    if (d?.suggestUserId) qs.set("suggestUserId", String(d.suggestUserId));
    const search = qs.toString();

    nav(`/ket-noi${search ? `?${search}` : ""}`);
  };

  const onClickItem = async (n) => {
    const id = getId(n);
    try {
      if (!isReadNoti(n) && id) {
        await markNotificationRead(id);
        setRawItems((prev) =>
          safeArr(prev).map((x) =>
            getId(x) === id ? { ...x, readAt: x.readAt || new Date().toISOString(), isRead: true } : x
          )
        );
      }
    } catch {}
    setOpen(false);
    goByNoti(n);
  };

  const onMarkAllVisible = async () => {
    const unreadList = items.filter((x) => !isReadNoti(x) && getId(x));
    if (!unreadList.length) return;

    try {
      await Promise.all(unreadList.map((x) => markNotificationRead(getId(x)).catch(() => null)));
      setRawItems((prev) =>
        safeArr(prev).map((x) =>
          unreadList.some((u) => getId(u) === getId(x))
            ? { ...x, readAt: x.readAt || new Date().toISOString(), isRead: true }
            : x
        )
      );
    } catch {
      toast.error("Không thể đánh dấu đã đọc");
    }
  };

  return (
    <div className="csb-wrap" ref={boxRef}>
      <button
        type="button"
        className="csb-btn"
        onClick={() => setOpen((v) => !v)}
        title="Gợi ý kết nối"
        aria-haspopup="menu"
        aria-expanded={open ? "true" : "false"}
      >
        <i className="fa-solid fa-user-plus" />
        {unread > 0 ? (
          <span className="csb-badge">{unread > 99 ? "99+" : unread}</span>
        ) : null}
      </button>

      <div
        className={`csb-pop ${open ? "is-open" : ""}`}
        role="menu"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="csb-head">
          <div className="csb-title">Gợi ý kết nối</div>

          <div className="csb-actions">
            <button
              type="button"
              className="csb-actionLink"
              onClick={onMarkAllVisible}
              title="Đánh dấu tất cả là đã đọc"
            >
              <i className="fa-solid fa-check-double" />
              <span>Đã đọc tất cả</span>
            </button>
          </div>
        </div>

        <div className="csb-list">
          {loading && !items.length ? <div className="csb-empty">Đang tải…</div> : null}
          {!loading && !items.length ? <div className="csb-empty">Chưa có gợi ý kết nối.</div> : null}

          {items.map((n) => {
            const id = getId(n);
            const read = isReadNoti(n);
            const name = n?.data?.suggestName || n?.title || "Gợi ý kết nối";
            const avatarRaw = n?.data?.suggestAvatar || "";
            const avatar = avatarRaw ? withBust(toAbs(avatarRaw), bustToken) : "/images/avatar.png";
            const time = n?.createdAt ? dayjs(n.createdAt).format("HH:mm DD/MM") : "";

            return (
              <div
                key={id || Math.random()}
                className={`csb-item ${read ? "read" : "unread"}`}
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
                <div className="csb-avatar">
                  <img
                    src={avatar}
                    alt={name}
                    onError={(e) => {
                      e.currentTarget.src = "/images/avatar.png";
                    }}
                  />
                </div>

                <div className="csb-content">
                  <div className="csb-item-title">
                    {n?.data?.suggestName ? `Gợi ý kết nối mới` : name}
                  </div>
                  {n?.body ? <div className="csb-item-body">{n.body}</div> : null}
                </div>

                <div className="csb-right">
                  <div className="csb-time">{time}</div>

                  {!read ? (
                    <button
                      type="button"
                      title="Đánh dấu đã đọc"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await markNotificationRead(id);
                          setRawItems((prev) =>
                            safeArr(prev).map((x) =>
                              getId(x) === id
                                ? { ...x, readAt: x.readAt || new Date().toISOString(), isRead: true }
                                : x
                            )
                          );
                        } catch {}
                      }}
                      className="csb-mini-btn"
                    >
                      ✓
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })}

          {cursor ? (
            <button
              type="button"
              className="csb-loadmore"
              onClick={loadMore}
              disabled={loading}
            >
              {loading ? "Đang tải…" : "Xem thêm gợi ý"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
