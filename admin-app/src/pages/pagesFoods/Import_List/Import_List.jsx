import React, { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import * as XLSX from "xlsx"; // ensure installed on admin-app
import { api, importFoodsBulk } from "../../../lib/api";
import "./Import_List.css";

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try { return new URL(u, API_ORIGIN).toString(); } catch { return u; }
};

const VN_HEADERS = [
  "Hình ảnh","Tên","Khẩu phần","Khối lượng","Đơn vị",
  "Calorie","Đạm","Đường bột","Chất béo","Muối","Đường","Chất xơ"
];

// Map any header (VN or EN) to internal field
const keyMap = {
  "Hình ảnh": "imageUrl",
  "Tên": "name",
  "Khẩu phần": "servingDesc",
  "Khối lượng": "massG",
  "Đơn vị": "unit",
  "Calorie": "kcal",
  "Đạm": "proteinG",
  "Đường bột": "carbG",
  "Chất béo": "fatG",
  "Muối": "saltG",
  "Đường": "sugarG",
  "Chất xơ": "fiberG",
  // accept EN keys
  imageUrl: "imageUrl", name: "name", servingDesc: "servingDesc", massG: "massG", unit: "unit", kcal: "kcal",
  proteinG: "proteinG", carbG: "carbG", fatG: "fatG", saltG: "saltG", sugarG: "sugarG", fiberG: "fiberG",
};

const isNum = (v) => v !== null && v !== undefined && v !== "" && !Number.isNaN(Number(v));
const toNum = (v) => (isNum(v) ? Number(v) : null);
const normUnit = (u) => (String(u||"").toLowerCase() === "ml" ? "ml" : "g");

export default function ImportList() {
  // staged rows shown in table (not yet saved)
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [checking, setChecking] = useState(false);
  const [checkOk, setCheckOk] = useState(false);
  const fileInputRef = useRef(null);

  const allChecked = rows.length > 0 && selected.length === rows.length;
  const someChecked = selected.length > 0 && selected.length < rows.length;

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
      headers.forEach((h, idx) => { obj[h] = (cols[idx] ?? "").trim(); });
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
          const json = XLSX.utils.sheet_to_json(ws, { defval: "" });
          resolve(json);
        } catch (err) { reject(err); }
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

  function validateRows(arr) {
    const errs = [];
    arr.forEach((r, idx) => {
      if (!r.name || !isNum(r.massG) || !r.unit || !isNum(r.kcal)) {
        errs.push({ index: idx, reason: "Thiếu name/massG/unit/kcal" });
      }
      if (r.unit !== "g" && r.unit !== "ml") {
        errs.push({ index: idx, reason: "Đơn vị chỉ 'g' hoặc 'ml'" });
      }
    });
    return errs;
  }

  // ===== Modal actions =====
  const onOpenModal = () => { setFile(null); setCheckOk(false); setModalOpen(true); };
  const onCloseModal = () => { setModalOpen(false); };

  async function onCheckFile() {
    if (!file) return;
    setChecking(true);
    try {
      const raw = await readFileToRows(file);
      const normalized = normalizeObjects(raw);
      const errs = validateRows(normalized);
      if (errs.length) {
        setCheckOk(false);
        toast.error("Kiểm tra lại các trường dữ liệu của danh sách món ăn");
      } else {
        setCheckOk(true);
        toast.success("Sẵn sàng thêm danh sách các món ăn");
      }
    } catch (e) {
      setCheckOk(false);
      toast.error(e.message || "Không đọc được file");
    } finally { setChecking(false); }
  }

  async function onImportToTable() {
    try {
      const raw = await readFileToRows(file);
      const normalized = normalizeObjects(raw);
      const errs = validateRows(normalized);
      if (errs.length) {
        toast.error("Kiểm tra thất bại, không thể nhập");
        return;
      }
      setRows(normalized);
      setSelected([]);
      setModalOpen(false);
    } catch (e) {
      toast.error(e.message || "Không thể nhập");
    }
  }

  // ===== Page actions =====
  const toggleAll = () => {
    if (allChecked) setSelected([]);
    else setSelected(rows.map((_, i) => i));
  };
  const toggleOne = (idx) => {
    setSelected((prev) => prev.includes(idx) ? prev.filter((x) => x !== idx) : [...prev, idx]);
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
    const head = ["name","servingDesc","massG","unit","kcal","proteinG","carbG","fatG","saltG","sugarG","fiberG","imageUrl","description"];
    const lines = [head.join(",")];
    rows.forEach((r) => {
      const a = head.map((k) => (r[k] ?? ""));
      lines.push(a.join(","));
    });
    return lines.join("\n");
  }, [rows]);

  async function onSaveAll() {
    if (!rows.length) return;
    try {
      const blob = new Blob([csvToUpload], { type: "text/csv;charset=utf-8;" });
      const file = new File([blob], "foods_import.csv", { type: "text/csv" });
      const res = await importFoodsBulk({
        file,
        options: { fetchImages: true, upsertBy: "name+mass+unit", status: "approved" }
      });
      if (res?.success) {
        toast.success(`Lưu thành công: +${res.inserted} / cập nhật ${res.updated}`);
        setRows([]); setSelected([]);
      } else {
        toast.error(res?.message || "Lưu thất bại");
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || e.message || "Lưu thất bại");
    }
  }

  // ===== Download sample (FIX UTF-8 dấu tiếng Việt với BOM) =====
  function downloadTemplate() {
    // CSV escape
    const esc = (v = "") => {
      const s = String(v);
      return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const CRLF = "\r\n";
    const headerLine = VN_HEADERS.map(esc).join(",");
    const sampleRow = [
      "https://example.com/chicken.jpg",
      "Ức gà áp chảo",
      "1 phần",
      "150",
      "g",
      "225","33","0","9","0.3","0","0"
    ].map(esc).join(",");

    // *** BOM để Excel hiểu UTF-8 đúng dấu ***
    const bom = "\uFEFF";
    const body = headerLine + CRLF + sampleRow + CRLF;
    const blob = new Blob([bom, body], { type: "text/csv;charset=utf-8" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "foods_template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="im-page">
      {/* ===== Breadcrumb ===== */}
      <nav className="im-breadcrumb" aria-label="breadcrumb">
        <Link to="/"><i className="fa-solid fa-house" /> <span>Trang chủ</span></Link>
        <span className="sep">/</span>
        <span className="group"><i className="fa-solid fa-utensils" /> <span>Quản lý Món ăn</span></span>
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
                <button className="im-btn" onClick={() => history.back()}>Hủy</button>
                <button className="im-btn primary" onClick={onOpenModal}><i className="fa-solid fa-file-import"/> Nhập</button>
              </>
            ) : (
              <>
                <button className="im-btn danger" onClick={onDeleteSelected} disabled={!selected.length}>Xóa</button>
                <button className="im-btn primary" onClick={onSaveAll}>Lưu</button>
              </>
            )}
          </div>
        </div>

        {/* ===== Table ===== */}
        <div className="im-table">
          <div className="im-thead">
            <label className="im-cell cb">
              <input type="checkbox" checked={allChecked} ref={(el)=>{ if (el) el.indeterminate = someChecked; }} onChange={toggleAll} />
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
                <input type="checkbox" checked={selected.includes(idx)} onChange={()=>toggleOne(idx)} />
              </label>
              <div className="im-cell img">
                {r.imageUrl ? (
                  <img src={toAbs(r.imageUrl)} alt={r.name} onError={(e)=>{ e.currentTarget.src = "/images/food-placeholder.jpg"; }} />
                ) : <div className="im-img-fb"><i className="fa-regular fa-image"/></div>}
              </div>
              <div className="im-cell name">{r.name || "—"}</div>
              <div className="im-cell serving">{r.servingDesc || "—"}</div>
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
          <div className="im-modal" role="dialog" aria-labelledby="im-title" onClick={(e)=>e.stopPropagation()}>
            <div className="im-mhead">
              <h3 id="im-title">Nhập danh sách</h3>
            </div>

            <div className="im-drop" onClick={()=>fileInputRef.current?.click()}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                hidden
                onChange={(e)=>{ setFile(e.target.files?.[0]||null); setCheckOk(false); }}
              />
              {!file ? (
                <>
                  <div className="im-drop-text"><i className="fa-regular fa-file"/> Kéo & thả file vào đây hoặc <span className="link">nhấp để tải lên</span></div>
                  <div className="im-drop-hint">Hỗ trợ CSV/XLSX · Tối đa 5MB</div>
                </>
              ) : (
                <>
                  <div className="im-file-name"><i className="fa-regular fa-file"/> 
                    {file.name}{" "}
                    <button className="link" onClick={(e)=>{ e.stopPropagation(); fileInputRef.current?.click(); }}>
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
                  <div className="im-sample-desc">Tải xuống danh sách mẫu để thêm danh sách các món ăn</div>
                </div>
              </div>
              <button className="im-btn" onClick={downloadTemplate}>
                <i className="fa-solid fa-download"/> Tải mẫu
              </button>
            </div>

            {checkOk ? (
              <div className="im-msg ok">Sẵn sàng thêm danh sách các món ăn</div>
            ) : file ? (
              <div className="im-msg warn">Vui lòng nhấn Kiểm tra trước khi nhập</div>
            ) : null}

            <div className="im-mfoot">
              <button className="im-btn" onClick={onCloseModal}>Hủy</button>
              {!checkOk ? (
                <button className="im-btn primary" onClick={onCheckFile} disabled={!file || checking}>
                  {checking ? "Đang kiểm tra..." : "Kiểm tra"}
                </button>
              ) : (
                <button className="im-btn primary" onClick={onImportToTable}>Nhập</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
