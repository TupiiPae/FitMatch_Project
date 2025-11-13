// src/pages/Training/ExerciseDetail.jsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getExercise } from "../../api/exercises";
import api from "../../lib/api";
import "./ExerciseDetail.css";
import DOMPurify from "dompurify";

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => { if (!u) return u; try { return new URL(u, API_ORIGIN).toString(); } catch { return u; } };

// Map EN->VI
const TYPE_VI = { Strength: "Kháng lực", Cardio: "Cardio", Sport: "Thể thao" };

// Sanitize helper (giữ format, chặn XSS)
const safeHtml = (html) =>
  DOMPurify.sanitize(String(html || ""), {
    USE_PROFILES: { html: true }, // cho phép thẻ HTML cơ bản (p, h2, h3, ul, ol, li, b, i, u, blockquote, a, ...).
  });

export default function ExerciseDetail() {
  const nav = useNavigate();
  const { id } = useParams();
  const [it, setIt] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setErr("");
        const data = await getExercise(id);
        setIt(data);
      } catch (e) {
        setErr("Không tải được dữ liệu bài tập.");
      }
    })();
  }, [id]);

  if (err) return <div className="exd-wrap"><div className="exd-error">{err}</div></div>;
  if (!it) return <div className="exd-wrap"><div className="exd-loading">Đang tải...</div></div>;

  const typeLabel = TYPE_VI[it.type] || it.type || "—";
  const guideHtml = safeHtml(it.guideHtml);
  const descHtml = safeHtml(it.descriptionHtml);

  return (
    <div className="nm-wrap">
      <div className="nm-head" style={{ justifyContent: "space-between" }}>
        <button type="button" className="tool-left" onClick={() => nav(-1)}>
          <i className="fa-solid fa-chevron-left"></i> Quay lại
        </button>
        <div style={{ fontWeight: 700 }}>Chi tiết bài tập</div>
      </div>

      <div className="nm-list-frame exd-frame">
        <h1 className="exd-title">{it.name}</h1>

        {it.videoUrl && (
          <div className="exd-video">
            <div className="exd-video-box">
              <video
                src={toAbs(it.videoUrl)}
                controls
                preload="metadata"
                playsInline
                style={{ width: "100%", height: "auto", display: "block", borderRadius: 12 }}
              />
            </div>
          </div>
        )}

        <div className="exd-cols">
          {/* Hồ sơ bài tập */}
          <div className="exd-left">
            <div className="exdp-card">
              <div className="exdp-strip" />
              <div className="exdp-head">Tổng quan bài tập</div>
              <table className="exdp-table">
                <tbody>
                  <tr>
                    <th>Nhóm cơ tác động chính</th>
                    <td className="exdp-link">{(it.primaryMuscles || [])[0] || "—"}</td>
                  </tr>
                  <tr>
                    <th>Loại bài tập</th>
                    <td>{typeLabel}</td>
                  </tr>
                  <tr>
                    <th>Dụng cụ yêu cầu</th>
                    <td>{it.equipment || "—"}</td>
                  </tr>
                  <tr>
                    <th>Mức độ bài tập</th>
                    <td>{it.level || "—"}</td>
                  </tr>
                  <tr>
                    <th>Nhóm cơ phụ</th>
                    <td>{(it.secondaryMuscles || []).join(", ") || "—"}</td>
                  </tr>
                  <tr>
                    <th>Giá trị MET</th>
                    <td>{it.caloriePerRep ?? "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Ảnh minh hoạ */}
          <div className="exd-right">
            <div className="exd-img">
              <img src={toAbs(it.imageUrl)} alt={it.name} />
            </div>
          </div>
        </div>
        <div className="exd-cols">
          {guideHtml && (
            <section className="exd-section exd-centered">
              <h2>Hướng dẫn bài tập</h2>
              <div className="exd-html" dangerouslySetInnerHTML={{ __html: guideHtml }} />
            </section>
          )}

          {descHtml && (
            <section className="exd-section exd-centered">
              <h2>Mô tả bài tập</h2>
              <div className="exd-html" dangerouslySetInnerHTML={{ __html: descHtml }} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
