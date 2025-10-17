// user-app/src/pages/Account/Profile/BodyProfile.jsx
import React, { useEffect, useState } from "react";
import api from "../../../lib/api";
import { toast } from "react-toastify";
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

  // Chế độ chỉnh sửa các trường lẻ
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ heightCm: "", weightKg: "", bodyFat: "" });
  const [saving, setSaving] = useState(false);

  // Modal “Thiết lập mục tiêu mới”
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [goalForm, setGoalForm] = useState({
    chieuCao: "",
    canNangHienTai: "",
    canNangMongMuon: "",
    mucTieu: "",
    mucTieuTuan: "",
    cuongDoLuyenTap: "",
    bodyFat: "",
  });
  const [creatingGoal, setCreatingGoal] = useState(false);

  const loadMe = async () => {
    setLoading(true);
    setErr("");
    try {
      const res = await api.get("/api/user/me");
      const u = res?.data?.user || null;
      setUser(u);
      const p = u?.profile || {};
      setForm({
        heightCm: p.heightCm ?? "",
        weightKg: p.weightKg ?? "",
        bodyFat: p.bodyFat ?? "",
      });
    } catch (e) {
      setErr(e?.response?.data?.message || "Không thể tải hồ sơ");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!mounted) return;
      await loadMe();
    })();
    return () => { mounted = false; };
  }, []);

  const p = user?.profile || {};

  const onChange = (e) => {
    const { name, value } = e.target;
    if (/^[0-9]*\.?[0-9]*$/.test(value) || value === "") {
      setForm((s) => ({ ...s, [name]: value }));
    }
  };

  const onCancel = () => {
    const p2 = user?.profile || {};
    setForm({
      heightCm: p2.heightCm ?? "",
      weightKg: p2.weightKg ?? "",
      bodyFat: p2.bodyFat ?? "",
    });
    setEdit(false);
  };

  const onSave = async () => {
    const payload = {
      profile: {
        heightCm: form.heightCm === "" ? undefined : Number(form.heightCm),
        weightKg: form.weightKg === "" ? undefined : Number(form.weightKg),
        bodyFat: form.bodyFat === "" ? undefined : Number(form.bodyFat),
      },
    };
    setSaving(true);
    try {
      const res = await api.patch("/api/user/account", payload);
      const u = res?.data?.user;
      if (u) {
        setUser(u);
        const p3 = u.profile || {};
        setForm({
          heightCm: p3.heightCm ?? "",
          weightKg: p3.weightKg ?? "",
          bodyFat: p3.bodyFat ?? "",
        });
      }
      setEdit(false);
      toast.success("Cập nhật hồ sơ thành công!");
    } catch (e) {
      const msg = e?.response?.data?.message || "Cập nhật thất bại";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // ===== Modal “Thiết lập mục tiêu mới”
  const openNewGoal = () => {
    const curr = user?.profile || {};
    setGoalForm({
      chieuCao: curr.heightCm ?? "",
      canNangHienTai: curr.weightKg ?? "",
      canNangMongMuon: curr.targetWeightKg ?? "",
      mucTieu: curr.goal ?? "",
      mucTieuTuan: curr.weeklyChangeKg ?? "",
      cuongDoLuyenTap: curr.trainingIntensity ?? "",
      bodyFat: curr.bodyFat ?? "",
    });
    setShowNewGoal(true);
  };

  const createNewGoal = async () => {
    const payload = {
      chieuCao: goalForm.chieuCao === "" ? undefined : Number(goalForm.chieuCao),
      canNangHienTai: goalForm.canNangHienTai === "" ? undefined : Number(goalForm.canNangHienTai),
      canNangMongMuon: goalForm.canNangMongMuon === "" ? undefined : Number(goalForm.canNangMongMuon),
      mucTieu: goalForm.mucTieu || undefined,
      mucTieuTuan: goalForm.mucTieuTuan === "" ? undefined : Number(goalForm.mucTieuTuan),
      cuongDoLuyenTap: goalForm.cuongDoLuyenTap || undefined,
      bodyFat: goalForm.bodyFat === "" ? undefined : Number(goalForm.bodyFat),
    };

    setCreatingGoal(true);
    try {
      await api.post("/api/user/onboarding/goal", payload);
      toast.success("Đã tạo mục tiêu mới!");
      setShowNewGoal(false);
      await loadMe();
    } catch (e) {
      const msg = e?.response?.data?.message || "Tạo mục tiêu thất bại";
      toast.error(msg);
    } finally {
      setCreatingGoal(false);
    }
  };

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
                <input
                  name="heightCm"
                  disabled={!edit}
                  value={edit ? form.heightCm : (p.heightCm ?? "")}
                  onChange={onChange}
                  placeholder="xxx"
                />
                <span>cm</span>
              </div>
            </div>

            <div className="pf-form-cell">
              <label>Cân nặng</label>
              <div className="pf-unit">
                <input
                  name="weightKg"
                  disabled={!edit}
                  value={edit ? form.weightKg : (p.weightKg ?? "")}
                  onChange={onChange}
                  placeholder="xx"
                />
                <span>kg</span>
              </div>
            </div>

            <div className="pf-form-cell">
              <label>Body fat</label>
              <div className="pf-unit">
                <input
                  name="bodyFat"
                  disabled={!edit}
                  value={edit ? form.bodyFat : (p.bodyFat ?? "")}
                  onChange={onChange}
                  placeholder="—"
                />
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
            <button type="button" className="btn-primary-1" onClick={openNewGoal}>
              Thiết lập mục tiêu mới
            </button>
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

          {/* Cập nhật / Lưu + Hủy */}
          <div className="pf-actions pf-actions-right">
            {!edit ? (
              <button className="btn-secondary" onClick={() => setEdit(true)}>
                Cập nhật
              </button>
            ) : (
              <>
                <button
                  className="btn-tertiary"
                  onClick={onCancel}
                  disabled={saving}
                  style={{ marginRight: 8 }}
                >
                  Hủy
                </button>
                <button
                  className="btn-primary"
                  onClick={onSave}
                  disabled={saving}
                >
                  {saving ? "Đang lưu..." : "Lưu"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modal mục tiêu mới */}
      {showNewGoal && (
        <div className="pf-modal">
          <div
            className="pf-modal-backdrop"
            onClick={() => !creatingGoal && setShowNewGoal(false)}
          />
          <div className="pf-modal-card">
            <h3 className="pf-subtitle">Thiết lập mục tiêu mới</h3>

            <div className="pf-form-2">
              <label>Chiều cao (cm)
                <input
                  value={goalForm.chieuCao}
                  onChange={(e)=>setGoalForm(g=>({...g, chieuCao: e.target.value}))}
                  placeholder="170"
                />
              </label>
              <label>Cân nặng hiện tại (kg)
                <input
                  value={goalForm.canNangHienTai}
                  onChange={(e)=>setGoalForm(g=>({...g, canNangHienTai: e.target.value}))}
                  placeholder="65"
                />
              </label>
              <label>Cân nặng mục tiêu (kg)
                <input
                  value={goalForm.canNangMongMuon}
                  onChange={(e)=>setGoalForm(g=>({...g, canNangMongMuon: e.target.value}))}
                  placeholder="58"
                />
              </label>

              <label>Mục tiêu
                <select
                  value={goalForm.mucTieu}
                  onChange={(e)=>setGoalForm(g=>({...g, mucTieu: e.target.value}))}
                >
                  <option value="">— chọn —</option>
                  <option value="giam_can">Giảm cân</option>
                  <option value="giam_mo">Giảm mỡ</option>
                  <option value="duy_tri">Duy trì</option>
                  <option value="tang_can">Tăng cân</option>
                  <option value="tang_co">Tăng cơ</option>
                </select>
              </label>

              <label>Mục tiêu tuần (kg/tuần)
                <input
                  value={goalForm.mucTieuTuan}
                  onChange={(e)=>setGoalForm(g=>({...g, mucTieuTuan: e.target.value}))}
                  placeholder="0.5"
                />
              </label>

              <label>Cường độ luyện tập
                <select
                  value={goalForm.cuongDoLuyenTap}
                  onChange={(e)=>setGoalForm(g=>({...g, cuongDoLuyenTap: e.target.value}))}
                >
                  <option value="">— chọn —</option>
                  <option value="level_1">level_1</option>
                  <option value="level_2">level_2</option>
                  <option value="level_3">level_3</option>
                  <option value="level_4">level_4</option>
                </select>
              </label>

              <label>BodyFat (%)
                <input
                  value={goalForm.bodyFat}
                  onChange={(e)=>setGoalForm(g=>({...g, bodyFat: e.target.value}))}
                  placeholder="18"
                />
              </label>
            </div>

            <div className="pf-actions pf-actions-right" style={{ marginTop: 12 }}>
              <button
                className="btn-tertiary"
                onClick={()=>!creatingGoal && setShowNewGoal(false)}
                disabled={creatingGoal}
              >
                Hủy
              </button>
              <button
                className="btn-primary"
                onClick={createNewGoal}
                disabled={creatingGoal}
                style={{ marginLeft: 8 }}
              >
                {creatingGoal ? "Đang tạo..." : "Tạo mục tiêu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
