import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./CreateTeam.css";

export default function CreateTeam() {
  const nav = useNavigate();

  const [teamName, setTeamName] = useState("");
  const [goal, setGoal] = useState("lose_weight");
  const [size, setSize] = useState("5");
  const [genderLimit, setGenderLimit] = useState("any");

  function handleSubmit(e) {
    e.preventDefault();
    // TODO: gọi API tạo nhóm
    // Hiện tại chỉ demo UI
    alert("Demo: Tạo nhóm thành công (UI thử nghiệm, chưa gọi API)");
    nav("/ket-noi");
  }

  return (
    <div className="cnt-create-page">
      <header className="cnt-create-header">
        <button
          type="button"
          className="cnt-back-btn"
          onClick={() => nav("/ket-noi")}
        >
          ← Quay lại Kết nối
        </button>
        <h1>Tạo nhóm tập luyện</h1>
        <p>
          Thiết lập nhóm tối đa 5 người để cùng nhau theo dõi tiến độ, nhắc nhở
          và hoàn thành mục tiêu.
        </p>
      </header>

      <form className="cnt-create-card" onSubmit={handleSubmit}>
        <div className="cnt-create-grid">
          <div className="cnt-create-col">
            <div className="cnt-field">
              <label>Tên nhóm *</label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Ví dụ: Team Giảm mỡ 2025"
                required
              />
            </div>

            <div className="cnt-field">
              <label>Mục tiêu chung *</label>
              <select
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
              >
                <option value="lose_weight">Giảm cân & giảm mỡ</option>
                <option value="muscle_gain">Tăng cơ & sức mạnh</option>
                <option value="stay_fit">Giữ dáng & khỏe mạnh</option>
                <option value="endurance">Tăng sức bền</option>
              </select>
            </div>

            <div className="cnt-field">
              <label>Mô tả nhóm</label>
              <textarea
                rows={4}
                placeholder="Giới thiệu ngắn về nhóm, phong cách tập, mức độ mong muốn..."
              />
            </div>
          </div>

          <div className="cnt-create-col">
            <div className="cnt-field">
              <label>Kích thước nhóm (tối đa 5 người)</label>
              <select value={size} onChange={(e) => setSize(e.target.value)}>
                <option value="2">2 người</option>
                <option value="3">3 người</option>
                <option value="4">4 người</option>
                <option value="5">5 người</option>
              </select>
            </div>

            <div className="cnt-field">
              <label>Giới hạn giới tính</label>
              <select
                value={genderLimit}
                onChange={(e) => setGenderLimit(e.target.value)}
              >
                <option value="any">Không giới hạn</option>
                <option value="same">Cùng giới với bạn</option>
                <option value="male">Chỉ Nam</option>
                <option value="female">Chỉ Nữ</option>
              </select>
            </div>

            <div className="cnt-field">
              <label>Lịch tập dự kiến</label>
              <div className="cnt-week-row">
                {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((d) => (
                  <button
                    key={d}
                    type="button"
                    className="cnt-week-chip"
                  >
                    {d}
                  </button>
                ))}
              </div>
              <small>Chỉ dùng để gợi ý – các thành viên vẫn có thể linh hoạt.</small>
            </div>

            <div className="cnt-field">
              <label>Ghi chú / quy tắc nhóm</label>
              <textarea
                rows={3}
                placeholder="Ví dụ: Không bỏ quá 2 buổi/tuần, check-in trước khi tập..."
              />
            </div>
          </div>
        </div>

        <div className="cnt-create-actions">
          <button
            type="button"
            className="cnt-btn-ghost"
            onClick={() => nav("/ket-noi")}
          >
            Hủy
          </button>
          <button type="submit" className="cnt-btn-primary">
            Tạo nhóm
          </button>
        </div>
      </form>
    </div>
  );
}
