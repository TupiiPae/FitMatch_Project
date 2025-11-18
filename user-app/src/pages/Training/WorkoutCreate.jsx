// user-app/src/pages/Workout/WorkoutCreate.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import "./WorkoutCreate.css";
import { toast } from "react-toastify";
import api from "../../lib/api";
import ExercisePicker from "./components/ExercisePicker";

/** Một set trong bài tập */
function makeEmptySet() { return { kg: "", reps: "", restSec: "" }; }
/** Một box bài tập trong lịch */
function makeEmptyBlock() { return { exercise: null, sets: [makeEmptySet()] }; }

/* ================== Helpers FE (mirror công thức ở health.js) ================== */
const sumReps = (sets) =>
  Array.isArray(sets) ? sets.reduce((s, st) => s + (Number(st?.reps || 0) || 0), 0) : 0;
const countSets = (sets) => (Array.isArray(sets) ? sets.length : 0);
const blockMinutes = (block) => {
  const reps = sumReps(block?.sets);
  const sets = countSets(block?.sets);
  const workSec = reps * 3;
  const restSec = Math.max(0, sets - 1) * 60;
  return (workSec + restSec) / 60;
};
const kcalByMET = (caloriePerRep, weightKg, minutes) => {
  const m = Math.max(0, Number(caloriePerRep || 0));
  const w = Number(weightKg || 0);
  const t = Math.max(0, Number(minutes || 0));
  if (!w) return 0;
  return (m * 3.5 * w * t) / 200;
};

export default function WorkoutCreate() {
  const nav = useNavigate();
  const loc = useLocation();
  const params = useParams();

  // detect edit mode: ưu tiên query ?id=..., fallback /:id
  const query = new URLSearchParams(loc.search);
  const editingId = query.get("id") || params.id || null;

  const [name, setName] = useState("");
  const [note, setNote] = useState("");                 // <— ghi chú (mới)
  const [blocks, setBlocks] = useState([makeEmptyBlock()]);
  const [weightKg, setWeightKg] = useState(null);

  // picker/menu
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTargetIndex, setPickerTargetIndex] = useState(-1);
  const [menuIdx, setMenuIdx] = useState(-1);

  // load cân nặng hiện tại
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/user/me");
        const w = res?.data?.user?.profile?.weightKg ?? res?.data?.profile?.weightKg ?? null;
        setWeightKg(Number(w) || 60);
      } catch {
        setWeightKg(60);
      }
    })();
  }, []);

  // nếu edit: load plan
  useEffect(() => {
    if (!editingId) return;
    (async () => {
      try {
        const r = await api.get(`/user/workouts/${editingId}`);
        const plan = r?.data?.data || r?.data || {};
        setName(plan?.name || "");
        setNote(plan?.note || "");                       // <— load ghi chú
        const mapped = (plan?.items || []).map(it => ({
          exercise: {
            _id: it.exercise,
            name: it.exerciseName,
            type: it.type,
            caloriePerRep: it.caloriePerRep ?? 0,
            imageUrl: it.imageUrl || "",
          },
          sets: (it.sets || []).map(s => ({
            kg: s.kg ?? "",
            reps: s.reps ?? "",
            restSec: s.restSec ?? "",
          })),
        }));
        setBlocks(mapped.length ? mapped : [makeEmptyBlock()]);
      } catch (e) {
        toast.error("Không tải được lịch tập cần chỉnh sửa");
      }
    })();
  }, [editingId]);

  // totals
  const totals = useMemo(() => {
    const exCount = blocks.filter((b) => !!b.exercise).length;
    const setCount = blocks.reduce((s, b) => s + (b.exercise ? (b.sets?.length || 0) : 0), 0);
    const repCount = blocks.reduce((sum, b) => (!b.exercise ? sum : (sum + sumReps(b.sets))), 0);
    return { exCount, setCount, repCount };
  }, [blocks]);

  // total kcal (theo thời gian)
  const totalKcal = useMemo(() => {
    if (!weightKg) return 0;
    let total = 0;
    for (const b of blocks) {
      if (!b.exercise) continue;
      total += kcalByMET(b.exercise?.caloriePerRep, weightKg, blockMinutes(b));
    }
    return Math.round(total);
  }, [blocks, weightKg]);

  // mutate
  const addBlock = () => setBlocks((prev) => [...prev, makeEmptyBlock()]);
  const removeBlock = (idx) => { setBlocks((prev) => prev.filter((_, i) => i !== idx)); setMenuIdx(-1); };
  const openPickerFor = (idx) => { setPickerTargetIndex(idx); setPickerOpen(true); setMenuIdx(-1); };
  const onPickedExercise = (ex) => {
    if (pickerTargetIndex < 0) return setPickerOpen(false);
    setBlocks((prev) => {
      const next = [...prev];
      const b = { ...next[pickerTargetIndex] };
      b.exercise = ex;
      if (!b.sets || b.sets.length === 0) b.sets = [makeEmptySet()];
      next[pickerTargetIndex] = b;
      return next;
    });
    setPickerOpen(false);
  };
  const changeExercise = (idx) => openPickerFor(idx);
  const addSet = (idx) => {
    setBlocks((prev) => {
      const next = [...prev];
      const b = { ...next[idx] };
      b.sets = [...b.sets, makeEmptySet()];
      next[idx] = b; return next;
    });
  };
  const changeSetField = (blockIdx, setIdx, key, val) => {
    setBlocks((prev) => {
      const next = [...prev];
      const b = { ...next[blockIdx] };
      const sets = [...b.sets];
      const st = { ...sets[setIdx], [key]: val };
      sets[setIdx] = st; b.sets = sets; next[blockIdx] = b;
      return next;
    });
  };
  const removeSet = (blockIdx, setIdx) => {
    setBlocks((prev) => {
      const next = [...prev];
      const b = { ...next[blockIdx] };
      if (b.sets.length <= 1) return prev;
      b.sets = b.sets.filter((_, i) => i !== setIdx);
      next[blockIdx] = b; return next;
    });
  };

  // payload
  const buildPayload = () => {
    const items = blocks
      .filter((b) => !!b.exercise)
      .map((b) => ({
        exercise: b.exercise._id,
        sets: b.sets.map((s) => ({
          kg: s.kg === "" ? null : Number(s.kg),
          reps: s.reps === "" ? null : Number(s.reps),
          restSec: s.restSec === "" ? null : Number(s.restSec),
        })),
      }));
    return { name: name.trim(), note: note.trim(), items }; 
  };

  const validate = () => {
    if (!name.trim()) { toast.error("Vui lòng nhập tên lịch tập"); return false; }
    if (!blocks.some((b) => !!b.exercise)) { toast.error("Vui lòng chọn ít nhất 1 bài tập"); return false; }
    return true;
  };

  const onSave = async () => {
    if (!validate()) return;
    const payload = buildPayload();
    try {
      if (editingId) {
        await api.patch(`/user/workouts/${editingId}`, payload);
        toast.success("Cập nhật lịch tập thành công");
      } else {
        await api.post("/user/workouts", payload);
        toast.success("Tạo lịch tập thành công");
      }
      nav("/tap-luyen/lich-cua-ban");
    } catch (err) {
      const msg = err?.response?.data?.message || (editingId ? "Không thể cập nhật lịch tập." : "Không thể lưu lịch tập.");
      toast.error(msg);
      console.error("[WorkoutCreate] save error:", err);
    }
  };

  const nf = new Intl.NumberFormat("vi-VN");

  return (
    <div className="wc-wrap" onClick={() => setMenuIdx(-1)}>
      {/* ===== HEAD ===== */}
      <div className="wc-head" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="wc-tool-left" onClick={() => nav(-1)}>
          <i className="fa-solid fa-chevron-left"></i> Quay lại
        </button>
        <div className="title">{editingId ? "Chỉnh sửa lịch tập" : "Xây dựng lịch tập"}</div>
        <button className="create" onClick={onSave}>{editingId ? "Cập nhật" : "Tạo lịch"}</button>
      </div>
      <hr className="wc-line" />
      <div className="wc-frame" onClick={(e) => e.stopPropagation()}>
        {/* TOP: 1/3 – 2/3 */}
        <div className="wc-top">
          {/* LEFT */}
          <div className="wc-top-left">
            <h3 className="ff-section-title">Lịch tập</h3>

            <label className="wc-title-label">Tên lịch tập <span className="req">*</span></label>
            <input
              className="wc-title-input"
              placeholder="Nhập tên lịch tập"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            {/* === Ghi chú lịch tập (mới) === */}
            <label className="wc-title-label" style={{ marginTop: 12 }}>Ghi chú lịch tập</label>
            <textarea
              className="wc-title-input wc-note-input"
              placeholder="Ví dụ: Lịch này cho ngày Pull, ưu tiên kỹ thuật – Tempo 3-1-1"
              rows={5}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          {/* RIGHT */}
          <div className="wc-top-right">
            <h3 className="ff-section-title">Tổng quan lịch tập</h3>
            <div className="wc-overview">
              <div className="ov-head ov-center">
                <div className="ov-head">
                  <div className="ov-icon"><i className="fa-solid fa-fire-flame-curved" /></div>
                  <div className="ov-kcal"> {nf.format(totalKcal)} kcal</div>
                </div>
                <div className="ov-sub">Tổng lượng calorie đốt</div>
              </div>
              <div className="ov-sep" />

              <div className="ov-metrics">
                <div className="ov-col">
                  <div className="ov-num">{totals.exCount}</div>
                  <div className="ov-lab">Tổng số bài tập</div>
                </div>
                <div className="ov-col">
                  <div className="ov-num">{totals.setCount}</div>
                  <div className="ov-lab">Tổng số hiệp</div>
                </div>
                <div className="ov-col">
                  <div className="ov-num">{totals.repCount}</div>
                  <div className="ov-lab">Tổng số reps</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM */}
      <div className="wc-frame" onClick={(e) => e.stopPropagation()}>
        <div className="wc-bottom">
          <h3 className="ff-section-title">Bài tập</h3>

          <div className="wc-exlist">
            {blocks.map((b, idx) => (
              <div key={idx} className="wc-block">
                <div className="wc-box-title ff-section-title sm">Bài tập {idx + 1}</div>

                {!b.exercise ? (
                  <div className="wc-expick">
                    <div className="exp-left">
                      <button type="button" className="wc-select" onClick={() => openPickerFor(idx)}>
                        Chọn bài tập <i className="fa-regular fa-square-plus"></i>
                      </button>
                    </div>

                    <div className="more-wrap">
                      <button type="button" className="more-btn"
                        onClick={(e) => { e.stopPropagation(); setMenuIdx(menuIdx === idx ? -1 : idx); }}
                        aria-label="Thêm tùy chọn">
                        <i className="fa-solid fa-ellipsis-vertical" />
                      </button>
                      {menuIdx === idx && (
                        <div className="menu" onClick={(e) => e.stopPropagation()}>
                          <button className="menu-item danger" onClick={() => removeBlock(idx)}>Xóa</button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="wc-exbox">
                    <div className="ex-head">
                      <div className="ex-name">{b.exercise.name}</div>
                      <div className="ex-actions">
                        <div className="more-wrap">
                          <button type="button" className="more-btn"
                            onClick={(e) => { e.stopPropagation(); setMenuIdx(menuIdx === idx ? -1 : idx); }}
                            aria-label="Mở menu">
                            <i className="fa-solid fa-ellipsis-vertical" />
                          </button>
                          {menuIdx === idx && (
                            <div className="menu" onClick={(e) => e.stopPropagation()}>
                              <button className="menu-item" onClick={() => changeExercise(idx)}>Thay đổi bài tập</button>
                              <button className="menu-item danger" onClick={() => removeBlock(idx)}>Xóa</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <table className="wc-sets">
                      <thead>
                        <tr>
                          <th>Hiệp <span>(Set)</span></th>
                          <th>Mức tạ <span>(Kg)</span></th>
                          <th>Số lần <span>(Reps)</span></th>
                          <th>Nghỉ <span>(s)</span></th>
                          <th></th>
                        </tr>
                      </thead>

                      <tbody>
                        {b.sets.map((st, si) => (
                          <tr key={si}>
                            <td className="set-no">{si + 1}.</td>
                            <td>
                              <input type="number" min="0" placeholder="Kg" value={st.kg}
                                onChange={(e) => changeSetField(idx, si, "kg", e.target.value)} />
                            </td>
                            <td>
                              <input type="number" min="0" placeholder="Reps" value={st.reps}
                                onChange={(e) => changeSetField(idx, si, "reps", e.target.value)} />
                            </td>
                            <td>
                              <input type="number" min="0" placeholder="Giây" value={st.restSec}
                                onChange={(e) => changeSetField(idx, si, "restSec", e.target.value)} />
                            </td>
                            <td>
                              {b.sets.length > 1 && (
                                <button type="button" className="more-btn icon-del" title="Xóa set"
                                  onClick={() => removeSet(idx, si)}>
                                  <i className="fa-regular fa-trash-can" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="wc-addrow">
                      <button type="button" onClick={() => addSet(idx)}>+ Thêm Set</button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="wc-addbox">
              <button className="wc-addset" onClick={addBlock} title="Thêm bài tập">
                <i className="fa-solid fa-plus" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {pickerOpen && (
        <div className="wc-picker-overlay" onClick={() => setPickerOpen(false)} role="dialog" aria-modal="true">
          <div className="wc-picker-dialog" onClick={(e) => e.stopPropagation()}>
            <ExercisePicker
              types={["Strength", "Cardio"]}
              onClose={() => setPickerOpen(false)}
              onSelect={onPickedExercise}
            />
          </div>
        </div>
      )}
    </div>
  );
}
