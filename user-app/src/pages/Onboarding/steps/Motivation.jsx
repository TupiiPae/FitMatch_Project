import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Motivation.css";

const GOAL_LABEL = {
  giam_can: "Giảm cân",
  duy_tri: "Duy trì cân nặng",
  tang_can: "Tăng cân",
  giam_mo: "Giảm mỡ",
  tang_co: "Tăng cơ",
};

export default function Motivation() {
  const nav = useNavigate();
  const [goal, setGoal] = useState("");

  useEffect(() => {
    // lấy mục tiêu người dùng đã chọn từ localStorage
    const g = localStorage.getItem("goal") || "";
    setGoal(g);
  }, []);

  const handleNext = () => {
    // rẽ nhánh sau trang động lực:
    // - Duy trì → chọn cường độ
    // - Còn lại → nhập số liệu cơ bản
    if (goal === "duy_tri") {
      nav("/onboarding/cuong-do");
    } else {
      nav("/onboarding/so-lieu-co-ban");
    }
  };

  return (
    <div className="mv-wrap">
      <header className="mv-header">
        <img src="/assets/logo/fitmatch-logo.png" alt="FitMatch" className="mv-logo" />
      </header>

      <main className="mv-main">
        <div className="mv-card">
          <h3 className="mv-title">Tuyệt! Bạn đã có mục tiêu của mình 🎯</h3>
          {goal && (
            <p className="mv-sub">Mục tiêu bạn chọn: <strong>{GOAL_LABEL[goal] || ""}</strong></p>
          )}
          <div className="mv-box">
            <p>
              Hãy cố gắng cho cuộc hành trình sắp tới nhé! Chúng tôi sẽ đồng hành
              và hỗ trợ bạn hết mình để đạt được mục tiêu.
            </p>
            <p>
              Con đường phía trước đôi lúc sẽ có lúc khó khăn, nhưng đừng nản chí.
              Mỗi bước nhỏ hôm nay sẽ tạo nên thay đổi lớn ngày mai. 💪
            </p>
          </div>
        </div>

        <div className="mv-actions">
          <button className="btn btn-outline" onClick={() => nav("/onboarding/muc-tieu")}>
            Hủy
          </button>
          <button className="btn btn-primary" onClick={handleNext}>
            Tiếp theo
          </button>
        </div>
      </main>
    </div>
  );
}
