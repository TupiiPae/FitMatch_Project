// user-app/src/pages/Connect/TabMyConnections.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Lưu ý logic:
 * - Mỗi user chỉ tham gia 1 "phòng kết nối" tại 1 thời điểm.
 * - Tab "Kết nối của tôi" MẶC ĐỊNH disable, chỉ mở khi có ít nhất 1 request
 *   (gửi lời mời / nhận lời mời). Phần enable/disable nằm ở ConnectSideBar.
 *
 * Ở đây mock 3 loại request chờ duyệt:
 *  - incoming_user  : Có người dùng gửi lời mời kết nối
 *  - outgoing_user  : Bạn đã gửi lời mời kết nối 1:1
 *  - outgoing_group : Bạn đã gửi lời mời tham gia nhóm
 */
const INITIAL_REQUESTS = [
  {
    id: "r1",
    type: "outgoing_user",
    nickname: "Nhật Thiên",
    goal: "Giảm cân & săn chắc",
    note: "Bạn đã gửi lời mời kết nối 1:1, đang chờ phản hồi.",
    createdAtText: "2 giờ trước",
    imageUrl:
      "https://i.pinimg.com/736x/f4/8e/3b/f48e3b4a5aacfd596ff74e203bdbecb7.jpg",
  },
  {
    id: "r2",
    type: "outgoing_group",
    groupName: "Morning Strength Club",
    membersCount: 3,
    schedule: "Full body · 3 buổi/tuần · Sáng",
    note: "Bạn đã gửi lời mời tham gia nhóm, đang chờ quản lý nhóm duyệt.",
    createdAtText: "Hôm qua",
    imageUrl: "https://i.pinimg.com/736x/62/fa/35/62fa3542956d6d598796cee854c651c0.jpg",
  },
  {
    id: "r3",
    type: "incoming_user",
    nickname: "Nhật Hào",
    distanceKm: 2.1,
    goal: "Tăng cơ & bền bỉ",
    note: "Người dùng này muốn kết nối 1:1 với bạn.",
    createdAtText: "Vừa xong",
    imageUrl:
      "https://i.pinimg.com/1200x/b0/07/34/b007344944aafec0d05a314614c80f07.jpg",
  },
];

export default function TabMyConnections({ currentUser }) {
  const [requests, setRequests] = useState(INITIAL_REQUESTS);
  const nav = useNavigate();

  const incomingRequests = requests.filter((r) => r.type === "incoming_user");
  const outgoingUserRequests = requests.filter(
    (r) => r.type === "outgoing_user"
  );
  const outgoingGroupRequests = requests.filter(
    (r) => r.type === "outgoing_group"
  );

  const hasRequests =
    incomingRequests.length +
      outgoingUserRequests.length +
      outgoingGroupRequests.length >
    0;

  const removeRequest = (id) =>
    setRequests((prev) => prev.filter((r) => r.id !== id));

  const handleCancelInvite = (id) => {
    // TODO: call API hủy lời mời nếu cần
    removeRequest(id);
  };

  const handleRejectInvite = (id) => {
    // TODO: call API từ chối nếu cần
    removeRequest(id);
  };

  const handleAcceptDuo = (id) => {
    // TODO:
    //  - đưa 2 user vào cùng 1 "phòng kết nối 1:1"
    //  - đóng / clear các request khác liên quan nếu cần
    removeRequest(id);
    nav("/ket-noi/duo"); // Giao diện kết nối 1:1 (DuoConnect)
  };

  const handleOpenTeamConnectDemo = () => {
    // Chỉ dùng để xem UI Kết nối nhóm (demo)
    nav("/ket-noi/nhom");
  };

  if (!hasRequests) {
    return (
      <section className="cn-myconnections">
        <h2>Kết nối của tôi</h2>
        <p className="cn-myconnections-sub">
          Nơi quản lý các lời mời kết nối 1:1 và nhóm. Sau khi chấp nhận, bạn sẽ
          được chuyển sang phòng kết nối tương ứng.
        </p>
        <p className="cn-myconnections-placeholder">
          Hiện bạn chưa có bất kỳ lời mời kết nối nào. Hãy dùng tab{" "}
          <strong>Tìm kiếm xung quanh</strong> để gửi lời mời hoặc tham gia
          nhóm mới.
        </p>

        <button
          type="button"
          className="cn-btn-ghost"
          style={{ marginTop: 10 }}
          onClick={handleOpenTeamConnectDemo}
        >
          Xem giao diện Kết nối nhóm (demo)
        </button>
      </section>
    );
  }

  return (
    <section className="cn-myconnections">
      <h2>Kết nối của tôi</h2>
      <p className="cn-myconnections-sub">
        Quản lý các lời mời kết nối đang chờ xử lý. Khi{" "}
        <strong>Duyệt</strong>, bạn sẽ được chuyển sang phòng kết nối 1:1 hoặc
        phòng nhóm tương ứng.
      </p>

      {/* ===== Box 1: Có người dùng gửi lời mời kết nối ===== */}
      {incomingRequests.length > 0 && (
        <div className="cn-myconnections-card">
          <div className="cn-requests-section">
            <h3 className="cn-requests-title">
              Có người dùng gửi lời mời kết nối
            </h3>
            <p className="cn-requests-desc">
              Khi bạn nhấp <strong>Duyệt</strong>, hệ thống sẽ tạo phòng kết nối
              1:1 giữa bạn và người dùng đó.
            </p>

            <div className="cn-requests-list">
              {incomingRequests.map((r) => {
                const distanceText =
                  typeof r.distanceKm === "number"
                    ? `Cách bạn ~${r.distanceKm.toFixed(1)} km`
                    : "";

                return (
                  <article key={r.id} className="cn-request-row">
                    {r.imageUrl && (
                      <div className="cn-request-thumb">
                        <img
                          src={r.imageUrl}
                          alt={r.nickname || "Người dùng FitMatch"}
                        />
                      </div>
                    )}

                    <div className="cn-request-main-col">
                      <div className="cn-request-type">Lời mời đến</div>
                      <h4 className="cn-request-title">
                        <strong>{r.nickname}</strong> muốn kết nối 1:1 với bạn
                      </h4>
                      <p className="cn-request-main">{r.note}</p>
                      <p className="cn-request-meta">
                        Mục tiêu tập luyện: {r.goal || "Chưa rõ"}
                        {distanceText ? ` · ${distanceText}` : ""}
                        </p>

                        <div className="cn-request-footer">
                        <span className="cn-request-meta">
                            Nhận {r.createdAtText || "—"}
                        </span>
                        <span className="cn-request-status-pill cn-request-status-pending">
                            Đang chờ bạn duyệt
                        </span>
                        </div>

                      <div className="cn-request-actions">
                        <button
                          type="button"
                          className="cn-btn-primary"
                          onClick={() => handleAcceptDuo(r.id)}
                        >
                          Duyệt kết nối 1:1
                        </button>
                        <button
                          type="button"
                          className="cn-btn-ghost"
                          onClick={() => handleRejectInvite(r.id)}
                        >
                          Từ chối
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ===== Box 2: Bạn đã gửi lời mời kết nối 1:1 ===== */}
      {outgoingUserRequests.length > 0 && (
        <div className="cn-myconnections-card">
          <div className="cn-requests-section">
            <h3 className="cn-requests-title">
              Bạn đã gửi lời mời kết nối 1:1
            </h3>
            <p className="cn-requests-desc">
              Đây là các lời mời 1:1 mà bạn đã gửi cho người khác. Bạn chỉ có
              thể <strong>hủy lời mời</strong>, không thể tự duyệt.
            </p>

            <div className="cn-requests-list">
              {outgoingUserRequests.map((r) => (
                <article key={r.id} className="cn-request-row">
                  {r.imageUrl && (
                    <div className="cn-request-thumb">
                      <img
                        src={r.imageUrl}
                        alt={r.nickname || "Người dùng FitMatch"}
                      />
                    </div>
                  )}

                  <div className="cn-request-main-col">
                    <div className="cn-request-type">Lời mời bạn gửi đi</div>
                    <h4 className="cn-request-title">
                      Gửi lời mời kết nối với người dùng{" "}
                      <strong>{r.nickname}</strong>
                    </h4>
                    <p className="cn-request-main">{r.note}</p>
                    {r.goal && (
                    <p className="cn-request-meta">
                        Mục tiêu của bạn tập: {r.goal}
                    </p>
                    )}

                    <div className="cn-request-footer">
                    <span className="cn-request-meta">
                        Gửi {r.createdAtText || "—"}
                    </span>
                    <span className="cn-request-status-pill cn-request-status-pending">
                        Đang chờ người dùng đồng ý
                    </span>
                    </div>

                    <div className="cn-request-actions">
                      <button
                        type="button"
                        className="cn-btn-primary"
                        onClick={() => handleCancelInvite(r.id)}
                      >
                        Hủy lời mời kết nối
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== Box 3: Bạn đã gửi lời mời tham gia nhóm ===== */}
      {outgoingGroupRequests.length > 0 && (
        <div className="cn-myconnections-card">
          <div className="cn-requests-section">
            <h3 className="cn-requests-title">
              Bạn đã gửi lời mời tham gia nhóm
            </h3>
            <p className="cn-requests-desc">
              Đây là các lời mời tham gia phòng kết nối nhóm. Bạn chỉ có thể{" "}
              <strong>hủy lời mời</strong>. Khi quản lý nhóm duyệt, bạn sẽ được
              đưa vào phòng Kết nối nhóm.
            </p>

            <div className="cn-requests-list">
              {outgoingGroupRequests.map((r) => (
                <article key={r.id} className="cn-request-row">
                  {r.imageUrl && (
                    <div className="cn-request-thumb">
                      <img
                        src={r.imageUrl}
                        alt={r.groupName || "Nhóm tập luyện"}
                      />
                    </div>
                  )}

                  <div className="cn-request-main-col">
                    <div className="cn-request-type">Lời mời bạn gửi đi</div>
                    <h4 className="cn-request-title">
                      Gửi lời mời kết nối với Nhóm{" "}
                      <strong>{r.groupName || "Nhóm"}</strong>
                    </h4>
                    <p className="cn-request-main">{r.note}</p>
                    <p className="cn-request-meta">
                    Thành viên hiện tại: {r.membersCount || 0} ·{" "}
                    {r.schedule || "Lịch tập chưa cập nhật"}
                    </p>

                    <div className="cn-request-footer">
                    <span className="cn-request-meta">
                        Gửi {r.createdAtText || "—"}
                    </span>
                    <span className="cn-request-status-pill cn-request-status-pending">
                        Đang chờ quản lý nhóm
                    </span>
                    </div>


                    <div className="cn-request-actions">
                      <button
                        type="button"
                        className="cn-btn-primary"
                        onClick={() => handleCancelInvite(r.id)}
                      >
                        Hủy lời mời tham gia nhóm
                      </button>
                      <button
                        type="button"
                        className="cn-btn-ghost"
                        onClick={handleOpenTeamConnectDemo}
                      >
                        Xem giao diện Kết nối nhóm
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
