import { useNavigate } from "react-router-dom";
import "../onboard.css";

export default function Cheer() {
  const nav = useNavigate();

  return (
    <div className="onb-wrap">
      <div className="onb-card">
        <div className="cheer-box">
          <h3>Tuyệt! Bạn đã có mục tiêu của mình 🎯</h3>
          <p>
            Hãy cố gắng cho cuộc hành trình sắp tới nhé! Chúng tôi sẽ đồng hành cùng bạn
            để đạt mục tiêu. Hành trình đôi lúc sẽ khó khăn, đừng nản chí!
          </p>
        </div>

        <div className="onb-actions">
          <button className="btn btn-link" onClick={() => nav("../muc-tieu")}>Quay lại</button>
          <button className="btn btn-primary" onClick={() => nav("../nhap-so-lieu") /* sẽ là bước 5 */}>
            Tiếp tục
          </button>
        </div>
      </div>
    </div>
  );
}
