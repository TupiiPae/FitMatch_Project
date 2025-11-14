import { useNavigate, Link } from "react-router-dom";
import "./Welcome.css";
import { useState } from "react";

const FEATURES = [
  {
    img: "/images/welcome1.png",       // đặt ảnh vào public/images/welcome/*
    caption: <>Đồng hành cùng nhau <br /> để tạo nên giá trị</>,
  },
  {
    img: "/images/welcome2.png",
    caption: <>Lên kế hoạch cho dinh <br /> dưỡng và tập luyện</>,
  },
  {
    img: "/images/welcome3.png",
    caption: <>Dễ dàng với AI hỗ trợ <br /> tính toán Calo</>,
  },
];

export default function Welcome() {
  const nav = useNavigate();
  // fallback cho ảnh lỗi: thay bằng placeholder
  const [errs, setErrs] = useState({}); // {index: true}

  const onImgError = (idx) =>
    setErrs((e) => ({ ...e, [idx]: true }));

  return (
    <div className="wel-wrap">
      <div className="wel-head">
        <h2 className="wel-title">~ Chào mừng đến với ~</h2>
        <Link to="/" className="logo-link" aria-label="Về trang chủ">
          <img src="/images/logo-fitmatch.png" alt="FitMatch" className="nk-logo" />
        </Link>
      </div>

      <div className="wel-grid">
        {FEATURES.map((f, idx) => (
          <div className="wel-item" key={idx}>
            <div className="wel-thumb">
              {/* Nếu ảnh lỗi, hiện khung xám (placeholder) */}
              {!errs[idx] ? (
                <img
                  src={f.img}
                  alt={`feature-${idx + 1}`}
                  className="wl-thumb-img"
                  loading="lazy"
                  decoding="async"
                  onError={() => onImgError(idx)}
                />
              ) : (
                <div className="wel-thumb-fallback" />
              )}
            </div>
            <p className="wel-caption">{f.caption}</p>
          </div>
        ))}
      </div>

      <button className="wel-start" onClick={() => nav("../ten-goi")}>
        Bắt đầu
      </button>
    </div>
  );
}
