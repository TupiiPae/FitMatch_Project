import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getExercise, listExercises } from "../../api/exercises";
import api from "../../lib/api";
import "./ExerciseDetail.css";
import DOMPurify from "dompurify";

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try {
    return new URL(u, API_ORIGIN).toString();
  } catch {
    return u;
  }
};

const TYPE_VI = {
  Strength: "Sức mạnh (Strength)",
  Cardio: "Cardio",
  Sport: "Thể thao",
};

const safeHtml = (html) =>
  DOMPurify.sanitize(String(html || ""), {
    USE_PROFILES: { html: true },
  });

export default function ExerciseDetail() {
  const nav = useNavigate();
  const { id } = useParams();

  const [it, setIt] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("desc"); // "desc" | "guide"

  // Các bài tập khác (cùng nhóm cơ chính)
  const [similars, setSimilars] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        setErr("");
        const data = await getExercise(id);
        setIt(data);

        // ===== Load các bài tập khác theo nhóm cơ chính =====
        try {
          const primaryList = Array.isArray(data.primaryMuscles)
            ? data.primaryMuscles
            : data.primaryMuscle
            ? [data.primaryMuscle]
            : [];

          if (primaryList.length > 0) {
            const res = await listExercises({
              primary: primaryList[0],
              limit: 5,
              sort: "name",
            });
            const items = Array.isArray(res?.items) ? res.items : [];
            setSimilars(
              items.filter((x) => x._id !== data._id).slice(0, 4)
            );
          } else {
            setSimilars([]);
          }
        } catch (e) {
          console.error("Lỗi tải bài tập khác", e);
          setSimilars([]);
        }
      } catch (e) {
        setErr("Không tải được dữ liệu bài tập.");
      }
    })();
  }, [id]);

  if (err) {
    return (
      <div className="exd-page">
        <div className="exd-inner">
          <div className="exd-state exd-error">{err}</div>
        </div>
      </div>
    );
  }

  if (!it) {
    return (
      <div className="exd-page">
        <div className="exd-inner">
          <div className="exd-state exd-loading">Đang tải...</div>
        </div>
      </div>
    );
  }

  const typeLabel = TYPE_VI[it.type] || it.type || "—";
  const guideHtml = safeHtml(it.guideHtml);
  const descHtml = safeHtml(it.descriptionHtml);

  const primaryMuscles = Array.isArray(it.primaryMuscles)
    ? it.primaryMuscles
    : it.primaryMuscle
    ? [it.primaryMuscle]
    : [];

  const secondaryMuscles = Array.isArray(it.secondaryMuscles)
    ? it.secondaryMuscles
    : it.secondaryMuscle
    ? [it.secondaryMuscle]
    : [];

  const muscleTags = [
    ...primaryMuscles.map((name) => ({ name, kind: "primary" })),
    ...secondaryMuscles.map((name) => ({ name, kind: "secondary" })),
  ];

  const equipmentText = Array.isArray(it.equipment)
    ? it.equipment.join(", ")
    : it.equipment || "Không cần dụng cụ đặc biệt";

  const metValue = it.metValue ?? it.met ?? it.caloriePerRep ?? null;

  const muscleImage =
    it.muscleImageUrl ||
    it.imageMuscleUrl ||
    it.imageUrl ||
    "/images/placeholder-muscle.png";

  const activeHtml = tab === "guide" ? guideHtml : descHtml;
  const hasActiveHtml =
    tab === "guide" ? !!it.guideHtml : !!it.descriptionHtml;

  return (
    <div className="exd-page">
      <div className="exd-inner">
        {/* Nút quay lại */}
        <button
          type="button"
          className="exd-back"
          onClick={() => nav(-1)}
        >
          <i className="fa-solid fa-arrow-left-long"></i>
          <span>Quay lại</span>
        </button>

        {/* Layout 2/3 - 1/3 */}
        <div className="exd-layout">
          {/* ===== 2/3 BÊN TRÁI ===== */}
          <div className="exd-left">
            {/* Video / Ảnh hero */}
            {it.videoUrl ? (
              <div className="exd-video-wrap">
                <div className="exd-video-box">
                  <video
                    src={toAbs(it.videoUrl)}
                    controls
                    preload="metadata"
                    playsInline
                  />
                </div>
              </div>
            ) : (
              <div className="exd-video-wrap">
                <div className="exd-video-box">
                  <img
                    src={toAbs(it.imageUrl)}
                    alt={it.name}
                    className="exd-video-fallback"
                  />
                </div>
              </div>
            )}

            {/* Tên bài tập */}
            <div className="exd-title">{it.name}</div>

            {/* Hashtag nhóm cơ */}
            {muscleTags.length > 0 && (
              <div className="exd-tags">
                {muscleTags.map((m, idx) => (
                  <span
                    key={`${m.kind}-${m.name}-${idx}`}
                    className={`exd-tag ${
                      m.kind === "primary"
                        ? "exd-tag-main"
                        : "exd-tag-sub"
                    }`}
                  >
                    #{m.name}
                  </span>
                ))}
              </div>
            )}

            {/* Tabs Mô tả / Hướng dẫn */}
            <div className="exd-tabs">
              <button
                type="button"
                className={`exd-tab ${tab === "desc" ? "active" : ""}`}
                onClick={() => setTab("desc")}
              >
                Mô tả
              </button>
              <button
                type="button"
                className={`exd-tab ${
                  tab === "guide" ? "active" : ""
                }`}
                onClick={() => setTab("guide")}
              >
                Hướng dẫn
              </button>
            </div>

            {/* Nội dung tab — KHÔNG còn box bọc, chỉ text */}
            <div className="exd-tab-panel">
              {hasActiveHtml ? (
                <div
                  className="exd-html"
                  dangerouslySetInnerHTML={{ __html: activeHtml }}
                />
              ) : (
                <p className="exd-empty">
                  Chưa có nội dung cho mục này. Vui lòng xem tab còn
                  lại.
                </p>
              )}
            </div>

            {/* Nhóm cơ tác động */}
            <section className="exd-muscle-card">
              <h2 className="exd-muscle-title">Nhóm cơ tác động</h2>

              <div className="exd-muscle-body">
                <div className="exd-muscle-left">
                  <div className="exd-muscle-img-frame">
                    <img
                      src={toAbs(muscleImage)}
                      alt="Nhóm cơ tác động"
                    />
                  </div>
                </div>

                <div className="exd-muscle-right">
                  <div className="exd-muscle-lines">
                    <div className="exd-muscle-line">
                      <span className="exd-dot exd-dot-main" />
                      <div className="exd-muscle-text">
                        <div className="exd-muscle-label-primary">Nhóm chính: <span>{primaryMuscles.length? primaryMuscles.join(", ") : "—"}</span></div>
                      </div>
                    </div>

                    <div className="exd-muscle-line">
                      <span className="exd-dot exd-dot-sub" />
                      <div className="exd-muscle-text">
                        <div className="exd-muscle-label">Nhóm phụ: {secondaryMuscles.length? secondaryMuscles.join(", ") : "—"} </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* ===== 1/3 BÊN PHẢI ===== */}
          <aside className="exd-right">
            {/* Box Tổng quan */}
            <section className="exd-summary-card">
              <h3 className="exd-summary-title">Tổng quan bài tập</h3>
              <p className="exd-summary-sub">
                Dụng cụ cần thiết: <span>{equipmentText}</span>
              </p>

              <ul className="exd-summary-list">
                <li className="exd-summary-item">
                  <div className="exd-summary-icon type">
                    <i className="fa-solid fa-dumbbell" />
                  </div>
                  <div className="exd-summary-text">
                    <div className="label">Phân loại</div>
                    <div className="value">{typeLabel}</div>
                  </div>
                </li>

                <li className="exd-summary-item">
                  <div className="exd-summary-icon level">
                    <i className="fa-solid fa-signal" />
                  </div>
                  <div className="exd-summary-text">
                    <div className="label">Mức độ</div>
                    <div className="value">{it.level || "—"}</div>
                  </div>
                </li>

                <li className="exd-summary-item">
                  <div className="exd-summary-icon equip">
                    <i className="fa-solid fa-toolbox" />
                  </div>
                  <div className="exd-summary-text">
                    <div className="label">Dụng cụ</div>
                    <div className="value">{equipmentText}</div>
                  </div>
                </li>

                <li className="exd-summary-item">
                  <div className="exd-summary-icon met">
                    <i className="fa-solid fa-fire-flame-simple" />
                  </div>
                  <div className="exd-summary-text">
                    <div className="label">Giá trị MET</div>
                    <div className="value">
                      {metValue != null ? metValue : "—"}
                    </div>
                  </div>
                </li>
              </ul>
            </section>

            {/* Box Các bài tập khác */}
            <section className="exd-related">
              <h3 className="exd-summary-title">Các bài tập khác</h3>
              {similars.length > 0 ? (
                <div className="exd-related-list">
                  {similars.map((ex) => (
                    <button
                      key={ex._id}
                      type="button"
                      className="exd-related-item"
                      onClick={() =>
                        nav(`/tap-luyen/bai-tap/chi-tiet/${ex._id}`)
                      }
                    >
                      <div className="exd-related-thumb">
                        <img
                          src={toAbs(ex.imageUrl)}
                          alt={ex.name}
                        />
                      </div>
                      <div className="exd-related-meta">
                        <div className="title">{ex.name}</div>
                        <div className="sub">
                          {Array.isArray(ex.primaryMuscles) &&
                            ex.primaryMuscles[0] && (
                              <span>#{ex.primaryMuscles[0]}</span>
                            )}
                        </div>
                      </div>
                      <div className="exd-related-arrow">
                        <i className="fa-solid fa-chevron-right" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="exd-related-empty">
                  Chưa có bài tập khác phù hợp.
                </p>
              )}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
