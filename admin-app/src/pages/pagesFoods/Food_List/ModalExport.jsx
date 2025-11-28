import React from "react";

export default function ModalExport({ open, onClose, items, type, onExport }) {
  if (!open) return null;

  const fmtType =
    type === "csv"
      ? "CSV (.csv)"
      : type === "xlsx"
      ? "Excel (.xlsx)"
      : "";

  return (
    <div
      className="exp-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="exp-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exp-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="exp-head">
          <h3 id="exp-title" className="exp-title">
            Xác nhận xuất danh sách món ăn
          </h3>
          <button
            type="button"
            className="exp-close"
            onClick={onClose}
            aria-label="Đóng"
          >
            ✕
          </button>
        </div>

        <div className="exp-body">
          <p className="exp-info">
            Đang chuẩn bị xuất{" "}
            <strong>{items.length}</strong> món ăn ở định dạng{" "}
            <strong>{fmtType}</strong>.
          </p>

          <div className="exp-table-wrap">
            <table className="exp-table">
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Hình ảnh (URL)</th>
                  <th>Tên</th>
                  <th>Khẩu phần</th>
                  <th>Khối lượng</th>
                  <th>Calorie</th>
                  <th>Đạm</th>
                  <th>Đường bột</th>
                  <th>Chất béo</th>
                  <th>Muối</th>
                  <th>Đường</th>
                  <th>Chất xơ</th>
                </tr>
              </thead>
              <tbody>
                {items.map((x, idx) => {
                  const img = x.imageUrl || "";
                  const portion =
                    x.portionName ||
                    x.servingDesc ||
                    x.serving ||
                    x.portion ||
                    "";
                  const mass =
                    x.massG != null ? `${x.massG} ${x.unit || "g"}` : x.unit || "";
                  return (
                    <tr key={x._id || idx}>
                      <td>{idx + 1}</td>
                      <td className="exp-cell-url">{img}</td>
                      <td>{x.name || ""}</td>
                      <td>{portion}</td>
                      <td>{mass}</td>
                      <td>{x.kcal ?? ""}</td>
                      <td>{x.proteinG ?? ""}</td>
                      <td>{x.carbG ?? ""}</td>
                      <td>{x.fatG ?? ""}</td>
                      <td>{x.saltG ?? ""}</td>
                      <td>{x.sugarG ?? ""}</td>
                      <td>{x.fiberG ?? ""}</td>
                    </tr>
                  );
                })}
                {!items.length && (
                  <tr>
                    <td colSpan={12} style={{ textAlign: "center", padding: 12 }}>
                      Không có dữ liệu để xuất.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="exp-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            Hủy
          </button>
          <button type="button" className="btn primary" onClick={onExport}>
            Xuất danh sách
          </button>
        </div>
      </div>
    </div>
  );
}
