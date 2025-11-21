import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import "./SuggestPlanDetail.css";
import {
  getSuggestPlanDetail,
  toggleSaveSuggestPlan,
} from "../../api/suggestPlans";
import { toast } from "react-toastify";
import api from "../../lib/api";

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try {
    return new URL(u, API_ORIGIN).toString();
  } catch {
    return u;
  }
};

function stripHtml(html = "") {
  return String(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function SuggestPlanDetail() {
  const { id } = useParams();
  const nav = useNavigate();

  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const data = await getSuggestPlanDetail(id);
      setPlan(data);
    } catch (err) {
      console.error(err);
      toast.error("Không tải được lịch tập gợi ý");
      nav("/tap-luyen/goi-y");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleToggleSave = async () => {
    if (!plan?._id) return;
    setSaving(true);
    try {
      const res = await toggleSaveSuggestPlan(plan._id);
      const saved = !!res.saved;
      setPlan((prev) => (prev ? { ...prev, saved } : prev));
      toast.success(saved ? "Đã lưu lịch tập" : "Đã bỏ lưu lịch tập");
    } catch (err) {
      console.error(err);
      toast.error("Không thể lưu/bỏ lưu lịch tập");
    } finally {
      setSaving(false);
    }
  };

  // ===== LOADING =====
  if (loading || !plan) {
    return (
      <div className="spd-wrap">
        <div className="spd-inner">
          <button type="button" className="spd-back" onClick={() => nav(-1)}>
            <i className="fa-solid fa-chevron-left" /> <span>Quay lại</span>
          </button>
          <div className="spd-topcard">
            <div className="spd-loading">Đang tải lịch tập gợi ý...</div>
          </div>
        </div>
      </div>
    );
  }

  // ===== DATA READY =====
  const plainDesc = stripHtml(plan.descriptionHtml || "");
  const sessions = plan.sessions || [];
  const sessionsCount =
    plan.sessionsCount != null ? plan.sessionsCount : sessions.length;

  const chips = [
    `Lịch tập ${sessionsCount} buổi tập`,
    plan.category,
    plan.level,
    plan.goal,
  ].filter(Boolean);

  return (
    <div className="spd-wrap">
      <div className="spd-inner">
        {/* HEAD giống ExerciseDetail */}
        <button type="button" className="spd-back" onClick={() => nav(-1)}>
          <i className="fa-solid fa-arrow-left-long"></i><span>Quay lại</span>
        </button>

        {/* ===== FRAME 1 ===== */}
        <div className="spd-topcard">
          <div className="spd-top-main">
            {/* LEFT: tiêu đề + mô tả + chip */}
            <div className="spd-top-left">
              <h1 className="spd-title">
                {/* BỎ phần `${plan.level} -`, chỉ hiển thị tên */}
                {plan.name || "(Không tên)"}
              </h1>

              {!!plainDesc && <p className="spd-desc">{plainDesc}</p>}

              <div className="spd-meta">
                {chips.map((c, idx) => (
                  <span key={idx} className="spd-chip">
                    {c}
                  </span>
                ))}
              </div>
            </div>

            {/* RIGHT: hình minh hoạ */}
            <div className="spd-top-right">
              {plan.imageUrl ? (
                <img src={toAbs(plan.imageUrl)} alt={plan.name} />
              ) : (
                <div className="spd-thumb-fallback">
                  <i className="fa-regular fa-image" />
                </div>
              )}
            </div>
          </div>

          {/* Nút lưu: bottom của frame 1 */}
          <div className="spd-save-row">
            <button
              type="button"
              className={`spd-save-btn ${plan.saved ? "saved" : ""}`}
              onClick={handleToggleSave}
              disabled={saving}
            >
              {plan.saved ? "Đã lưu lịch tập" : "Lưu lịch tập"}
            </button>
          </div>
        </div>

        {/* ===== FRAME 2: Lịch tập ===== */}
        <div className="spd-section">
          <h2 className="spd-section-title">Lịch tập</h2>

          {sessions.map((s, idx) => (
            <div key={idx} className="spd-session">
              <div className="spd-session-name">
                {s.title || `Buổi ${idx + 1}`}
              </div>

              <div className="spd-session-body">
                {/* LEFT: danh sách bài tập */}
                <div className="spd-session-left">
                  {(s.exercises || []).map((ex, i) => (
                    <div key={i} className="spd-exrow">
                      <div className="spd-exavatar">
                        {ex.imageUrl ? (
                          <img src={toAbs(ex.imageUrl)} alt={ex.name} />
                        ) : (
                          <div className="spd-exavatar-fallback">
                            <i className="fa-solid fa-dumbbell" />
                          </div>
                        )}
                      </div>
                      <div className="spd-exmeta">
                        <Link
                          to={`/tap-luyen/bai-tap/chi-tiet/${ex.exerciseId}`}
                          className="spd-exname"
                        >
                          {ex.name}
                        </Link>
                        {ex.repsText && (
                          <div className="spd-exreps">{ex.repsText}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* RIGHT: mô tả buổi */}
                <div className="spd-session-right">
                  {s.description && <p>{s.description}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
