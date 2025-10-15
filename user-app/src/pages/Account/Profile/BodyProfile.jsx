// user-app/src/pages/Account/Profile/BodyProfile.jsx
import React, { useEffect, useState } from "react";
import api from "../../../lib/api"; // đường dẫn từ Profile/BodyProfile.jsx lên lib/api.js
import "./BodyProfile.css";

const calcAge = (dob) => {
  if (!dob) return "";
  const [y, m, d] = dob.split("-").map(Number);
  const b = new Date(y, (m || 1) - 1, d || 1);
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const md = t.getMonth() - b.getMonth();
  if (md < 0 || (md === 0 && t.getDate() < b.getDate())) a--;
  return Number.isNaN(a) ? "" : a;
};

export default function BodyProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const res = await api.get("/api/user/me");
        if (!mounted) return;
        setUser(res?.data?.user || null);
      } catch (e) {
        if (!mounted) return;
        setErr(e?.response?.data?.message || "Không thể tải hồ sơ");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="card">
        <h2 className="pf-title">Hồ sơ thể chất</h2>
        <div className="pf-loading">Đang tải...</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="card">
        <h2 className="pf-title">Hồ sơ thể chất</h2>
        <div className="pf-error">{err}</div>
      </div>
    );
  }

  const p = user?.profile || {};

  return (
    <div className="card">
      <h2 className="pf-title">Hồ sơ thể chất</h2>
          <h3 className="pf-subtitle">Thông tin cơ bản</h3>
      <div className="pf-grid-2">
        {/* Cột trái */}
        <div>

          <div className="pf-form-row">
            <label>Giới tính</label>
            <select value={p.sex || ""} disabled>
              <option value="" disabled>—</option>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
            </select>
          </div>

          <div className="pf-form-5">
            <div className="pf-form-cell">
              <label>Tuổi</label>
              <div className="pf-unit" data-muted>
                <input disabled value={p.dob ? calcAge(p.dob) : ""} placeholder="21" />
              </div>
            </div>
            <div className="pf-form-cell">
              <label>Chiều cao</label>
              <div className="pf-unit">
                <input disabled value={p.heightCm ?? ""} placeholder="xxx" />
                <span>cm</span>
              </div>
            </div>
            <div className="pf-form-cell">
              <label>Cân nặng</label>
              <div className="pf-unit">
                <input disabled value={p.weightKg ?? ""} placeholder="xx" />
                <span>kg</span>
              </div>
            </div>
            <div className="pf-form-cell">
              <label>Body fat</label>
              <div className="pf-unit">
                <input disabled placeholder="—" />
                <span>%</span>
              </div>
            </div>
            <div className="pf-form-cell">
              <label>BMI</label>
              <div className="pf-unit" data-muted>
                <input disabled value={p.bmi ?? ""} placeholder="Tự tính" />
                <span>—</span>
              </div>
            </div>
          </div>

          <h3 className="pf-subtitle">Mục tiêu cân nặng</h3>
          <p className="pf-desc">
            Mục tiêu và ước tính dựa trên dữ liệu hiện có.
          </p>

          <div className="pf-table">
            <div className="pf-tr pf-tr-head">
              <div className="pf-td">Mục tiêu</div>
              <div className="pf-td pf-td-end">
                {(p.weightKg ?? "xx")} kg → {(p.targetWeightKg ?? "xx")} kg
              </div>
            </div>
            <div className="pf-tr">
              <div className="pf-td">Mục tiêu hằng tuần</div>
              <div className="pf-td pf-td-end">
                {typeof p.weeklyChangeKg === "number"
                  ? (p.goal === "tang_can" || p.goal === "tang_co"
                      ? `Tăng ${p.weeklyChangeKg} kg/tuần`
                      : `Giảm ${p.weeklyChangeKg} kg/tuần`)
                  : "—"}
              </div>
            </div>
            <div className="pf-tr">
              <div className="pf-td">Cường độ vận động</div>
              <div className="pf-td pf-td-end">{p.trainingIntensity || "—"}</div>
            </div>
            <div className="pf-tr">
              <div className="pf-td">Calo mục tiêu (ước tính)</div>
              <div className="pf-td pf-td-end">
                {typeof p.tdee === "number" ? `${Math.round(p.tdee)} kcal` : "—"}
              </div>
            </div>
            <div className="pf-tr">
              <div className="pf-td">Dự kiến hoàn thành</div>
              <div className="pf-td pf-td-end">—</div>
            </div>
          </div>

          <div className="pf-actions">
            <button className="btn-primary" disabled>Thiết lập mục tiêu mới</button>
          </div>
        </div>

        {/* Cột phải */}
        <div>
          <h3 className="pf-subtitle">Chỉ số sức khỏe và đo lường</h3>
          <div className="pf-measures">
            {["Vòng cổ", "Vòng eo", "Vòng ngực", "Vòng cổ", "Vòng eo", "Vòng ngực"].map(
              (label, i) => (
                <div key={i} className="measure">
                  <div className="measure-top">
                    <div className="measure-name">{label}</div>
                    <button className="measure-add" disabled>+</button>
                  </div>
                  <div className="measure-value">—</div>
                </div>
              )
            )}
          </div>

          <div className="pf-actions pf-actions-right">
            <button className="btn-secondary" disabled>Cập nhật</button>
          </div>
        </div>
      </div>
    </div>
  );
}
