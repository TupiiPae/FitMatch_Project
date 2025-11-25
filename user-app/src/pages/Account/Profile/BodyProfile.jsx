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

const toStr = (v) => (v === undefined || v === null ? "" : String(v));

const PHOTO_TABS = [
  { id: "all", label: "Tất cả" },
  { id: "front", label: "Mặt trước" },
  { id: "side", label: "Mặt hông" },
  { id: "back", label: "Mặt sau" },
];

export default function BodyProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [form, setForm] = useState({ heightCm: "", weightKg: "", bodyFat: "" });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

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

  // Tab hình ảnh tiến độ
  const [photoTab, setPhotoTab] = useState("all");

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
    return () => {
      mounted = false;
    };
  }, []);

  // Theo dõi thay đổi để bật / tắt nút Lưu / Hủy
  useEffect(() => {
    if (!user) {
      setDirty(false);
      return;
    }
    const p2 = user.profile || {};
    const same =
      toStr(form.heightCm) === toStr(p2.heightCm) &&
      toStr(form.weightKg) === toStr(p2.weightKg) &&
      toStr(form.bodyFat) === toStr(p2.bodyFat);
    setDirty(!same);
  }, [form, user]);

  const p = user?.profile || {};

  const onChange = (e) => {
    const { name, value } = e.target;
    // chỉ cho phép số + dấu chấm
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
  };

  const onSave = async () => {
    if (!dirty) return;

    // build payload theo dạng key phẳng giống trang Account
    const payload = {};

    if (form.heightCm !== "") {
      payload["profile.heightCm"] = Number(form.heightCm);
    }
    if (form.weightKg !== "") {
      payload["profile.weightKg"] = Number(form.weightKg);
    }
    if (form.bodyFat !== "") {
      payload["profile.bodyFat"] = Number(form.bodyFat);
    }

    // nếu không có giá trị hợp lệ nào thì khỏi call API
    if (Object.keys(payload).length === 0) {
      toast.error("Không có thay đổi hợp lệ để lưu.");
      return;
    }

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
      canNangHienTai:
        goalForm.canNangHienTai === "" ? undefined : Number(goalForm.canNangHienTai),
      canNangMongMuon:
        goalForm.canNangMongMuon === "" ? undefined : Number(goalForm.canNangMongMuon),
      mucTieu: goalForm.mucTieu || undefined,
      mucTieuTuan:
        goalForm.mucTieuTuan === "" ? undefined : Number(goalForm.mucTieuTuan),
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

  const sexLabel =
    p.sex === "male" ? "Nam" : p.sex === "female" ? "Nữ" : "";

  const age = p.dob ? calcAge(p.dob) : "";

  if (loading) {
    return (
      <div className="bp-page">
        <div className="bp-loading">Đang tải hồ sơ thể chất…</div>
      </div>
    );
  }

  if (err) {
    return (
      <div className="bp-page">
        <div className="bp-error">{err}</div>
      </div>
    );
  }

  return (
    <div className="bp-page">
      {/* ===== Thông tin cơ bản ===== */}
      <section className="bp-section">
        <h1 className="bp-title-main">Hồ sơ thể chất</h1>
        <h2 className="gc-title-sub">Thông tin cơ bản</h2>

        {/* Giới tính + Tuổi */}
        <div className="bp-row bp-row-2">
          <div className="bp-field">
            <label className="bp-label">Giới tính</label>
            <input
              className="bp-input bp-input-readonly"
              value={sexLabel}
              readOnly
              placeholder="—"
            />
          </div>
          <div className="bp-field">
            <label className="bp-label">Tuổi</label>
            <input
              className="bp-input bp-input-readonly"
              value={age}
              readOnly
              placeholder="—"
            />
          </div>
        </div>

        {/* Chiều cao / Cân nặng / BodyFat / BMI */}
        <div className="bp-row bp-row-4">
          <div className="bp-field">
            <label className="bp-label">Chiều cao</label>
            <div className="bp-input-unit">
              <input
                className="bp-input"
                name="heightCm"
                value={toStr(form.heightCm)}
                onChange={onChange}
                placeholder="Nhập chiều cao"
              />
              <span className="bp-unit">cm</span>
            </div>
          </div>

          <div className="bp-field">
            <label className="bp-label">Cân nặng</label>
            <div className="bp-input-unit">
              <input
                className="bp-input"
                name="weightKg"
                value={toStr(form.weightKg)}
                onChange={onChange}
                placeholder="Nhập cân nặng"
              />
              <span className="bp-unit">kg</span>
            </div>
          </div>

          <div className="bp-field">
            <label className="bp-label">BodyFat</label>
            <div className="bp-input-unit">
              <input
                className="bp-input"
                name="bodyFat"
                value={toStr(form.bodyFat)}
                onChange={onChange}
                placeholder="Nhập % mỡ cơ thể"
              />
              <span className="bp-unit">%</span>
            </div>
          </div>

          <div className="bp-field">
            <label className="bp-label">BMI</label>
            <div className="bp-input-unit">
              <input
                className="bp-input bp-input-readonly"
                value={toStr(p.bmi)}
                readOnly
                placeholder="—"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ===== Mục tiêu cân nặng ===== */}
      <section className="bp-section">
        <h2 className="bp-title-sub">Mục tiêu cân nặng</h2>
        <p className="bp-desc">
          Mục tiêu và ước tính dựa trên dữ liệu hiện có.
        </p>

        <div className="bp-goal-table">
          <div className="bp-row-goal bp-row-goal-head">
            <div className="bp-cell">Mục tiêu</div>
            <div className="bp-cell bp-cell-end">
              {(p.weightKg ?? "xx")} kg → {(p.targetWeightKg ?? "xx")} kg
            </div>
          </div>
          <div className="bp-row-goal">
            <div className="bp-cell">Mục tiêu hằng tuần</div>
            <div className="bp-cell bp-cell-end">
              {typeof p.weeklyChangeKg === "number"
                ? p.goal === "tang_can" || p.goal === "tang_co"
                  ? `Tăng ${p.weeklyChangeKg} kg/tuần`
                  : `Giảm ${p.weeklyChangeKg} kg/tuần`
                : "—"}
            </div>
          </div>
          <div className="bp-row-goal">
            <div className="bp-cell">Cường độ vận động</div>
            <div className="bp-cell bp-cell-end">
              {p.trainingIntensity || "—"}
            </div>
          </div>
          <div className="bp-row-goal">
            <div className="bp-cell">Calo mục tiêu (ước tính)</div>
            <div className="bp-cell bp-cell-end">
              {typeof p.calorieTarget === "number"
                ? `${Math.round(p.calorieTarget)} kcal`
                : typeof p.tdee === "number"
                ? `${Math.round(p.tdee)} kcal`
                : "—"}
            </div>
          </div>
          <div className="bp-row-goal">
            <div className="bp-cell">Dự kiến hoàn thành</div>
            <div className="bp-cell bp-cell-end">—</div>
          </div>
        </div>

        <div className="bp-actions-row">
          <button
            type="button"
            className="bp-btn bp-btn-primary"
            onClick={openNewGoal}
          >
            Thiết lập mục tiêu mới
          </button>
        </div>
      </section>

      {/* ===== Hình ảnh tiến độ ===== */}
      <section className="bp-section">
        <h2 className="bp-title-sub">Hình ảnh tiến độ</h2>

        <div className="bp-progress-header">
          <div className="bp-tabs">
            {PHOTO_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`bp-tab ${photoTab === t.id ? "active" : ""}`}
                onClick={() => setPhotoTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button type="button" className="bp-add-btn">
            + Thêm ảnh
          </button>
        </div>

        <div className="bp-progress-grid">
          <div className="bp-progress-empty">
            Chưa có ảnh tiến độ cho tab "{PHOTO_TABS.find((x) => x.id === photoTab)?.label}".
          </div>
        </div>
      </section>

      {/* ===== Hủy / Lưu thay đổi ===== */}
      <div className="bp-actions">
        <button
          type="button"
          className="bp-btn bp-btn-outline"
          onClick={onCancel}
          disabled={!dirty || saving}
        >
          Hủy
        </button>
        <button
          type="button"
          className="bp-btn bp-btn-primary"
          onClick={onSave}
          disabled={!dirty || saving}
        >
          {saving ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
      </div>

      {/* ===== Modal thiết lập mục tiêu mới ===== */}
      {showNewGoal && (
        <div className="bp-modal">
          <div
            className="bp-modal-backdrop"
            onClick={() => !creatingGoal && setShowNewGoal(false)}
          />
          <div className="bp-modal-card">
            <h3 className="bp-modal-title">Thiết lập mục tiêu mới</h3>

            <div className="bp-modal-grid">
              <label>
                Chiều cao (cm)
                <input
                  value={goalForm.chieuCao}
                  onChange={(e) =>
                    setGoalForm((g) => ({
                      ...g,
                      chieuCao: e.target.value,
                    }))
                  }
                  placeholder="170"
                />
              </label>
              <label>
                Cân nặng hiện tại (kg)
                <input
                  value={goalForm.canNangHienTai}
                  onChange={(e) =>
                    setGoalForm((g) => ({
                      ...g,
                      canNangHienTai: e.target.value,
                    }))
                  }
                  placeholder="65"
                />
              </label>
              <label>
                Cân nặng mục tiêu (kg)
                <input
                  value={goalForm.canNangMongMuon}
                  onChange={(e) =>
                    setGoalForm((g) => ({
                      ...g,
                      canNangMongMuon: e.target.value,
                    }))
                  }
                  placeholder="58"
                />
              </label>

              <label>
                Mục tiêu
                <select
                  value={goalForm.mucTieu}
                  onChange={(e) =>
                    setGoalForm((g) => ({
                      ...g,
                      mucTieu: e.target.value,
                    }))
                  }
                >
                  <option value="">— chọn —</option>
                  <option value="giam_can">Giảm cân</option>
                  <option value="giam_mo">Giảm mỡ</option>
                  <option value="duy_tri">Duy trì</option>
                  <option value="tang_can">Tăng cân</option>
                  <option value="tang_co">Tăng cơ</option>
                </select>
              </label>

              <label>
                Mục tiêu tuần (kg/tuần)
                <input
                  value={goalForm.mucTieuTuan}
                  onChange={(e) =>
                    setGoalForm((g) => ({
                      ...g,
                      mucTieuTuan: e.target.value,
                    }))
                  }
                  placeholder="0.5"
                />
              </label>

              <label>
                Cường độ luyện tập
                <select
                  value={goalForm.cuongDoLuyenTap}
                  onChange={(e) =>
                    setGoalForm((g) => ({
                      ...g,
                      cuongDoLuyenTap: e.target.value,
                    }))
                  }
                >
                  <option value="">— chọn —</option>
                  <option value="level_1">level_1</option>
                  <option value="level_2">level_2</option>
                  <option value="level_3">level_3</option>
                  <option value="level_4">level_4</option>
                </select>
              </label>

              <label>
                BodyFat (%)
                <input
                  value={goalForm.bodyFat}
                  onChange={(e) =>
                    setGoalForm((g) => ({
                      ...g,
                      bodyFat: e.target.value,
                    }))
                  }
                  placeholder="18"
                />
              </label>
            </div>

            <div className="bp-modal-actions">
              <button
                className="bp-btn bp-btn-outline"
                onClick={() => !creatingGoal && setShowNewGoal(false)}
                disabled={creatingGoal}
              >
                Hủy
              </button>
              <button
                className="bp-btn bp-btn-primary"
                onClick={createNewGoal}
                disabled={creatingGoal}
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
