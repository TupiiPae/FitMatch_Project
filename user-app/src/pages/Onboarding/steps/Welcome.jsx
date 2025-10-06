import { useNavigate } from "react-router-dom";
import "./Welcome.css";

export default function Welcome() {
  const nav = useNavigate();

  return (
    <div className="wl-wrap">
      <div className="wl-head">
        <h2 className="wl-title">~ Chào mừng đến với ~</h2>

        {/* Logo: thay src bằng ảnh thật */}
        <img
          className="wl-logo"
          src="/images/logo-fitmatch.png"
          alt="FitMatch"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      </div>

      <div className="wl-grid">
        <div className="wl-item">
          <div className="wl-thumb" />
          <p className="wl-caption">
            Đồng hành cùng nhau <br /> để tạo nên giá trị
          </p>
        </div>

        <div className="wl-item">
          <div className="wl-thumb" />
          <p className="wl-caption">
            Lên kế hoạch cho dinh <br /> dưỡng và tập luyện
          </p>
        </div>

        <div className="wl-item">
          <div className="wl-thumb" />
          <p className="wl-caption">
            Dễ dàng với AI hỗ trợ <br /> tính toán Calo
          </p>
        </div>
      </div>

      <button className="wl-start" onClick={() => nav("../ten-goi")}>
        Bắt đầu
      </button>
    </div>
  );
}
