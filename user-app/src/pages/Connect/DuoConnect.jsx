// user-app/src/pages/Connect/DuoConnect.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./DuoConnect.css";

import api from "../../lib/api";
import { getMatchStatus } from "../../api/match";
import { getMe } from "../../api/account";
import { toast } from "react-toastify";

export default function DuoConnect() {
  const nav = useNavigate();

  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState(null);
  const [me, setMe] = useState(null);

  const [menuOpen, setMenuOpen] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const [activeTab, setActiveTab] = useState("connect"); // 'connect' | 'chat'

  // ===== Load room + user =====
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);

        // getMatchStatus() đã unwrap → trả về object { discoverable, activeRoomId, ... }
        const [statusData, meRaw] = await Promise.all([
          getMatchStatus(),
          getMe().catch(() => null),
        ]);

        const activeRoomId = statusData?.activeRoomId;
        const activeRoomType = statusData?.activeRoomType;

        if (!activeRoomId || activeRoomType !== "duo") {
          toast.info("Hiện bạn chưa tham gia phòng kết nối 1:1 nào.");
          nav("/ket-noi");
          return;
        }

        const meData = meRaw || null;

        // ✳️ baseURL của axios đã là /api → KHÔNG thêm /api nữa
        const roomRes = await api.get(`/match/rooms/${activeRoomId}`);
        const payload = roomRes?.data ?? roomRes;
        // responseOk(res, room) → { ok: true, data: room }
        const roomData = payload?.data ?? payload ?? null;

        if (cancelled) return;

        setRoom(roomData);
        setMe(meData);
      } catch (e) {
        console.error("Load duo room error:", e);
        if (!cancelled) {
          const msg =
            e?.response?.data?.message ||
            e?.response?.data?.error ||
            "Không thể tải thông tin phòng ghép đôi.";
          toast.error(msg);
          nav("/ket-noi");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [nav]);

  const myId = me?._id || me?.id || null;

  // ===== Chuẩn hoá member & tạo 2 slot =====
  const { slotMe, slotPartner } = useMemo(() => {
    const members = Array.isArray(room?.members) ? room.members : [];

    const normMember = (m) => {
      if (!m) return null;
      const u = m.user || {};
      const profile = u.profile || {};
      const name =
        profile.nickname ||
        u.username ||
        u.email ||
        "Người dùng FitMatch";

      return {
        id: String(u._id || u.id || ""),
        name,
        avatarUrl: profile.avatarUrl || null,
        role: m.role || "member",
        joinedAt: m.joinedAt || null,
      };
    };

    if (!members.length) {
      return { slotMe: null, slotPartner: null };
    }

    if (members.length === 1) {
      const only = normMember(members[0]);
      if (myId && only.id === String(myId)) {
        return { slotMe: only, slotPartner: null };
      }
      return { slotMe: only, slotPartner: null };
    }

    // 2 thành viên
    const m1 = normMember(members[0]);
    const m2 = normMember(members[1]);

    if (!myId) {
      return { slotMe: m1, slotPartner: m2 };
    }

    if (m1.id === String(myId)) {
      return { slotMe: m1, slotPartner: m2 };
    }
    if (m2.id === String(myId)) {
      return { slotMe: m2, slotPartner: m1 };
    }
    return { slotMe: m1, slotPartner: m2 };
  }, [room, myId]);

  const roomStatusLabel =
    room?.status === "closed"
      ? "Đã đóng"
      : room?.status === "full"
      ? "Đã đủ thành viên"
      : "Đang hoạt động";

  const createdAtText = room?.createdAt
    ? new Date(room.createdAt).toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";

  const handleOpenMenu = () => setMenuOpen((v) => !v);
  const handleCloseMenu = () => setMenuOpen(false);

  const handleOpenLeaveModal = () => {
    setLeaveModalOpen(true);
    setMenuOpen(false);
  };
  const handleCloseLeaveModal = () => {
    if (leaving) return;
    setLeaveModalOpen(false);
  };

  // ===== Rời khỏi phòng =====
  const handleConfirmLeave = async () => {
    if (!room?._id) return;
    try {
      setLeaving(true);
      // KHÔNG thêm /api nữa
      await api.post(`/match/rooms/${room._id}/leave`);
      toast.info("Bạn đã rời khỏi phòng ghép đôi.");
      setLeaveModalOpen(false);
      nav("/ket-noi");
    } catch (e) {
      console.error("leaveMatchRoom error:", e);
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        "Không thể rời phòng. Vui lòng thử lại.";
      toast.error(msg);
    } finally {
      setLeaving(false);
    }
  };

  if (loading && !room) {
    return (
      <div className="cn-duo-page">
        <p className="cn-duo-loading">Đang tải phòng ghép đôi...</p>
      </div>
    );
  }

  if (!room) {
    // Đã xử lý điều hướng ở trên; fallback tránh crash
    return null;
  }

  return (
    <div className="cn-duo-page">
      {/* ===== HEADER ===== */}
      <header className="cn-duo-header">
        <div className="cn-duo-header-left">
          <div className="cn-duo-badge">Phòng ghép đôi 1:1</div>
          <h1 className="cn-duo-title">Hành trình tập luyện của hai bạn</h1>
          <p className="cn-duo-sub">
            Sau khi ghép đôi, hai bạn có thể thống nhất lịch tập, mục tiêu và
            cùng nhau duy trì động lực mỗi ngày.
          </p>
        </div>

        <div className="cn-duo-header-right">
          <button
            type="button"
            className="cn-duo-more-btn"
            onClick={handleOpenMenu}
          >
            <i className="fa-solid fa-ellipsis-vertical" />
          </button>

          {menuOpen && (
            <div className="cn-duo-menu" onMouseLeave={handleCloseMenu}>
              <button
                type="button"
                className="cn-duo-menu-item cn-duo-menu-danger"
                onClick={handleOpenLeaveModal}
              >
                Rời khỏi phòng
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ===== TAB BAR ===== */}
      <div className="cn-duo-tabs">
        <button
          type="button"
          className={
            "cn-duo-tab" + (activeTab === "connect" ? " is-active" : "")
          }
          onClick={() => setActiveTab("connect")}
        >
          Kết nối
        </button>
        <button type="button" className="cn-duo-tab is-disabled" disabled>
          Trò chuyện
          <span className="cn-duo-tab-badge">Sắp ra mắt</span>
        </button>
      </div>

      {/* ===== MAIN CARD (tab Kết nối) ===== */}
      {activeTab === "connect" && (
        <section className="cn-duo-main">
          <div className="cn-duo-room-card">
            <div className="cn-duo-room-top">
              <div className="cn-duo-room-info">
                <h2 className="cn-duo-room-name">
                  {room.name || "Phòng kết nối 1:1"}
                </h2>
                <p className="cn-duo-room-desc">
                  {room.description ||
                    "Kết nối này được tạo khi hai bạn đồng ý lời mời ghép đôi. Cùng nhau giữ thói quen tập luyện đều đặn nhé!"}
                </p>

                <div className="cn-duo-chips">
                  <span className="cn-duo-chip">
                    <i className="fa-regular fa-circle-dot" />
                    <span>{roomStatusLabel}</span>
                  </span>
                  {room.locationLabel && (
                    <span className="cn-duo-chip">
                      <i className="fa-solid fa-location-dot" />
                      <span>{room.locationLabel}</span>
                    </span>
                  )}
                  {Array.isArray(room.trainingTypes) &&
                    room.trainingTypes.map((t) => (
                      <span key={t} className="cn-duo-chip cn-duo-chip-ghost">
                        {t}
                      </span>
                    ))}
                </div>
              </div>

              <div className="cn-duo-room-meta">
                <div className="cn-duo-meta-item">
                  <div className="cn-duo-meta-label">Ngày tạo phòng</div>
                  <div className="cn-duo-meta-value">{createdAtText}</div>
                </div>
                <div className="cn-duo-meta-item">
                  <div className="cn-duo-meta-label">
                    Số thành viên hiện tại
                  </div>
                  <div className="cn-duo-meta-value">
                    {Array.isArray(room.members) ? room.members.length : 0} /{" "}
                    {room.maxMembers || 2}
                  </div>
                </div>
              </div>
            </div>

            {/* ===== 2 SLOT THÀNH VIÊN ===== */}
            <div className="cn-duo-slots">
              <DuoSlot member={slotMe} label="Bạn" isMe />
              <DuoSlot member={slotPartner} label="Bạn ghép đôi" />
            </div>

            <div className="cn-duo-footer-hint">
              Gợi ý: Hãy thống nhất lịch tập, mục tiêu theo tuần và cập nhật
              tiến độ trong các trang Thống kê, Nhật ký ăn uống… để cùng nhau
              theo dõi kết quả.
            </div>
          </div>
        </section>
      )}

      {/* ===== MODAL RỜI PHÒNG ===== */}
      {leaveModalOpen && (
        <div className="cn-modal-backdrop" onClick={handleCloseLeaveModal}>
          <div className="cn-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="cn-modal-title">Rời khỏi phòng ghép đôi?</h3>
            <p className="cn-modal-text">
              Sau khi rời phòng, bạn sẽ không còn được hiển thị trong kết nối
              1:1 này nữa. Nếu muốn ghép đôi lại, hai bạn cần gửi lời mời kết
              nối mới.
            </p>
            <div className="cn-modal-actions">
              <button
                type="button"
                className="cn-btn-ghost"
                onClick={handleCloseLeaveModal}
                disabled={leaving}
              >
                Ở lại phòng
              </button>
              <button
                type="button"
                className="cn-btn-reject"
                onClick={handleConfirmLeave}
                disabled={leaving}
              >
                {leaving ? "Đang xử lý..." : "Rời khỏi phòng"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ===== SLOT COMPONENT ===== */

function DuoSlot({ member, label, isMe = false }) {
  if (!member) {
    return (
      <div className="cn-duo-slot cn-duo-slot-empty">
        <div className="cn-duo-slot-label">{label}</div>
        <div className="cn-duo-avatar cn-duo-avatar-empty">
          <i className="fa-regular fa-circle-user" />
        </div>
        <div className="cn-duo-slot-name">Chỗ trống</div>
        <p className="cn-duo-slot-empty-text">
          Khi có người ghép đôi với bạn, thông tin sẽ hiển thị tại đây.
        </p>
      </div>
    );
  }

  const initials = getInitials(member.name);

  return (
    <div className={"cn-duo-slot" + (isMe ? " cn-duo-slot-me" : "")}>
      <div className="cn-duo-slot-label">{label}</div>
      <div className="cn-duo-avatar">
        {member.avatarUrl ? (
          <img src={member.avatarUrl} alt={member.name} />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      <div className="cn-duo-slot-name">{member.name}</div>
      {member.role === "owner" && (
        <div className="cn-duo-slot-role-tag">Quản lý phòng</div>
      )}

      <div className="cn-duo-slot-status">
        <span className="cn-duo-status-dot" />
        Đang tham gia
      </div>

      {member.joinedAt && (
        <div className="cn-duo-slot-joined">
          Tham gia{" "}
          {new Date(member.joinedAt).toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        </div>
      )}
    </div>
  );
}

function getInitials(name) {
  if (!name) return "FM";
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
