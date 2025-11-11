// user-app/src/pages/Training/WorkoutCreate.jsx
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./WorkoutCreate.css";
import { toast } from "react-toastify";
import api from "../../lib/api";
import ExercisePicker from "./components/ExercisePicker"; // popup chọn bài tập (Strength + Cardio)

/** Một set trong bài tập */
function makeEmptySet() {
  return { kg: "", reps: "", restSec: "" };
}

/** Một box bài tập trong lịch */
function makeEmptyBlock() {
  return {
    exercise: null, // { _id, name, type, imageUrl, ... }
    sets: [makeEmptySet()],
  };
}

export default function WorkoutCreate() {
  const nav = useNavigate();

  const [name, setName] = useState("");
  const [blocks, setBlocks] = useState([makeEmptyBlock()]);

  // picker
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTargetIndex, setPickerTargetIndex] = useState(-1);

  // menu 3 chấm của từng box
  const [menuIdx, setMenuIdx] = useState(-1);

  // ===== tính tổng =====
  const totals = useMemo(() => {
    const exCount = blocks.filter(b => !!b.exercise).length;
    const setCount = blocks.reduce((s, b) => s + (b.exercise ? b.sets.length : 0), 0);
    const repCount = blocks.reduce((sum, b) => {
      if (!b.exercise) return sum;
      return sum + b.sets.reduce((s2, st) => s2 + (Number(st.reps || 0) || 0), 0);
    }, 0);
    return { exCount, setCount, repCount };
  }, [blocks]);

  // ===== helpers mutate =====
  const addBlock = () => setBlocks(prev => [...prev, makeEmptyBlock()]);

  const removeBlock = (idx) => {
    setBlocks(prev => prev.filter((_, i) => i !== idx));
    setMenuIdx(-1);
  };

  const openPickerFor = (idx) => {
    setPickerTargetIndex(idx);
    setPickerOpen(true);
    setMenuIdx(-1);
  };

  const onPickedExercise = (ex) => {
    if (pickerTargetIndex < 0) return setPickerOpen(false);
    setBlocks(prev => {
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
    setBlocks(prev => {
      const next = [...prev];
      const b = { ...next[idx] };
      b.sets = [...b.sets, makeEmptySet()];
      next[idx] = b;
      return next;
    });
  };

  const changeSetField = (blockIdx, setIdx, key, val) => {
    setBlocks(prev => {
      const next = [...prev];
      const b = { ...next[blockIdx] };
      const sets = [...b.sets];
      const st = { ...sets[setIdx], [key]: val };
      sets[setIdx] = st;
      b.sets = sets;
      next[blockIdx] = b;
      return next;
    });
  };

  const removeSet = (blockIdx, setIdx) => {
    setBlocks(prev => {
      const next = [...prev];
      const b = { ...next[blockIdx] };
      if (b.sets.length <= 1) return prev;
      b.sets = b.sets.filter((_, i) => i !== setIdx);
      next[blockIdx] = b;
      return next;
    });
  };

  // ===== submit =====
  const buildPayload = () => {
    const items = blocks
      .filter(b => !!b.exercise)
      .map(b => ({
        exerciseId: b.exercise._id,
        name: b.exercise.name,
        type: b.exercise.type,
        sets: b.sets.map(s => ({
          kg: s.kg === "" ? null : Number(s.kg),
          reps: s.reps === "" ? null : Number(s.reps),
          restSec: s.restSec === "" ? null : Number(s.restSec),
        })),
      }));

    return {
      name: name.trim(),
      items,
      totals,
    };
  };

  const validate = () => {
    if (!name.trim()) {
      toast.error("Vui lòng nhập tên lịch tập");
      return false;
    }
    const haveExercise = blocks.some(b => !!b.exercise);
    if (!haveExercise) {
      toast.error("Vui lòng chọn ít nhất 1 bài tập");
      return false;
    }
    return true;
  };

  const onCreate = async () => {
    if (!validate()) return;
    const payload = buildPayload();
    try {
      // API dự kiến: POST /api/user/workouts
      await api.post("/api/user/workouts", payload);
      toast.success("Tạo lịch tập thành công");
      nav("/tap-luyen/lich-cua-ban");
    } catch (err) {
      // Nếu BE chưa có endpoint, báo rõ
      const msg =
        err?.response?.data?.message ||
        "Không thể lưu lịch tập. Có thể API chưa được triển khai (/api/user/workouts).";
      toast.error(msg);
      console.error("[WorkoutCreate] save error:", err);
    }
  };

  return (
    <div className="wc-wrap">
      {/* ===== HEAD ===== */}
      <div className="wc-head" onClick={() => setMenuIdx(-1)}>
        <button className="back" onClick={() => nav(-1)} aria-label="Quay lại">
          <i className="fa-solid fa-arrow-left" />
        </button>
        <div className="title">Xây dựng lịch tập</div>
        <button className="create" onClick={onCreate}>Tạo lịch</button>
      </div>

      {/* ===== FRAME ===== */}
      <div className="wc-frame">
        {/* Card: Tên & tổng quan */}
        <div className="wc-card">
          <label className="wc-title-label">Tên lịch tập</label>
          <input
            className="wc-title-input"
            placeholder="Nhập tên lịch tập"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <div className="wc-metrics">
            <div className="wc-metric">
              <div className="m-label">Tổng số bài</div>
              <div className="m-val">{totals.exCount}</div>
            </div>
            <div className="wc-metric">
              <div className="m-label">Tổng số set</div>
              <div className="m-val">{totals.setCount}</div>
            </div>
            <div className="wc-metric">
              <div className="m-label">Tổng số reps</div>
              <div className="m-val">{totals.repCount}</div>
            </div>
          </div>

          <hr className="wc-sep" />

          {/* Danh sách box bài tập */}
          <div className="wc-exlist">
            {blocks.map((b, idx) => (
              <div key={idx}>
                {!b.exercise ? (
                  <div className="wc-expick">
                    <div className="label">Chọn bài tập</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="pick-btn" onClick={() => openPickerFor(idx)}>
                        Chọn bài tập
                      </button>
                      <button
                        className="more-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuIdx(menuIdx === idx ? -1 : idx);
                        }}
                        aria-label="Thêm tùy chọn"
                      >
                        <i className="fa-solid fa-ellipsis-vertical" />
                      </button>
                      {menuIdx === idx && (
                        <div className="menu" onClick={(e) => e.stopPropagation()}>
                          <button className="menu-item danger" onClick={() => removeBlock(idx)}>
                            Xóa
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="wc-exbox" onClick={() => setMenuIdx(-1)}>
                    <div className="ex-head">
                      <div className="ex-name">{b.exercise.name}</div>
                      <div className="ex-actions">
                        <div className="more-wrap">
                          <button
                            className="more-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuIdx(menuIdx === idx ? -1 : idx);
                            }}
                            aria-label="Mở menu"
                          >
                            <i className="fa-solid fa-ellipsis-vertical" />
                          </button>
                          {menuIdx === idx && (
                            <div className="menu" onClick={(e) => e.stopPropagation()}>
                              <button className="menu-item" onClick={() => changeExercise(idx)}>
                                Thay đổi bài tập
                              </button>
                              <button className="menu-item danger" onClick={() => removeBlock(idx)}>
                                Xóa
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <table className="wc-sets">
                      <thead>
                        <tr>
                          <th>Set</th>
                          <th>Kg</th>
                          <th>Reps</th>
                          <th>Nghỉ (s)</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.sets.map((st, si) => (
                          <tr key={si}>
                            <td className="set-no">{si + 1}.</td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                placeholder="Kg"
                                value={st.kg}
                                onChange={(e) => changeSetField(idx, si, "kg", e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                placeholder="Reps"
                                value={st.reps}
                                onChange={(e) => changeSetField(idx, si, "reps", e.target.value)}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                min="0"
                                placeholder="Giây"
                                value={st.restSec}
                                onChange={(e) => changeSetField(idx, si, "restSec", e.target.value)}
                              />
                            </td>
                            <td>
                              {b.sets.length > 1 && (
                                <button
                                  className="more-btn"
                                  title="Xóa set"
                                  onClick={() => removeSet(idx, si)}
                                >
                                  <i className="fa-regular fa-trash-can" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="wc-addset">
                      <button onClick={() => addSet(idx)}>+ Thêm Set</button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="wc-add-box">
              <button className="round" onClick={addBlock} title="Thêm bài tập">
                <i className="fa-solid fa-plus" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Exercise Picker (popup) ===== */}
      {pickerOpen && (
        <ExercisePicker
          types={["Strength", "Cardio"]}
          onClose={() => setPickerOpen(false)}
          onSelect={onPickedExercise}
        />
      )}
    </div>
  );
}
