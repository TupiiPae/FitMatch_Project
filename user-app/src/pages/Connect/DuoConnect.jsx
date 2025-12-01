import "./DuoConnect.css";

/**
 * Giao diện phòng kết nối 1:1.
 * Chỉ mock UI, chưa gắn với dữ liệu thật.
 */
export default function DuoConnect() {
  const partner = {
    nickname: "Minh Quân",
    age: 26,
    genderLabel: "Nam",
    distanceText: "Cách bạn ~2 km",
    goal: "Tăng cơ & bền bỉ",
    frequency: "4–5 buổi/tuần",
    locationLabel: "Quận 1, TP.HCM",
    myGoal: "Giảm cân & săn chắc",
    myFrequency: "3–4 buổi/tuần",
    imageUrl:
      "https://i.pinimg.com/736x/63/9c/bb/639cbb0e9ac2a04c441c5e585a1a56c9.jpg",
  };

  return (
    <div className="dc-page">
      <section className="dc-card">
        <header className="dc-header">
          <div className="dc-header-left">
            <div className="dc-avatar">
              <img src={partner.imageUrl} alt={partner.nickname} />
            </div>
            <div>
              <h1 className="dc-title">
                Kết nối 1:1 với{" "}
                <span className="dc-title-highlight">{partner.nickname}</span>
              </h1>
              <p className="dc-sub">
                Hai bạn đang ở cùng một{" "}
                <strong>phòng kết nối 1:1</strong>. Mỗi tài khoản chỉ có thể
                tham gia <strong>1 phòng kết nối</strong> tại một thời điểm.
              </p>
            </div>
          </div>

          <div className="dc-header-right">
            <div className="dc-tag">Trạng thái: Đang hoạt động</div>
            <div className="dc-tag dc-tag-soft">
              Chế độ: 1:1 · {partner.distanceText}
            </div>
          </div>
        </header>

        <div className="dc-body">
          <div className="dc-col-main">
            <h2 className="dc-section-title">Tổng quan kết nối</h2>
            <ul className="dc-info-list">
              <li>
                <span className="dc-label">Mục tiêu của bạn</span>
                <span className="dc-value">{partner.myGoal}</span>
              </li>
              <li>
                <span className="dc-label">Mục tiêu của bạn tập</span>
                <span className="dc-value">{partner.goal}</span>
              </li>
              <li>
                <span className="dc-label">Tần suất luyện tập của bạn</span>
                <span className="dc-value">{partner.myFrequency}</span>
              </li>
              <li>
                <span className="dc-label">Tần suất của bạn tập</span>
                <span className="dc-value">{partner.frequency}</span>
              </li>
              <li>
                <span className="dc-label">Khu vực</span>
                <span className="dc-value">{partner.locationLabel}</span>
              </li>
            </ul>

            <h2 className="dc-section-title">Định hướng luyện tập chung</h2>
            <p className="dc-paragraph">
              Bạn có thể dùng phòng kết nối này để thống nhất lịch tập, nhắc
              nhau check-in, chia sẻ buổi tập hoàn thành hoặc cập nhật cảm nhận
              sau mỗi tuần. Kết hợp với{" "}
              <strong>Nhật ký dinh dưỡng / Lịch tập</strong> để theo dõi tiến
              độ của cả hai.
            </p>
          </div>

          <aside className="dc-col-side">
            <h3 className="dc-section-title">Lịch tập gợi ý</h3>
            <div className="dc-schedule-card">
              <p className="dc-schedule-title">
                Gợi ý lịch 4 buổi / tuần (demo)
              </p>
              <ul className="dc-schedule-list">
                <li>Thứ 2 – Ngực · Vai · Tay sau</li>
                <li>Thứ 3 – Chạy bộ nhẹ / HIIT</li>
                <li>Thứ 5 – Lưng · Tay trước</li>
                <li>Thứ 7 – Chân · Mông · Core</li>
              </ul>
              <p className="dc-schedule-note">
                Sau này dữ liệu thật có thể lấy từ{" "}
                <strong>Lịch tập của bạn</strong> hoặc{" "}
                <strong>Lịch tập gợi ý</strong>.
              </p>
            </div>
          </aside>
        </div>

        <footer className="dc-footer">
          <button type="button" className="dc-btn-primary">
            Mở chat 1:1
          </button>
          <button type="button" className="dc-btn-outline">
            Rời phòng kết nối
          </button>
        </footer>
      </section>
    </div>
  );
}
