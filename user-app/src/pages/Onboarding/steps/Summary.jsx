import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../../lib/api";
import "./Summary.css";

const GOAL_LABEL = {
  giam_can: "Giảm cân",
  duy_tri: "Duy trì cân nặng",
  tang_can: "Tăng cân",
  giam_mo: "Giảm mỡ",
  tang_co: "Tăng cơ",
};
const INTEN_LABEL = {
  level_1: "Không tập luyện, ít vận động",
  level_2: "Vận động nhẹ nhàng",
  level_3: "Chăm chỉ tập luyện",
  level_4: "Rất năng động",
};

export default function Summary() {
  const nav = useNavigate();
  const goal = localStorage.getItem("goal");
  const height = Number(localStorage.getItem("heightCm") || 170);
  const weight = Number(localStorage.getItem("weightKg") || 65);
  const target = Number(localStorage.getItem("targetWeightKg") || weight);
  const weekly = Number(localStorage.getItem("weeklyChangeKg") || 0);
  const inten = localStorage.getItem("trainingIntensity");

  const bmi = useMemo(() => {
    const v = weight / Math.pow(height / 100, 2);
    return Number(v.toFixed(1));
  }, [height, weight]);

  // 6 mức BMI + màu (đồng bộ)
  const bmiInfo = useMemo(() => {
    let tag = "Bình thường";
    let bgColor = "#4CAF50";
    let textColor = "#fff";
    if (bmi < 18.5) { tag = "Gầy"; bgColor = "#40E0D0"; }
    else if (bmi < 25) { tag = "Bình thường"; bgColor = "#4CAF50"; }
    else if (bmi < 30) { tag = "Thừa cân"; bgColor = "#FFD54F"; textColor = "#000"; }
    else if (bmi < 35) { tag = "Béo phì độ I"; bgColor = "#FF9800"; }
    else if (bmi < 40) { tag = "Béo phì độ II"; bgColor = "#FF6E6E"; }
    else { tag = "Béo phì độ III"; bgColor = "#D32F2F"; }
    return { tag, bgColor, textColor };
  }, [bmi]);

  // Map BMI về dải 15 → 40 để đặt marker
  const toPercent = (val) => Math.min(100, Math.max(0, ((val - 15) / (40 - 15)) * 100));
  const percent = toPercent(bmi);

  // Các mốc hiển thị dưới thanh
  const scaleMarks = [18.5, 25, 30, 35];

  const handleConfirm = async () => {
    const payload = {
      tenGoi: localStorage.getItem("nickname"),
      mucTieu: localStorage.getItem("goal"),
      chieuCao: Number(localStorage.getItem("heightCm")),
      canNangHienTai: Number(localStorage.getItem("weightKg")),
      canNangMongMuon: Number(localStorage.getItem("targetWeightKg")),
      mucTieuTuan: Number(localStorage.getItem("weeklyChangeKg")),
      cuongDoLuyenTap: localStorage.getItem("trainingIntensity"),
      gioiTinh: localStorage.getItem("sex"),
      ngaySinh: localStorage.getItem("dob"),
    };

    const missing = Object.entries(payload)
      .filter(([_, v]) => v === null || v === undefined || v === "" || Number.isNaN(v))
      .map(([k]) => k);

    if (missing.length) {
      alert("Thiếu dữ liệu: " + missing.join(", ") + ". Hãy quay lại bổ sung.");
      return;
    }

    try {
      await api.post("/api/user/onboarding/upsert", payload);
      nav("/home");
    } catch (err) {
      alert("Gửi dữ liệu thất bại.\n" + (err?.response?.data?.message || "Xem console để biết chi tiết."));
      console.error(err);
    }
  };

  return (
    <div className="sm-wrap">
      <header className="sm-header">
        <img src="\images\logo-fitmatch.png" alt="FitMatch" className="sm-logo" />
      </header>

      <main className="sm-main">
        <div className="sm-card">
          <h3 className="sm-title">FitMatch tổng hợp lại thông tin giúp bạn nhé !</h3>

          <div className="sm-box">
            <div className="sm-row">
              <span>Mục tiêu</span>
              <b>{GOAL_LABEL[goal] || "-"}</b>
            </div>
            <div className="sm-row">
              <span>Cân nặng mục tiêu</span>
              <b>{target.toFixed(1)} kg</b>
            </div>
            <div className="sm-row">
              <span>Cường độ tập luyện</span>
              <b>{INTEN_LABEL[inten] || "-"}</b>
            </div>
            {goal !== "duy_tri" && (
              <div className="sm-row">
                <span>Mục tiêu mỗi tuần</span>
                <b>{weekly > 0 ? `+${weekly.toFixed(1)}` : weekly.toFixed(1)} kg</b>
              </div>
            )}
          </div>

          {/* ===== BMI ===== */}
          <div className="sm-bmi">
            <div className="sm-bar">
              {/* Marker tròn (không số) */}
              <div
                className="sm-marker"
                style={{
                  left: `${percent}%`,
                  borderColor: bmiInfo.bgColor,
                  boxShadow: `0 0 0 6px ${bmiInfo.bgColor}22`
                }}
                aria-label={`BMI của bạn: ${bmi}`}
                title={`BMI: ${bmi}`}
              />
              {/* phần đã đi qua */}
              <div className="sm-bar-inner" style={{ width: `${percent}%` }} />
            </div>

            {/* Nhãn mốc dưới thanh */}
            <div className="sm-scale">
              <div className="sm-scale-end left">{`<18.5`}</div>
              {scaleMarks.map((m) => (
                <div key={m} className="sm-scale-mark" style={{ left: `${toPercent(m)}%` }}>
                  {m}
                </div>
              ))}
              <div className="sm-scale-end right">{`≥40`}</div>
            </div>

            <div className="sm-bmi-info">
              BMI hiện tại: <b>{bmi}</b>
              <span
                className="sm-chip"
                style={{ backgroundColor: bmiInfo.bgColor, color: bmiInfo.textColor }}
              >
                {bmiInfo.tag}
              </span>
            </div>
          </div>
        </div>

        <div className="sm-actions">
          <button className="btn btn-outline" onClick={() => nav(-1)}>Quay lại</button>
          <button className="btn btn-primary" onClick={handleConfirm}>Xác nhận</button>
        </div>
      </main>
    </div>
  );
}
