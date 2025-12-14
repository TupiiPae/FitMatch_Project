import dayjs from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./DuoConnect.css";

import api from "../../lib/api";
import { getMatchStatus } from "../../api/match";
import { getMe } from "../../api/account";
import { toast } from "react-toastify";

export default function DuoConnect({ onLeftRoom }) {
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

        const [statusData, meRaw] = await Promise.all([
          getMatchStatus(),
          getMe().catch(() => null),
        ]);

        const activeRoomId = statusData?.activeRoomId;
        const activeRoomType = statusData?.activeRoomType;

        if (!activeRoomId || activeRoomType !== "duo") {
          const msg = "Hiện bạn chưa tham gia phòng kết nối 1:1 nào.";
          toast.info(msg);

          if (typeof onLeftRoom === "function") {
            onLeftRoom();
          } else {
            nav("/ket-noi");
          }
          return;
        }

        const meData = meRaw || null;

        const roomRes = await api.get(`/match/rooms/${activeRoomId}`);
        const payload = roomRes?.data ?? roomRes;
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

          if (typeof onLeftRoom === "function") {
            onLeftRoom();
          } else {
            nav("/ket-noi");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [nav, onLeftRoom]);

  const myId = me?._id || me?.id || null;

  // ===== Chuẩn hoá member & tạo 2 slot =====
  const { slotMe, slotPartner } = useMemo(() => {
    const members = Array.isArray(room?.members) ? room.members : [];

    const calcAge = (dob) => { if(!dob) return null; const d=dayjs(dob); if(!d.isValid()) return null; const a=dayjs().diff(d,"year"); return a>=0&&a<=120?a:null; };
    const fmtGender = (g) => { const v=String(g||"").trim().toLowerCase(); if(!v) return null; if(["male","nam","m","men","man"].includes(v)) return "Nam"; if(["female","nu","nữ","f","women","woman"].includes(v)) return "Nữ"; if(["other","khac","khác"].includes(v)) return "Khác"; return String(g); };

    const normMember = (m) => {
      if (!m) return null;
      const u = m.user || {};
      const profile = u.profile || {};
      const name = profile.nickname || u.username || u.email || "Người dùng FitMatch";

      const genderRaw = profile.gender ?? profile.gioiTinh ?? profile.sex ?? null;
      const dobRaw = profile.birthDate ?? profile.dob ?? profile.ngaySinh ?? profile.birthday ?? null;

      return {
        id: String(u._id || u.id || ""),
        name,
        avatarUrl: profile.avatarUrl || null,
        role: m.role || "member",
        joinedAt: m.joinedAt || null,
        gender: fmtGender(genderRaw),
        age: calcAge(dobRaw),
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
      await api.post(`/match/rooms/${room._id}/leave`);
      toast.info("Bạn đã rời khỏi phòng ghép đôi.");
      setLeaveModalOpen(false);

      if (typeof onLeftRoom === "function") {
        onLeftRoom();
      } else {
        nav("/ket-noi");
      }
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
    return null;
  }

  return (
    <div className="cn-duo-page">
      {/* ===== HEADER ===== */}
      <header className="cn-duo-header">
        <div className="cn-duo-header-left">
          <div className="cn-duo-badge">Phòng ghép đôi 1:1</div>
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
            <div
              className="cn-duo-menu"
              onMouseLeave={handleCloseMenu}
            >
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

      {/* ===== PANEL: tab + main trong 1 box ===== */}
      <div className="cn-duo-panel">
        {/* ===== TAB BAR ===== */}
        <div className="cn-duo-tabs">
          <button
            type="button"
            className={
              "cn-duo-tab" +
              (activeTab === "connect" ? " is-active" : "")
            }
            onClick={() => setActiveTab("connect")}
          >
            Kết nối
          </button>
          <button
            type="button"
            className="cn-duo-tab is-disabled"
            disabled
          >
            Trò chuyện
            <span className="cn-duo-tab-badge">Sắp ra mắt</span>
          </button>
        </div>

        {/* ===== MAIN (tab Kết nối) ===== */}
        {activeTab === "connect" && (
          <section className="cn-duo-main">
            <div className="cn-duo-room-card">
              {/* 2 user – căn giữa và chia đều */}
              <div className="cn-duo-members-strip">
                <DuoMemberSpot member={slotMe} label="Bạn" isMe />
                <div className="cn-duo-vs">
                  <div className="cn-duo-vs-icon"><i className="fa-solid fa-bolt" /></div>
                  <div className="cn-duo-vs-text">VS</div>
                </div>
                <DuoMemberSpot member={slotPartner} label="Bạn ghép đôi" />
              </div>

              {/* 2 SLIDER – avatar nằm trên DAY 1 */}
              <div className="cn-duo-streak-rows">
                <DuoStreakRow member={slotMe} />
                <DuoStreakRow member={slotPartner} />
              </div>
            </div>
          </section>
        )}
      </div>

      {/* ===== MODAL RỜI PHÒNG ===== */}
      {leaveModalOpen && (
        <div
          className="cn-modal-backdrop"
          onClick={handleCloseLeaveModal}
        >
          <div
            className="cn-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="cn-modal-title">
              Rời khỏi phòng ghép đôi?
            </h3>
            <p className="cn-modal-text">
              Sau khi rời phòng, bạn sẽ không còn được hiển thị
              trong kết nối 1:1 này nữa. Nếu muốn ghép đôi lại, hai bạn
              cần gửi lời mời kết nối mới.
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

/* ===== MEMBER SPOT (hàng trên) ===== */

function DuoMemberSpot({ member, label, isMe = false }) {
  const roleCls = isMe ? " is-me" : " is-partner";

  if (!member) {
    return (
      <div className={"cn-duo-member-spot is-empty" + roleCls}>
        <div className="cn-duo-member-avatar-wrap">
          <div className="cn-duo-member-avatar cn-duo-member-avatar-empty">
            <i className="fa-regular fa-circle-user" />
          </div>
          <span className={"cn-duo-member-chip" + (isMe ? " is-me" : " is-partner")}>{label}</span>
        </div>
        <div className="cn-duo-member-name">Chỗ trống</div>
        <div className="cn-duo-member-meta">--</div>
      </div>
    );
  }

  const initials = getInitials(member.name);
  const gender = member.gender || "--";
  const ageText = member.age != null ? `${member.age} tuổi` : "--";
  const meta = member.gender && member.age != null ? `${gender} ~ ${ageText}` : `${gender}${member.age != null ? ` ~ ${ageText}` : ""}`.trim() || "--";

  return (
    <div className={"cn-duo-member-spot" + roleCls}>
      <div className="cn-duo-member-avatar-wrap">
        <div className={"cn-duo-member-avatar" + roleCls}>
          {member.avatarUrl ? <img src={member.avatarUrl} alt={member.name} /> : <span>{initials}</span>}
        </div>
        <span className={"cn-duo-member-chip" + (isMe ? " is-me" : " is-partner")}>{label}</span>
      </div>

      <div className="cn-duo-member-name">{member.name}</div>
      <div className="cn-duo-member-meta">{meta}</div>
    </div>
  );
}

/* ===== SLIDER ROW (hàng dưới) ===== */

function DuoStreakRow({ member }) {
  const hasMember = !!member;
  const initials = member ? getInitials(member.name) : "FM";

  return (
    <div className="cn-duo-streak-row">
      <div
        className={
          "cn-duo-streak-line" + (!hasMember ? " is-empty" : "")
        }
      >
        {/* avatar nằm trên thanh ở điểm DAY 1 */}
        <div
          className={
            "cn-duo-streak-avatar-onbar" +
            (!hasMember ? " is-empty" : "")
          }
        >
          {hasMember && member.avatarUrl ? (
            <img src={member.avatarUrl} alt={member.name} />
          ) : hasMember ? (
            <span>{initials}</span>
          ) : (
            <i className="fa-regular fa-circle-user" />
          )}
        </div>

        {/* thanh ngang */}
        <div className="cn-duo-streak-bar" />

        {/* chỉ còn DAY 1 */}
        <div className="cn-duo-streak-day1">
          <span className="cn-duo-streak-day1-arrow" />
          <span className="cn-duo-streak-day1-label">DAY 1</span>
        </div>
      </div>
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
