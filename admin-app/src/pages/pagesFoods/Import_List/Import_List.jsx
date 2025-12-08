import React, { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import * as XLSX from "xlsx"; // ensure installed on admin-app
import { api, importFoodsBulk, validateFoodsBulk } from "../../../lib/api";
import "./Import_List.css";
import { downloadFoodTemplateExcel } from "../../../utils/foodTemplateExcel";

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try {
    return new URL(u, API_ORIGIN).toString();
  } catch {
    return u;
  }
};

// Map any header (VN or EN) to internal field
const keyMap = {
  // ===== VN headers (cũ & mới) =====
  "Hình ảnh": "imageUrl",
  "Hình ảnh (URL)": "imageUrl",

  "Tên": "name",
  "Tên món ăn": "name",
  "Tên món ăn *": "name",

  "Khẩu phần": "servingDesc",

  "Khối lượng": "massG",
  "Khối lượng *": "massG",

  "Đơn vị": "unit",
  "Đơn vị *": "unit",

  "Calorie": "kcal",
  "Calorie (kcal)": "kcal",
  "Calorie (kcal) *": "kcal",

  "Đạm": "proteinG",
  "Đạm (g)": "proteinG",

  "Đường bột": "carbG",
  "Đường bột (g)": "carbG",

  "Chất béo": "fatG",
  "Chất béo (g)": "fatG",

  "Muối": "saltG",
  "Muối (g)": "saltG",

  "Đường": "sugarG",
  "Đường (g)": "sugarG",

  "Chất xơ": "fiberG",
  "Chất xơ (g)": "fiberG",

  "Mô tả": "description",

  // ===== EN keys =====
  imageUrl: "imageUrl",
  name: "name",
  servingDesc: "servingDesc",
  massG: "massG",
  unit: "unit",
  kcal: "kcal",
  proteinG: "proteinG",
  carbG: "carbG",
  fatG: "fatG",
  saltG: "saltG",
  sugarG: "sugarG",
  fiberG: "fiberG",
  description: "description",
};

const isNum = (v) =>
  v !== null && v !== undefined && v !== "" && !Number.isNaN(Number(v));
const toNum = (v) => (isNum(v) ? Number(v) : null);
const normUnit = (u) => (String(u || "").toLowerCase() === "ml" ? "ml" : "g");

export default function ImportList() {
  // staged rows shown in table (not yet saved)
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [checking, setChecking] = useState(false);
  const [checkOk, setCheckOk] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]); // danh sách lỗi từ BE
  const [checkedRows, setCheckedRows] = useState([]);

  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);

  const allChecked = rows.length > 0 && selected.length === rows.length;
  const someChecked = selected.length > 0 && selected.length < rows.length;

  // ===== Helper: set file + reset state =====
  const handleFileSelect = (newFile) => {
    if (!newFile) {
      setFile(null);
      setCheckOk(false);
      setValidationErrors([]);
      setCheckedRows([]);
      return;
    }

    const okExt = /\.(csv|xlsx?|xls)$/i.test(newFile.name || "");
    if (!okExt) {
      toast.error("Vui lòng chọn file CSV hoặc Excel (.csv, .xlsx)");
      return;
    }

    setFile(newFile);
    setCheckOk(false);
    setValidationErrors([]);
    setCheckedRows([]);
  };

  // ===== Drag & Drop handlers =====
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) {
      handleFileSelect(f);
    }
  };

  // ===== Parse helpers =====
  function parseCSV(text) {
    // đơn giản, đủ dùng cho template/nhập cơ bản; BE vẫn kiểm tra lại
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (lines.length === 0) return [];
    const headers = lines[0].split(",").map((h) => h.trim());
    const data = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const obj = {};
      headers.forEach((h, idx) => {
        obj[h] = (cols[idx] ?? "").trim();
      });
      data.push(obj);
    }
    return data;
  }

  function sheetToJson(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const range = XLSX.utils.decode_range(ws["!ref"]);
          range.s.r = 2; // bỏ qua 2 dòng đầu, dùng dòng 3 làm header
          ws["!ref"] = XLSX.utils.encode_range(range);
          const json = XLSX.utils.sheet_to_json(ws, { defval: "", range: range });
          resolve(json);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  }

  async function readFileToRows(f) {
    const name = f.name.toLowerCase();
    if (name.endsWith(".csv")) {
      const text = await f.text();
      return parseCSV(text);
    }
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      return await sheetToJson(f);
    }
    throw new Error("Định dạng không hỗ trợ. Chọn CSV hoặc XLSX");
  }

  function normalizeObjects(arr) {
    return arr.map((r) => {
      const out = {};
      for (const [k, v] of Object.entries(r)) {
        const mapped = keyMap[k] || k;
        out[mapped] = v;
      }
      out.massG = toNum(out.massG);
      out.kcal = toNum(out.kcal);
      out.proteinG = toNum(out.proteinG);
      out.carbG = toNum(out.carbG);
      out.fatG = toNum(out.fatG);
      out.saltG = toNum(out.saltG);
      out.sugarG = toNum(out.sugarG);
      out.fiberG = toNum(out.fiberG);
      out.unit = normUnit(out.unit);
      return out;
    });
  }

  // ===== Modal actions =====
  const onOpenModal = () => {
    setFile(null);
    setCheckOk(false);
    setValidationErrors([]);
    setCheckedRows([]);
    setModalOpen(true);
  };
  const onCloseModal = () => {
    setModalOpen(false);
  };

  // Bước 1: kiểm tra file (gọi BE validate) + parse để xem trước
  async function onCheckFile() {
    if (!file) return;
    setChecking(true);
    setCheckOk(false);
    setValidationErrors([]);
    setCheckedRows([]);

    try {
      // 1. Gọi BE validate
      const res = await validateFoodsBulk({ file });
      // BE: { success, total, valid, invalid, errors[] }
      if (!res?.success) {
        toast.error(res?.message || "Kiểm tra thất bại");
        return;
      }

      const errors = Array.isArray(res.errors) ? res.errors : [];
      if (errors.length) {
        setValidationErrors(errors);
        toast.error(`Có ${errors.length} hàng dữ liệu không hợp lệ`);
        return; // không parse/import khi còn lỗi
      }

      // 2. Không có lỗi -> parse đọc file để chuẩn bị nhập
      const raw = await readFileToRows(file);

      // Bỏ các dòng hoàn toàn trống
      const filteredRaw = raw.filter((row) =>
        Object.values(row || {}).some(
          (v) => v !== null && v !== undefined && String(v).trim() !== ""
        )
      );

      if (!filteredRaw.length) {
        toast.error(
          "File không có dữ liệu món ăn. Vui lòng nhập ít nhất 1 dòng dữ liệu."
        );
        setCheckOk(false);
        setCheckedRows([]);
        return;
      }

      const normalized = normalizeObjects(filteredRaw);
      // 👉 Lưu tạm vào checkedRows, KHÔNG đổ vào bảng rows
      setCheckedRows(normalized);

      setCheckOk(true);
      toast.success(
        `File hợp lệ, có ${normalized.length} dòng dữ liệu, sẵn sàng nhập`
      );
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.message || e.message || "Không đọc được file";
      toast.error(msg);
    } finally {
      setChecking(false);
    }
  }

  // Bước 2: "Nhập" chỉ đóng modal vì rows đã được set ở bước kiểm tra
  function onImportToTable() {
    if (!checkOk || !checkedRows.length) {
      toast.error("Chưa có dữ liệu hợp lệ để nhập");
      return;
    }

    // Nhập thêm vào bảng (append vào rows hiện có)Có 1 hàng dữ liệu không hợp lệ
    setRows((prev) => [...prev, ...checkedRows]);
    setSelected([]);
    setModalOpen(false);

    toast.success(`Đã nhập ${checkedRows.length} dòng vào danh sách`);

    // Reset trạng thái kiểm tra cho lần sau
    setFile(null);
    setCheckOk(false);
    setCheckedRows([]);
    setValidationErrors([]);
  }

  // ===== Page actions =====
  const toggleAll = () => {
    if (allChecked) setSelected([]);
    else setSelected(rows.map((_, i) => i));
  };
  const toggleOne = (idx) => {
    setSelected((prev) =>
      prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx]
    );
  };

  const onDeleteSelected = () => {
    if (!selected.length) return;
    const keep = rows.filter((_, idx) => !selected.includes(idx));
    setRows(keep);
    setSelected([]);
  };

  // Build CSV to send to server import API
  const csvToUpload = useMemo(() => {
    if (!rows.length) return "";
    const head = [
      "name",
      "servingDesc",
      "massG",
      "unit",
      "kcal",
      "proteinG",
      "carbG",
      "fatG",
      "saltG",
      "sugarG",
      "fiberG",
      "imageUrl",
      "description",
    ];
    const lines = [head.join(",")];
    rows.forEach((r) => {
      const a = head.map((k) => r[k] ?? "");
      lines.push(a.join(","));
    });
    return lines.join("\n");
  }, [rows]);

  async function onSaveAll() {
    if (!rows.length) {
      toast.error(
        "Chưa có dữ liệu để lưu. Vui lòng nhập ít nhất 1 món ăn rồi thử lại."
      );
      return;
    }
    try {
      const blob = new Blob([csvToUpload], {
        type: "text/csv;charset=utf-8;",
      });
      const file = new File([blob], "foods_import.csv", { type: "text/csv" });
      const res = await importFoodsBulk({
        file,
        options: {
          fetchImages: true,
          upsertBy: "name+mass+unit",
          status: "approved",
        },
      });
      if (res?.success) {
        toast.success(
          `Lưu thành công: +${res.inserted} / cập nhật ${res.updated}`
        );
        setRows([]);
        setSelected([]);
      } else {
        toast.error(res?.message || "Lưu thất bại");
      }
    } catch (e) {
      toast.error(
        e?.response?.data?.message || e.message || "Lưu thất bại"
      );
    }
  }

  // ===== Download sample (ExcelJS template) =====
  async function downloadTemplate() {
    try {
      await downloadFoodTemplateExcel();
    } catch (e) {
      console.error(e);
      toast.error("Không thể tạo file mẫu Excel");
    }
  }

  return (
    <div className="im-page">
      {/* ===== Breadcrumb ===== */}
      <nav className="im-breadcrumb" aria-label="breadcrumb">
        <Link to="/">
          <i className="fa-solid fa-house" /> <span>Trang chủ</span>
        </Link>
        <span className="sep">/</span>
        <span className="group">
          <i className="fa-solid fa-utensils" /> <span>Quản lý Món ăn</span>
        </span>
        <span className="separator">/</span>
        <span className="current-page">Danh sách món ăn</span>
        <span className="sep">/</span>
        <span className="current">Nhập danh sách món ăn</span>
      </nav>

      {/* ===== Card ===== */}
      <div className="im-card">
        <div className="im-head">
          <h2>Nhập danh sách</h2>
          <div className="im-actions">
            {rows.length === 0 ? (
              <>
                <button className="im-btn" onClick={() => history.back()}>
                  Hủy
                </button>
                <button className="im-btn primary" onClick={onOpenModal}>
                  <i className="fa-solid fa-file-import" /> Nhập
                </button>
              </>
            ) : (
              <>
                <button className="im-btn" onClick={() => history.back()}>
                  Hủy
                </button>
                <button
                  className="im-btn danger"
                  onClick={onDeleteSelected}
                  disabled={!selected.length}
                >
                  Xóa
                </button>
                <button className="im-btn primary" onClick={onSaveAll}>
                  Lưu
                </button>
              </>
            )}
          </div>
        </div>

        {/* ===== Table ===== */}
        <div className="im-table">
          <div className="im-thead">
            <label className="im-cell cb">
              <input
                type="checkbox"
                checked={allChecked}
                ref={(el) => {
                  if (el) el.indeterminate = someChecked;
                }}
                onChange={toggleAll}
              />
            </label>
            <div className="im-cell img">Hình ảnh</div>
            <div className="im-cell name">Tên món ăn</div>
            <div className="im-cell serving">Khẩu phần</div>
            <div className="im-cell mass">Khối lượng</div>
            <div className="im-cell unit">Đơn vị</div>
            <div className="im-cell kcal">Calorie</div>
            <div className="im-cell pro">Đạm</div>
            <div className="im-cell carb">Đường bột</div>
            <div className="im-cell fat">Chất béo</div>
            <div className="im-cell salt">Muối</div>
            <div className="im-cell sugar">Đường</div>
            <div className="im-cell fiber">Chất xơ</div>
          </div>

          {rows.length === 0 && (
            <div className="im-empty">Chưa có món ăn được nhập</div>
          )}

          {rows.map((r, idx) => (
            <div key={idx} className="im-trow">
              <label className="im-cell cb">
                <input
                  type="checkbox"
                  checked={selected.includes(idx)}
                  onChange={() => toggleOne(idx)}
                />
              </label>
              <div className="im-cell img">
                {r.imageUrl ? (
                  <img
                    src={toAbs(r.imageUrl)}
                    alt={r.name}
                    onError={(e) => {
                      e.currentTarget.src = "/images/food-placeholder.jpg";
                    }}
                  />
                ) : (
                  <div className="im-img-fb">
                    <i className="fa-regular fa-image" />
                  </div>
                )}
              </div>
              <div className="im-cell name">{r.name || "—"}</div>
              <div className="im-cell serving">
                {r.servingDesc || "—"}
              </div>
              <div className="im-cell mass">{r.massG ?? "—"}</div>
              <div className="im-cell unit">{r.unit || "g"}</div>
              <div className="im-cell kcal">{r.kcal ?? "—"}</div>
              <div className="im-cell pro">{r.proteinG ?? ""}</div>
              <div className="im-cell carb">{r.carbG ?? ""}</div>
              <div className="im-cell fat">{r.fatG ?? ""}</div>
              <div className="im-cell salt">{r.saltG ?? ""}</div>
              <div className="im-cell sugar">{r.sugarG ?? ""}</div>
              <div className="im-cell fiber">{r.fiberG ?? ""}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== Modal ===== */}
      {modalOpen && (
        <div className="im-backdrop" onClick={onCloseModal}>
          <div
            className="im-modal"
            role="dialog"
            aria-labelledby="im-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="im-mhead">
              <h3 id="im-title">Nhập danh sách</h3>
            </div>

            <div
              className={`im-drop ${isDragging ? "dragging" : ""}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragEnter={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                hidden
                onChange={(e) => {
                  handleFileSelect(e.target.files?.[0] || null);
                }}
              />
              {!file ? (
                <>
                  <div className="im-drop-text">
                    <i className="fa-regular fa-file" /> Kéo &amp; thả file vào
                    đây hoặc <span className="link">nhấp để tải lên</span>
                  </div>
                  <div className="im-drop-hint">
                    Hỗ trợ CSV/XLSX · Tối đa 5MB
                  </div>
                </>
              ) : (
                <>
                  <div className="im-file-name">
                    <i className="fa-regular fa-file" />
                    {file.name}{" "}
                    <button
                      className="link"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      Thay đổi
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="im-sample">
              <div className="im-sample-left">
                <i className="fa-regular fa-file-excel" />
                <div>
                  <div className="im-sample-title">Danh sách mẫu</div>
                  <div className="im-sample-desc">
                    Tải xuống danh sách mẫu để thêm danh sách các món ăn
                  </div>
                </div>
              </div>
              <button className="im-btn" onClick={downloadTemplate}>
                <i className="fa-solid fa-download" /> Tải mẫu
              </button>
            </div>

            {checkOk ? (
              <div className="im-msg ok">
                <div>
                  File hợp lệ, có {checkedRows.length} dòng dữ liệu, sẵn sàng nhập
                </div>
                <div className="im-msg-sub">
                  Nhấp nút <strong>Nhập</strong> để nhập dữ liệu.
                </div>
              </div>
            ) : file ? (
              <div className="im-msg warn">
                {validationErrors.length > 0
                  ? "Vui lòng kiểm tra và sửa các dữ liệu không hợp lệ"
                  : "Vui lòng nhấp Kiểm tra trước khi nhập"}
              </div>
            ) : null}

            {/* Danh sách lỗi validate */}
            {validationErrors.length > 0 && (
              <div className="im-valbox">
                <div className="im-val-head">
                  <i className="fa-solid fa-circle-exclamation" />
                  <span>
                    Có {validationErrors.length} hàng dữ liệu không hợp lệ
                  </span>
                </div>
                <div className="im-val-list">
                  {validationErrors.map((e, i) => (
                    <div key={i} className="im-val-item">
                      <span className="im-val-row">Dòng {e.index}</span>
                      <span className="im-val-name">
                        {e.name || "(không có tên)"}
                      </span>
                      <span className="im-val-msg">
                        {Array.isArray(e.messages)
                          ? e.messages.join("; ")
                          : e.messages}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="im-mfoot">
              <button className="im-btn" onClick={onCloseModal}>
                Hủy
              </button>
              {!checkOk ? (
                <button
                  className="im-btn primary"
                  onClick={onCheckFile}
                  disabled={!file || checking}
                >
                  {checking ? "Đang kiểm tra..." : "Kiểm tra"}
                </button>
              ) : (
                <button className="im-btn primary" onClick={onImportToTable}>
                  Nhập
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
