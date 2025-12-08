// user-app/src/pages/Account/Profile/BodyProfile.jsx
import React, { useEffect, useState, useMemo } from "react";
import dayjs from "dayjs";
import api from "../../../lib/api";
import { toast } from "react-toastify";
import "./BodyProfile.css";
import ProgressPhotoModal from "./ProgressPhotoModal";

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

const GOAL_LABELS = {
  giam_can: "Giảm cân",
  duy_tri: "Duy trì",
  tang_can: "Tăng cân",
  giam_mo: "Giảm mỡ",
  tang_co: "Tăng cơ",
};

const INTENSITY_LABELS = {
  level_1: "Không tập luyện, ít vận động",
  level_2: "Vận động nhẹ nhàng",
  level_3: "Chăm chỉ tập luyện",
  level_4: "Rất năng động",
};

export default function BodyProfile() {
  const [user, setUser] = useState(null);
  const [onb, setOnb] = useState(null); // OnboardingProfile (base + goals)
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

  // Modal thêm ảnh tiến độ
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  // Tab hình ảnh tiến độ
  const [photoTab, setPhotoTab] = useState("all");

    // Modal thêm ảnh mới
  const [showCreatePhotoModal, setShowCreatePhotoModal] = useState(false);

  // Modal chỉnh sửa ảnh
  const [editingPhoto, setEditingPhoto] = useState(null);

  // ===== Load user + onboarding cùng lúc =====
  const loadMe = async () => {
    setLoading(true);
    setErr("");
    try {
      const [resUser, resOnb] = await Promise.all([
        api.get("/user/me"),
        api
          .get("/user/onboarding/me")
          .catch((e) => {
            if (e?.response?.status === 404) return null;
            throw e;
          }),
      ]);

      const u = resUser?.data?.user || null;
      setUser(u);
      const p = u?.profile || {};
      setForm({
        heightCm: p.heightCm ?? "",
        weightKg: p.weightKg ?? "",
        bodyFat: p.bodyFat ?? "",
      });

      if (resOnb && resOnb.data?.data) {
        setOnb(resOnb.data.data);
      } else {
        setOnb(null);
      }
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

    if (Object.keys(payload).length === 0) {
      toast.error("Không có thay đổi hợp lệ để lưu.");
      return;
    }

    setSaving(true);
    try {
      const res = await api.patch("/user/account", payload);
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

  // ===== Lấy goal đang active từ OnboardingProfile =====
  const currentGoal = useMemo(() => {
    if (!onb) return null;
    const goals = Array.isArray(onb.goals) ? onb.goals : [];
    let active = goals.find((g) => g.status === "active") || null;
    if (!active && goals.length) {
      active = goals[goals.length - 1];
    }
    if (active) return active;

    const base = onb.base || {};
    if (base && Object.keys(base).length) {
      return { ...base, fromBase: true };
    }
    return null;
  }, [onb]);

  const sexLabel =
    p.sex === "male" ? "Nam" : p.sex === "female" ? "Nữ" : "";

  const age = p.dob ? calcAge(p.dob) : "";

  // ===== Data bảng Mục tiêu cân nặng =====
  const goalType = currentGoal?.mucTieu;
  const goalLabel = goalType ? GOAL_LABELS[goalType] || goalType : "—";
  const goalTargetWeight =
    currentGoal?.canNangMongMuon ??
    currentGoal?.canNangHienTai ??
    null;

  const weeklyChange = currentGoal?.mucTieuTuan;
  const weeklyText =
    typeof weeklyChange === "number"
      ? goalType === "tang_can" || goalType === "tang_co"
        ? `Tăng ${weeklyChange} kg/tuần`
        : `Giảm ${weeklyChange} kg/tuần`
      : "—";

  const intensityKey = currentGoal?.cuongDoLuyenTap || p.trainingIntensity;
  const intensityLabel =
    (intensityKey && INTENSITY_LABELS[intensityKey]) || intensityKey || "—";

  const kcalTargetFromGoal =
    typeof currentGoal?.calorieTarget === "number"
      ? currentGoal.calorieTarget
      : typeof currentGoal?.tdee === "number"
      ? currentGoal.tdee
      : null;

  const kcalText =
    typeof kcalTargetFromGoal === "number"
      ? `${Math.round(kcalTargetFromGoal)} kcal`
      : typeof p.calorieTarget === "number"
      ? `${Math.round(p.calorieTarget)} kcal`
      : typeof p.tdee === "number"
      ? `${Math.round(p.tdee)} kcal`
      : "—";

  const estimatedFinish =
    currentGoal && currentGoal.estimatedFinishAt
      ? dayjs(currentGoal.estimatedFinishAt).format("DD/MM/YYYY")
      : "—";

  // ===== Modal “Thiết lập mục tiêu mới” =====
  const openNewGoal = () => {
    const baseOrGoal = currentGoal || {};
    const prof = user?.profile || {};
    setGoalForm({
      chieuCao: baseOrGoal.chieuCao ?? prof.heightCm ?? "",
      canNangHienTai:
        baseOrGoal.canNangHienTai ?? prof.weightKg ?? "",
      canNangMongMuon:
        baseOrGoal.canNangMongMuon ?? prof.targetWeightKg ?? "",
      mucTieu: baseOrGoal.mucTieu ?? prof.goal ?? "",
      mucTieuTuan: baseOrGoal.mucTieuTuan ?? prof.weeklyChangeKg ?? "",
      cuongDoLuyenTap:
        baseOrGoal.cuongDoLuyenTap ?? prof.trainingIntensity ?? "",
      bodyFat: baseOrGoal.bodyFat ?? prof.bodyFat ?? "",
    });
    setShowNewGoal(true);
  };

  const createNewGoal = async () => {
    const payload = {
      chieuCao:
        goalForm.chieuCao === "" ? undefined : Number(goalForm.chieuCao),
      canNangHienTai:
        goalForm.canNangHienTai === ""
          ? undefined
          : Number(goalForm.canNangHienTai),
      canNangMongMuon:
        goalForm.canNangMongMuon === ""
          ? undefined
          : Number(goalForm.canNangMongMuon),
      mucTieu: goalForm.mucTieu || undefined,
      mucTieuTuan:
        goalForm.mucTieuTuan === ""
          ? undefined
          : Number(goalForm.mucTieuTuan),
      cuongDoLuyenTap: goalForm.cuongDoLuyenTap || undefined,
      bodyFat:
        goalForm.bodyFat === "" ? undefined : Number(goalForm.bodyFat),
    };

    setCreatingGoal(true);
    try {
      await api.post("/user/onboarding/goal", payload);
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

  // ===== Ảnh tiến độ =====
  const progressPhotos = Array.isArray(p.progressPhotos)
    ? p.progressPhotos
    : [];

  const filteredPhotos = useMemo(() => {
    if (!progressPhotos.length) return [];
    const arr =
      photoTab === "all"
        ? progressPhotos
        : progressPhotos.filter((ph) => ph.view === photoTab);
    // sort mới nhất lên trước
    return [...arr].sort((a, b) => {
      const ta = a.takenAt ? new Date(a.takenAt).getTime() : 0;
      const tb = b.takenAt ? new Date(b.takenAt).getTime() : 0;
      return tb - ta;
    });
  }, [progressPhotos, photoTab]);

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

  const initialPhotoTabForModal =
    photoTab === "all" ? "front" : photoTab;

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
              {goalLabel} →{" "}
              {goalTargetWeight != null
                ? `${goalTargetWeight} kg`
                : "xx kg"}
            </div>
          </div>
          <div className="bp-row-goal">
            <div className="bp-cell">Mục tiêu hằng tuần</div>
            <div className="bp-cell bp-cell-end">{weeklyText}</div>
          </div>
          <div className="bp-row-goal">
            <div className="bp-cell">Cường độ vận động</div>
            <div className="bp-cell bp-cell-end">
              {intensityLabel}
            </div>
          </div>
          <div className="bp-row-goal">
            <div className="bp-cell">Calo mục tiêu (ước tính)</div>
            <div className="bp-cell bp-cell-end">{kcalText}</div>
          </div>
          <div className="bp-row-goal">
            <div className="bp-cell">Dự kiến hoàn thành</div>
            <div className="bp-cell bp-cell-end">
              {estimatedFinish}
            </div>
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
                className={`bp-tab ${
                  photoTab === t.id ? "active" : ""
                }`}
                onClick={() => setPhotoTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="bp-add-btn"
            onClick={() => setShowCreatePhotoModal(true)}
          >
            + Thêm ảnh
          </button>
        </div>

        <div className="bp-progress-grid">
          {filteredPhotos.length === 0 ? (
            <div className="bp-progress-empty">
              Chưa có ảnh tiến độ cho "
              {PHOTO_TABS.find((x) => x.id === photoTab)?.label}".
            </div>
          ) : (
            <div className="bp-progress-list">
              {filteredPhotos.map((ph, idx) => (
                <div
                  key={ph._id || ph.url || idx}
                  className="bp-progress-item"
                >
                  <button
                    type="button"
                    className="bp-progress-edit"
                    title="Chỉnh sửa ảnh"
                    onClick={() => setEditingPhoto(ph)}
                  >
                    <i className="fa-solid fa-pencil"></i>
                  </button>

                  <div className="bp-progress-imgwrap">
                    <img
                      src={ph.url}
                      alt="Progress"
                      className="bp-progress-img"
                    />
                  </div>
                  <div className="bp-progress-meta">
                    <div className="bp-progress-meta-left">
                      <span className="bp-progress-view">
                        {ph.view === "front"
                          ? "Mặt trước"
                          : ph.view === "side"
                          ? "Mặt hông"
                          : "Mặt sau"}
                      </span>
                    </div>
                    <span className="bp-progress-date">
                      {ph.takenAt
                        ? dayjs(ph.takenAt).format("DD/MM/YYYY")
                        : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                  <option value="level_1">
                    Không tập luyện, ít vận động
                  </option>
                  <option value="level_2">Vận động nhẹ nhàng</option>
                  <option value="level_3">Chăm chỉ tập luyện</option>
                  <option value="level_4">Rất năng động</option>
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

 {/* Modal thêm ảnh tiến độ */}
      {showCreatePhotoModal && !editingPhoto && (
        <ProgressPhotoModal
          mode="create"
          initialTab={initialPhotoTabForModal}
          onClose={() => setShowCreatePhotoModal(false)}
          onUploaded={async () => {
            await loadMe();
            setShowCreatePhotoModal(false);
          }}
        />
      )}

      {/* Modal chỉnh sửa ảnh tiến độ */}
      {editingPhoto && (
        <ProgressPhotoModal
          mode="edit"
          photo={editingPhoto}
          initialTab={editingPhoto.view}
          onClose={() => setEditingPhoto(null)}
          onUploaded={async () => {
            await loadMe();
            setEditingPhoto(null);
          }}
          onDeleted={async () => {
            await loadMe();
            setEditingPhoto(null);
          }}
        />
      )}
    </div>
  );
}
