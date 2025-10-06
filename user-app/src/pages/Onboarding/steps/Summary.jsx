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
    const v = weight / Math.pow(height/100, 2);
    return Number(v.toFixed(1));
  }, [height, weight]);

  const bmiTag = useMemo(() => {
    if (bmi < 18.5) return "Thiếu cân";
    if (bmi < 25) return "Bình thường";
    if (bmi < 30) return "Thừa cân";
    return "Béo phì";
  }, [bmi]);

  const percent = Math.min(100, Math.max(0, ((bmi - 15) / (35 - 15)) * 100)); // bar 15→35

  const handleConfirm = async () => {
    await api.post("/user/onboarding/finalize");
    // sang app chính
    nav("/ung-dung");
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

          <div className="sm-bmi">
            <div className="sm-bar">
              <div className="sm-bar-inner" style={{ width: `${percent}%` }} />
            </div>
            <div className="sm-bmi-info">
              BMI hiện tại: <b>{bmi}</b> <span className="sm-chip">{bmiTag}</span>
            </div>
          </div>
        </div>

        <div className="sm-actions">
          <button className="btn btn-outline" onClick={() => nav(-1)}>Hủy</button>
          <button className="btn btn-primary" onClick={handleConfirm}>Xác nhận</button>
        </div>
      </main>
    </div>
  );
}
