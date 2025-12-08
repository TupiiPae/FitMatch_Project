import "./TeamConnect.css";

/**
 * Giao diện phòng kết nối nhóm (>= 3–5 người).
 * Chỉ mock UI, sau này thay bằng dữ liệu thật.
 */
export default function TeamConnect() {
  const group = {
    name: "Morning Strength Club",
    role: "Quản lý nhóm",
    membersCount: 4,
    schedule: "Full body · 3 buổi/tuần · Sáng",
    goal: "Tăng cơ & khỏe tổng thể",
    locationLabel: "Quận 7, TP.HCM",
  };

  const members = [
    { id: "m1", name: "Bạn", role: "Bạn", goal: "Giảm cân & săn chắc" },
    { id: "m2", name: "Minh Quân", role: "Thành viên", goal: "Tăng cơ" },
    { id: "m3", name: "Linh Trần", role: "Thành viên", goal: "Giữ dáng" },
    { id: "m4", name: "Hà Phạm", role: "Thành viên", goal: "Chạy 5K" },
  ];

  return (
    <div className="tc-page">
      <section className="tc-card">
        <header className="tc-header">
          <div>
            <h1 className="tc-title">{group.name}</h1>
            <p className="tc-sub">
              Vai trò của bạn: <strong>{group.role}</strong> ·{" "}
              {group.membersCount} thành viên · {group.locationLabel}
            </p>
            <p className="tc-sub">
              Mỗi tài khoản chỉ có thể tham gia <strong>1 phòng kết nối nhóm</strong> tại
              một thời điểm.
            </p>
          </div>
          <div className="tc-header-right">
            <div className="tc-tag">Phòng Kết nối nhóm</div>
            <div className="tc-tag tc-tag-soft">{group.schedule}</div>
          </div>
        </header>

        <div className="tc-body">
          <div className="tc-col-main">
            <h2 className="tc-section-title">Mục tiêu & định hướng nhóm</h2>
            <p className="tc-paragraph">
              Mục tiêu chính: <strong>{group.goal}</strong>. Nhóm sử dụng phòng kết
              nối này để thống nhất lịch tập, cập nhật tiến độ của từng thành
              viên và thúc đẩy nhau hoàn thành mục tiêu mỗi tuần.
            </p>

            <h2 className="tc-section-title">Thành viên trong nhóm</h2>
            <div className="tc-members-grid">
              {members.map((m) => (
                <article key={m.id} className="tc-member-card">
                  <div className="tc-member-avatar">
                    {getInitials(m.name)}
                  </div>
                  <div className="tc-member-main">
                    <div className="tc-member-name-row">
                      <span className="tc-member-name">{m.name}</span>
                      {m.role === "Bạn" && (
                        <span className="tc-badge tc-badge-you">Bạn</span>
                      )}
                      {m.role === "Quản lý" && (
                        <span className="tc-badge tc-badge-admin">Quản lý</span>
                      )}
                    </div>
                    <div className="tc-member-meta">
                      Mục tiêu: {m.goal || "Chưa cập nhật"}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <aside className="tc-col-side">
            <h3 className="tc-section-title">Gợi ý hoạt động nhóm</h3>
            <div className="tc-side-card">
              <ul className="tc-side-list">
                <li>Check-in hoàn thành buổi tập hàng ngày.</li>
                <li>Chia sẻ ảnh / log dinh dưỡng nổi bật.</li>
                <li>Thống nhất lịch chạy bộ / tập kháng lực chung.</li>
                <li>Đặt mục tiêu nhỏ cho từng tuần.</li>
              </ul>
            </div>
          </aside>
        </div>

        <footer className="tc-footer">
          <button type="button" className="tc-btn-primary">
            Mở chat nhóm
          </button>
          <button type="button" className="tc-btn-outline">
            Rời nhóm
          </button>
        </footer>
      </section>
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
