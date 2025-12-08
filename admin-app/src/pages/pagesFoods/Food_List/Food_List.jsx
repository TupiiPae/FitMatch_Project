// admin-app/src/pagesFoods/Food_List/Food_List.jsx
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, listFoodsAdminOnly, deleteFood } from "../../../lib/api.js";
import { toast } from "react-toastify";
import CannotDeleteModal from "../../../components/CannotDeleteModal.jsx";
import ModalExport from "./ModalExport.jsx";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import "./Food_List.css";

// Chuẩn hoá URL ảnh giống user-app
const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try {
    return new URL(u, API_ORIGIN).toString();
  } catch {
    return u;
  }
};

export default function FoodsList() {
  const nav = useNavigate();

  /* ============ Filters & state ============ */
  const [q, setQ] = useState("");

  // Thời gian tạo (approvedAt) – state đang dùng để filter
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  // Draft trong popup
  const [dateFromDraft, setDateFromDraft] = useState("");
  const [dateToDraft, setDateToDraft] = useState("");

  // Numeric filters: active (dùng để query)
  const [massMin, setMassMin] = useState("");
  const [massMax, setMassMax] = useState("");
  const [kcalMin, setKcalMin] = useState("");
  const [kcalMax, setKcalMax] = useState("");
  const [proteinMin, setProteinMin] = useState("");
  const [proteinMax, setProteinMax] = useState("");
  const [carbMin, setCarbMin] = useState("");
  const [carbMax, setCarbMax] = useState("");
  const [fatMin, setFatMin] = useState("");
  const [fatMax, setFatMax] = useState("");

  // Numeric filters: draft trong popup
  const [massMinDraft, setMassMinDraft] = useState("");
  const [massMaxDraft, setMassMaxDraft] = useState("");
  const [kcalMinDraft, setKcalMinDraft] = useState("");
  const [kcalMaxDraft, setKcalMaxDraft] = useState("");
  const [proteinMinDraft, setProteinMinDraft] = useState("");
  const [proteinMaxDraft, setProteinMaxDraft] = useState("");
  const [carbMinDraft, setCarbMinDraft] = useState("");
  const [carbMaxDraft, setCarbMaxDraft] = useState("");
  const [fatMinDraft, setFatMinDraft] = useState("");
  const [fatMaxDraft, setFatMaxDraft] = useState("");

  // Chip đang mở dropdown
  const [openFilter, setOpenFilter] = useState(null); // 'mass' | 'kcal' | 'protein' | 'carb' | 'fat' | 'date' | null

  // Loại file export
  const [exportType, setExportType] = useState(""); // '', 'xlsx', 'csv'

  /* ============ Data & pagination ============ */
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [limit, setLimit] = useState(10);
  const [skip, setSkip] = useState(0);
  const [total, setTotal] = useState(0);

  /* ============ Selection ============ */
  const [selectedIds, setSelectedIds] = useState([]);
  const allChecked = items.length > 0 && selectedIds.length === items.length;
  const someChecked = selectedIds.length > 0 && selectedIds.length < items.length;

  /* ============ Confirm modal (single & bulk dùng chung) ============ */
  // { mode:'single'|'bulk', ids:string[] } | null
  const [confirm, setConfirm] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  /* ============ Cannot delete modal ============ */
  const [cannotDeleteOpen, setCannotDeleteOpen] = useState(false);
  const [cannotDeleteMsg, setCannotDeleteMsg] = useState("");
  const [cannotDeleteInfo, setCannotDeleteInfo] = useState(null);

  /* ============ Export modal ============ */
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportItems, setExportItems] = useState([]);
  const [exportLoading, setExportLoading] = useState(false);

  /* ============ Helper build params ============ */
  const buildListParams = (pagination = {}) => {
    const params = {
      status: "approved",
      q,
      ...pagination,
    };

    if (dateFrom) params.approvedFrom = dateFrom;
    if (dateTo) params.approvedTo = dateTo;

    const addRangeNumber = (minStr, maxStr, minKey, maxKey) => {
      if (minStr !== "") {
        const n = Number(minStr);
        if (!Number.isNaN(n)) params[minKey] = n;
      }
      if (maxStr !== "") {
        const n = Number(maxStr);
        if (!Number.isNaN(n)) params[maxKey] = n;
      }
    };

    // Chú ý: BE cần đọc các tham số này: massGMin, massGMax, kcalMin, kcalMax,
    // proteinGMin, proteinGMax, carbGMin, carbGMax, fatGMin, fatGMax
    addRangeNumber(massMin, massMax, "massGMin", "massGMax");
    addRangeNumber(kcalMin, kcalMax, "kcalMin", "kcalMax");
    addRangeNumber(proteinMin, proteinMax, "proteinGMin", "proteinGMax");
    addRangeNumber(carbMin, carbMax, "carbGMin", "carbGMax");
    addRangeNumber(fatMin, fatMax, "fatGMin", "fatGMax");

    return params;
  };

  /* ============ Load data ============ */
  const load = async () => {
    setLoading(true);
    setSelectedIds([]); // reset chọn khi đổi trang/lọc
    try {
      const params = buildListParams({ limit, skip });
      const res = await listFoodsAdminOnly(params);
      const arr = Array.isArray(res?.items) ? res.items : [];
      setItems(arr);
      setTotal(typeof res?.total === "number" ? res.total : arr.length);
    } catch (err) {
      console.error(err);
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, skip]);

  // Debounce khi filter text/date/min-max thay đổi → reset về trang 1
  useEffect(() => {
    const t = setTimeout(() => {
      if (skip !== 0) setSkip(0);
      else load();
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    q,
    dateFrom,
    dateTo,
    massMin,
    massMax,
    kcalMin,
    kcalMax,
    proteinMin,
    proteinMax,
    carbMin,
    carbMax,
    fatMin,
    fatMax,
  ]);

  /* ============ Actions: delete single ============ */
  const onDeleteOne = async (id) => {
    try {
      setDeletingId(id);
      await deleteFood(id);

      // Nếu xóa item cuối của trang thì lùi trang, ngược lại cập nhật lạc quan
      if (items.length === 1 && skip > 0) {
        setSkip(Math.max(0, skip - limit));
      } else {
        setItems((prev) => prev.filter((x) => x._id !== id));
        setTotal((t) => Math.max(0, Number(t || 0) - 1));
        setSelectedIds((sel) => sel.filter((x) => x !== id));
      }
      toast.success("Đã xóa món ăn");
    } catch (e) {
      console.error(e);
      const data = e?.response?.data;

      // 🔍 Nếu BE trả về danh sách thực đơn gợi ý đang dùng món này
      if (data?.menus && Array.isArray(data.menus) && data.menus.length) {
        setCannotDeleteInfo({
          title: "Không thể xoá món ăn",
          message:
            data.message ||
            "Món ăn này đang được sử dụng trong các thực đơn gợi ý sau, nên không thể xoá:",
          details: data.menus.map(
            (m) => m.name || `#${String(m.id || m._id || "").slice(-6)}`
          ),
        });
      } else {
        toast.error(data?.message || "Xóa thất bại");
      }
    } finally {
      setDeletingId(null);
    }
  };

  /* ============ Actions: delete bulk ============ */
  const onBulkDelete = async (ids) => {
    if (!ids?.length) return;
    try {
      setBulkDeleting(true);
      const results = await Promise.allSettled(ids.map((id) => deleteFood(id)));

      const okResults = results.filter((r) => r.status === "fulfilled");
      const failResults = results.filter((r) => r.status === "rejected");

      const okCount = okResults.length;
      const failCount = failResults.length;

      const deletingAllOnPage = ids.length >= items.length;
      if (deletingAllOnPage && skip > 0) {
        setSkip(Math.max(0, skip - limit)); // lùi trang, load() sẽ tự gọi
      } else {
        // Cập nhật lạc quan cho những món xoá thành công
        const successIds = okResults.map((r, idx) => ids[idx]);
        setItems((prev) => prev.filter((x) => !successIds.includes(x._id)));
        setTotal((t) => Math.max(0, Number(t || 0) - okCount));
        setSelectedIds([]);
      }

      if (okCount > 0) toast.success(`Đã xóa ${okCount} món ăn`);

      if (failCount > 0) {
        // Thử lấy 1 lỗi kiểu "đang được sử dụng trong thực đơn"
        const blocking = failResults
          .map((r) => r.reason?.response?.data)
          .find((d) => d?.menus && Array.isArray(d.menus) && d.menus.length);

        if (blocking) {
          setCannotDeleteInfo({
            title: "Một số món không thể xoá",
            message:
              blocking.message ||
              "Một số món đang được sử dụng trong các thực đơn gợi ý sau, nên không thể xoá:",
            details: blocking.menus.map(
              (m) => m.name || `#${String(m.id || m._id || "").slice(-6)}`
            ),
          });
        } else {
          toast.error(`${failCount} món xóa thất bại`);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Xóa thất bại");
    } finally {
      setBulkDeleting(false);
    }
  };

  /* ============ Selection helpers ============ */
  const toggleAll = () => {
    if (allChecked) setSelectedIds([]);
    else setSelectedIds(items.map((x) => x._id));
  };
  const toggleOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  /* ============ Pagination helpers ============ */
  const page = Math.floor(skip / limit);
  const pageCount = Math.max(1, Math.ceil((total || 0) / limit));
  const handleLimitChange = (e) => {
    setLimit(Number(e.target.value));
    setSkip(0);
  };
  const handlePageChange = (newSkip) => {
    if (newSkip >= 0 && newSkip < Math.max(total, 1)) {
      setSkip(newSkip);
    }
  };

  // helper: index (0-based) -> A, B, C...
  const getColumnLetter = (colNumber) => {
    let letter = "";
    while (colNumber >= 0) {
      letter = String.fromCharCode((colNumber % 26) + 65) + letter;
      colNumber = Math.floor(colNumber / 26) - 1;
    }
    return letter;
  };

  /* ============ Export helpers ============ */

  // Chuẩn hoá dữ liệu để export
  const buildExportRows = (rows) =>
    rows.map((x, idx) => {
      const img = x.imageUrl ? toAbs(x.imageUrl) : "";
      const portion =
        x.portionName || x.servingDesc || x.serving || x.portion || "";
      const mass =
        x.massG != null ? `${x.massG} ${x.unit || "g"}` : x.unit || "";
      return {
        stt: idx + 1,
        image: img,
        name: x.name || "",
        portion,
        mass,
        kcal: x.kcal ?? "",
        proteinG: x.proteinG ?? "",
        carbG: x.carbG ?? "",
        fatG: x.fatG ?? "",
        saltG: x.saltG ?? "",
        sugarG: x.sugarG ?? "",
        fiberG: x.fiberG ?? "",
      };
    });

  const csvEscape = (v) => {
    const s = String(v ?? "");
    if (s.includes('"') || s.includes(",") || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const downloadCsvFile = (rows) => {
    const data = buildExportRows(rows);

    const header = [
      "STT",
      "Hình ảnh",
      "Tên",
      "Khẩu phần",
      "Khối lượng",
      "Calorie (kcal)",
      "Đạm (g)",
      "Đường bột (g)",
      "Chất béo (g)",
      "Muối (g)",
      "Đường (g)",
      "Chất xơ (g)",
    ];

    const lines = [];
    lines.push(csvEscape("Danh sách món ăn")); // title
    lines.push(""); // dòng trống
    lines.push(header.map(csvEscape).join(","));

    data.forEach((r) => {
      const row = [
        r.stt,
        r.image,
        r.name,
        r.portion,
        r.mass,
        r.kcal,
        r.proteinG,
        r.carbG,
        r.fatG,
        r.saltG,
        r.sugarG,
        r.fiberG,
      ].map(csvEscape);
      lines.push(row.join(","));
    });

    const csvStr = lines.join("\n");
    const blob = new Blob([csvStr], {
      type: "text/csv;charset=utf-8;",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "foods.csv";
    a.click();
  };

  const downloadExcelFile = async (rows) => {
    const data = buildExportRows(rows);

    // Định nghĩa cột export: STT + các cột dinh dưỡng
    const columns = [
      { key: "stt",      header: "STT",             width: 6,  isNumber: true },
      { key: "image",    header: "Hình ảnh (URL)",  width: 30 },
      { key: "name",     header: "Tên món ăn",      width: 28 },
      { key: "portion",  header: "Khẩu phần",      width: 20 },
      { key: "mass",     header: "Khối lượng",     width: 16 },
      { key: "kcal",     header: "Calorie (kcal)", width: 16, isNumber: true },
      { key: "proteinG", header: "Đạm (g)",        width: 14, isNumber: true },
      { key: "carbG",    header: "Đường bột (g)",  width: 16, isNumber: true },
      { key: "fatG",     header: "Chất béo (g)",   width: 14, isNumber: true },
      { key: "saltG",    header: "Muối (g)",       width: 14, isNumber: true },
      { key: "sugarG",   header: "Đường (g)",      width: 14, isNumber: true },
      { key: "fiberG",   header: "Chất xơ (g)",    width: 14, isNumber: true },
    ];

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Danh sách món ăn", {
      pageSetup: { paperSize: 9, orientation: "portrait" },
      properties: { defaultRowHeight: 18 },
    });

    // ===== TITLE =====
    const lastColLetter = getColumnLetter(columns.length - 1); // 0-based
    sheet.mergeCells(`A1:${lastColLetter}1`);
    const titleCell = sheet.getCell("A1");
    titleCell.value = "Danh sách món ăn";
    titleCell.font = { name: "Times New Roman", bold: true, size: 16 };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };

    // Hàng trống (row 2)
    sheet.addRow([]);

    // ===== HEADER (row 3) =====
    const headerRow = sheet.addRow(columns.map((c) => c.header));

    headerRow.eachCell((cell, colNumber) => {
      const colDef = columns[colNumber - 1];

      cell.font = {
        name: "Times New Roman",
        size: 11,
        bold: true,
        color: { argb: "FF000000" }, // không cần đỏ như template import
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE3F2FD" }, // xanh nhạt giống template
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };

      // set width
      sheet.getColumn(colNumber).width = colDef?.width || 15;
    });

    // ===== DATA ROWS (bắt đầu từ row 4) =====
    data.forEach((r) => {
      const row = sheet.addRow(columns.map((c) => r[c.key] ?? ""));

      row.eachCell((cell, colNumber) => {
        const colDef = columns[colNumber - 1];

        cell.font = { name: "Times New Roman", size: 11 };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
        cell.alignment = {
          horizontal:
            colDef?.key === "stt" || colDef?.isNumber ? "center" : "left",
          vertical: "middle",
          wrapText: true,
        };
      });
    });

    // Freeze tới row 3 (giống template import)
    sheet.views = [{ state: "frozen", xSplit: 0, ySplit: 3 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, "Danh_sach_mon_an_export.xlsx");
  };

  const handleConfirmExport = async () => {
    if (!exportItems.length) {
      toast.error("Không có dữ liệu để xuất.");
      return;
    }
    if (exportType === "csv") {
      downloadCsvFile(exportItems);
    } else {
      await downloadExcelFile(exportItems);
    }
    setExportModalOpen(false);
  };

  // Nhấn nút "Xuất danh sách" (trên page-head)
  const handleOpenExport = async () => {
    if (!exportType) {
      toast.error("Vui lòng chọn loại file để xuất (Excel hoặc CSV).");
      return;
    }
    if (total === 0) {
      toast.info("Không có dữ liệu để xuất.");
      return;
    }

    try {
      setExportLoading(true);
      const exportLimit = total && total > 0 ? total : 10000;
      const params = buildListParams({ limit: exportLimit, skip: 0 });
      const res = await listFoodsAdminOnly(params);
      const arr = Array.isArray(res?.items) ? res.items : [];
      if (!arr.length) {
        toast.info("Không có dữ liệu để xuất.");
        return;
      }
      setExportItems(arr);
      setExportModalOpen(true);
    } catch (err) {
      console.error(err);
      toast.error("Không tải được dữ liệu để xuất.");
    } finally {
      setExportLoading(false);
    }
  };

  /* ============ UI helpers ============ */
  const badgeRole = (it) => {
    if (it.createdByAdmin)
      return <span className="role-badge is-admin">Admin</span>;
    if (it.createdBy) return <span className="role-badge is-user">User</span>;
    return <span className="role-badge">N/A</span>;
  };
  const fmtDate = (v) => (v ? new Date(v).toLocaleString() : "—");

  // Active states để highlight chip
  const massActive = massMin !== "" || massMax !== "";
  const kcalActive = kcalMin !== "" || kcalMax !== "";
  const proteinActive = proteinMin !== "" || proteinMax !== "";
  const carbActive = carbMin !== "" || carbMax !== "";
  const fatActive = fatMin !== "" || fatMax !== "";
  const dateActive = !!(dateFrom || dateTo);

  return (
    <div className="foods-page">
      {/* ===== Breadcrumb ===== */}
      <nav className="breadcrumb-nav" aria-label="breadcrumb">
        <Link to="/">
          <i className="fa-solid fa-house" aria-hidden="true"></i>
          <span>Trang chủ</span>
        </Link>
        <span className="separator">/</span>
        <span className="current-group">
          <i className="fa-solid fa-utensils" aria-hidden="true"></i>
          <span>Quản lý Món ăn</span>
        </span>
        <span className="separator">/</span>
        <span className="current-page">Danh sách món ăn</span>
      </nav>

      {/* ===== Card ===== */}
      <div className="card">
        {/* Title + actions */}
        <div className="page-head">
          <h2>Danh sách món ăn ({total})</h2>
          <div className="head-actions">
            <button
              className="btn ghost"
              type="button"
              onClick={() => nav("/foods/import-list")}
              title="Nhập danh sách món ăn từ CSV/XLSX/ZIP"
            >
              <i
                className="fa-solid fa-file-import"
                aria-hidden="true"
              />{" "}
              <span>Nhập danh sách</span>
            </button>

            <button
              className="btn ghost"
              type="button"
              onClick={handleOpenExport}
              disabled={exportLoading}
            >
              <i
                className="fa-solid fa-file-export"
                aria-hidden="true"
              />{" "}
              <span>{exportLoading ? "Đang chuẩn bị..." : "Xuất danh sách"}</span>
            </button>

            <button
              className="btn danger"
              type="button"
              disabled={!selectedIds.length || bulkDeleting}
              onClick={() =>
                setConfirm({ mode: "bulk", ids: selectedIds.slice() })
              }
            >
              <i className="fa-regular fa-trash-can" aria-hidden="true" />{" "}
              <span>{bulkDeleting ? "Đang xóa..." : "Xóa"}</span>
            </button>

            <Link to="/foods/create" className="btn primary">
              <span>Tạo món ăn</span>
            </Link>
          </div>
        </div>

        {/* Search + filters */}
        <div className="card-head">
          {/* Hàng 1: Search */}
          <div className="card-head-top">
            <div className="search">
              <i
                className="fa-solid fa-magnifying-glass"
                aria-hidden="true"
              ></i>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Tìm kiếm theo tên món ăn..."
              />
            </div>
          </div>

          {/* Hàng 2: Bộ lọc + Chọn loại file */}
          <div className="card-head-bottom">
            <div className="filter-chips">
              {/* Khối lượng */}
              <div className="filter-chip-wrap">
                <button
                  type="button"
                  className={`filter-chip ${
                    massActive ? "is-active" : ""
                  }`.trim()}
                  onClick={() =>
                    setOpenFilter(openFilter === "mass" ? null : "mass")
                  }
                >
                  <span>Khối lượng</span>
                  <i className="fa-solid fa-chevron-down" />
                </button>
                {openFilter === "mass" && (
                  <div className="filter-pop" onClick={(e) => e.stopPropagation()}>
                    <div className="filter-pop-title">Khối lượng</div>
                    <div className="filter-pop-body">
                      <div className="filter-pop-item">
                        <label>Min</label>
                        <input
                          type="number"
                          value={massMinDraft}
                          onChange={(e) => setMassMinDraft(e.target.value)}
                        />
                      </div>
                      <div className="filter-pop-item">
                        <label>Max</label>
                        <input
                          type="number"
                          value={massMaxDraft}
                          onChange={(e) => setMassMaxDraft(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="filter-pop-foot">
                      <button
                        type="button"
                        className="filter-pop-clear"
                        onClick={() => {
                          setMassMin("");
                          setMassMax("");
                          setMassMinDraft("");
                          setMassMaxDraft("");
                          setOpenFilter(null);
                        }}
                      >
                        Xóa
                      </button>
                      <button
                        type="button"
                        className="filter-pop-submit"
                        onClick={() => {
                          setMassMin(massMinDraft);
                          setMassMax(massMaxDraft);
                          setOpenFilter(null);
                        }}
                      >
                        Lọc
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Calorie */}
              <div className="filter-chip-wrap">
                <button
                  type="button"
                  className={`filter-chip ${
                    kcalActive ? "is-active" : ""
                  }`.trim()}
                  onClick={() =>
                    setOpenFilter(openFilter === "kcal" ? null : "kcal")
                  }
                >
                  <span>Calorie</span>
                  <i className="fa-solid fa-chevron-down" />
                </button>
                {openFilter === "kcal" && (
                  <div className="filter-pop" onClick={(e) => e.stopPropagation()}>
                    <div className="filter-pop-title">Calorie (kcal)</div>
                    <div className="filter-pop-body">
                      <div className="filter-pop-item">
                        <label>Min</label>
                        <input
                          type="number"
                          value={kcalMinDraft}
                          onChange={(e) => setKcalMinDraft(e.target.value)}
                        />
                      </div>
                      <div className="filter-pop-item">
                        <label>Max</label>
                        <input
                          type="number"
                          value={kcalMaxDraft}
                          onChange={(e) => setKcalMaxDraft(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="filter-pop-foot">
                      <button
                        type="button"
                        className="filter-pop-clear"
                        onClick={() => {
                          setKcalMin("");
                          setKcalMax("");
                          setKcalMinDraft("");
                          setKcalMaxDraft("");
                          setOpenFilter(null);
                        }}
                      >
                        Xóa
                      </button>
                      <button
                        type="button"
                        className="filter-pop-submit"
                        onClick={() => {
                          setKcalMin(kcalMinDraft);
                          setKcalMax(kcalMaxDraft);
                          setOpenFilter(null);
                        }}
                      >
                        Lọc
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Đạm */}
              <div className="filter-chip-wrap">
                <button
                  type="button"
                  className={`filter-chip ${
                    proteinActive ? "is-active" : ""
                  }`.trim()}
                  onClick={() =>
                    setOpenFilter(openFilter === "protein" ? null : "protein")
                  }
                >
                  <span>Đạm</span>
                  <i className="fa-solid fa-chevron-down" />
                </button>
                {openFilter === "protein" && (
                  <div className="filter-pop" onClick={(e) => e.stopPropagation()}>
                    <div className="filter-pop-title">Đạm (g)</div>
                    <div className="filter-pop-body">
                      <div className="filter-pop-item">
                        <label>Min</label>
                        <input
                          type="number"
                          value={proteinMinDraft}
                          onChange={(e) => setProteinMinDraft(e.target.value)}
                        />
                      </div>
                      <div className="filter-pop-item">
                        <label>Max</label>
                        <input
                          type="number"
                          value={proteinMaxDraft}
                          onChange={(e) => setProteinMaxDraft(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="filter-pop-foot">
                      <button
                        type="button"
                        className="filter-pop-clear"
                        onClick={() => {
                          setProteinMin("");
                          setProteinMax("");
                          setProteinMinDraft("");
                          setProteinMaxDraft("");
                          setOpenFilter(null);
                        }}
                      >
                        Xóa
                      </button>
                      <button
                        type="button"
                        className="filter-pop-submit"
                        onClick={() => {
                          setProteinMin(proteinMinDraft);
                          setProteinMax(proteinMaxDraft);
                          setOpenFilter(null);
                        }}
                      >
                        Lọc
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Đường bột */}
              <div className="filter-chip-wrap">
                <button
                  type="button"
                  className={`filter-chip ${
                    carbActive ? "is-active" : ""
                  }`.trim()}
                  onClick={() =>
                    setOpenFilter(openFilter === "carb" ? null : "carb")
                  }
                >
                  <span>Đường bột</span>
                  <i className="fa-solid fa-chevron-down" />
                </button>
                {openFilter === "carb" && (
                  <div className="filter-pop" onClick={(e) => e.stopPropagation()}>
                    <div className="filter-pop-title">Đường bột (g)</div>
                    <div className="filter-pop-body">
                      <div className="filter-pop-item">
                        <label>Min</label>
                        <input
                          type="number"
                          value={carbMinDraft}
                          onChange={(e) => setCarbMinDraft(e.target.value)}
                        />
                      </div>
                      <div className="filter-pop-item">
                        <label>Max</label>
                        <input
                          type="number"
                          value={carbMaxDraft}
                          onChange={(e) => setCarbMaxDraft(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="filter-pop-foot">
                      <button
                        type="button"
                        className="filter-pop-clear"
                        onClick={() => {
                          setCarbMin("");
                          setCarbMax("");
                          setCarbMinDraft("");
                          setCarbMaxDraft("");
                          setOpenFilter(null);
                        }}
                      >
                        Xóa
                      </button>
                      <button
                        type="button"
                        className="filter-pop-submit"
                        onClick={() => {
                          setCarbMin(carbMinDraft);
                          setCarbMax(carbMaxDraft);
                          setOpenFilter(null);
                        }}
                      >
                        Lọc
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Chất béo */}
              <div className="filter-chip-wrap">
                <button
                  type="button"
                  className={`filter-chip ${
                    fatActive ? "is-active" : ""
                  }`.trim()}
                  onClick={() =>
                    setOpenFilter(openFilter === "fat" ? null : "fat")
                  }
                >
                  <span>Chất béo</span>
                  <i className="fa-solid fa-chevron-down" />
                </button>
                {openFilter === "fat" && (
                  <div className="filter-pop" onClick={(e) => e.stopPropagation()}>
                    <div className="filter-pop-title">Chất béo (g)</div>
                    <div className="filter-pop-body">
                      <div className="filter-pop-item">
                        <label>Min</label>
                        <input
                          type="number"
                          value={fatMinDraft}
                          onChange={(e) => setFatMinDraft(e.target.value)}
                        />
                      </div>
                      <div className="filter-pop-item">
                        <label>Max</label>
                        <input
                          type="number"
                          value={fatMaxDraft}
                          onChange={(e) => setFatMaxDraft(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="filter-pop-foot">
                      <button
                        type="button"
                        className="filter-pop-clear"
                        onClick={() => {
                          setFatMin("");
                          setFatMax("");
                          setFatMinDraft("");
                          setFatMaxDraft("");
                          setOpenFilter(null);
                        }}
                      >
                        Xóa
                      </button>
                      <button
                        type="button"
                        className="filter-pop-submit"
                        onClick={() => {
                          setFatMin(fatMinDraft);
                          setFatMax(fatMaxDraft);
                          setOpenFilter(null);
                        }}
                      >
                        Lọc
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Thời gian tạo */}
              <div className="filter-chip-wrap">
                <button
                  type="button"
                  className={`filter-chip ${
                    dateActive ? "is-active" : ""
                  }`.trim()}
                  onClick={() =>
                    setOpenFilter(openFilter === "date" ? null : "date")
                  }
                >
                  <span>Thời gian tạo</span>
                  <i className="fa-solid fa-chevron-down" />
                </button>
                {openFilter === "date" && (
                  <div className="filter-pop filter-pop-date" onClick={(e) => e.stopPropagation()}>
                    <div className="filter-pop-title">Thời gian tạo (approvedAt)</div>
                    <div className="filter-pop-body">
                      <div className="filter-pop-item">
                        <label>Từ ngày</label>
                        <input
                          type="date"
                          value={dateFromDraft}
                          onChange={(e) => setDateFromDraft(e.target.value)}
                        />
                      </div>
                      <div className="filter-pop-item">
                        <label>Đến ngày</label>
                        <input
                          type="date"
                          value={dateToDraft}
                          onChange={(e) => setDateToDraft(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="filter-pop-foot">
                      <button
                        type="button"
                        className="filter-pop-clear"
                        onClick={() => {
                          setDateFrom("");
                          setDateTo("");
                          setDateFromDraft("");
                          setDateToDraft("");
                          setOpenFilter(null);
                        }}
                      >
                        Xóa
                      </button>
                      <button
                        type="button"
                        className="filter-pop-submit"
                        onClick={() => {
                          setDateFrom(dateFromDraft || "");
                          setDateTo(dateToDraft || "");
                          setOpenFilter(null);
                        }}
                      >
                        Lọc
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Chọn loại file export */}
            <div className="export-type-box">
              <select
                className="export-type-select"
                value={exportType}
                onChange={(e) => setExportType(e.target.value)}
              >
                <option value="">Xuất file</option>
                <option value="xlsx">Excel (.xlsx)</option>
                <option value="csv">CSV (.csv)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="table">
          <div className="thead">
            <label className="cell cb">
              <input
                type="checkbox"
                checked={allChecked}
                ref={(el) => {
                  if (el) el.indeterminate = someChecked;
                }}
                onChange={toggleAll}
                aria-label="Chọn tất cả"
              />
            </label>
            <div className="cell img">Hình ảnh</div>
            <div className="cell name">Tên</div>
            <div className="cell mass">Khối lượng</div>
            <div className="cell kcal">Calorie (kcal)</div>
            <div className="cell macros">Đạm / Đường bột / Chất béo</div>
            <div className="cell creator">Người tạo</div>
            <div className="cell approved">Thời gian tạo thành công</div>
            <div className="cell act">Thao tác</div>
          </div>

          {loading && <div className="empty">Đang tải...</div>}
          {!loading && items.length === 0 && (
            <div className="empty">Không có món trong danh sách.</div>
          )}

          {!loading &&
            items.map((it) => (
              <div key={it._id} className="trow">
                <label className="cell cb">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(it._id)}
                    onChange={() => toggleOne(it._id)}
                    aria-label={`Chọn ${it.name}`}
                  />
                </label>

                <div className="cell img">
                  {it.imageUrl ? (
                    <img
                      src={toAbs(it.imageUrl)}
                      alt={it.name}
                      onError={(e) => {
                        e.currentTarget.src = "/images/food-placeholder.jpg";
                      }}
                    />
                  ) : (
                    <div className="img-fallback">
                      <i
                        className="fa-regular fa-image"
                        aria-hidden="true"
                      ></i>
                    </div>
                  )}
                </div>

                <div className="cell name">
                  <div className="title">{it.name || "—"}</div>
                  <div className="sub">#{String(it._id).slice(-6)}</div>
                </div>

                <div className="cell mass">
                  {it.massG != null ? `${it.massG} ${it.unit || "g"}` : "—"}
                </div>
                <div className="cell kcal">{it.kcal ?? "—"}</div>

                <div className="cell macros">
                  <span className="chip p">{it.proteinG ?? 0}g</span>
                  <span className="chip c">{it.carbG ?? 0}g</span>
                  <span className="chip f">{it.fatG ?? 0}g</span>
                </div>

                <div className="cell creator">{badgeRole(it)}</div>

                <div className="cell approved">{fmtDate(it.approvedAt)}</div>

                <div className="cell act">
                  <button
                    className="iconbtn"
                    title="Chỉnh sửa"
                    onClick={() => nav(`/foods/${it._id}/edit`)}
                  >
                    <i
                      className="fa-regular fa-pen-to-square"
                      aria-hidden="true"
                    ></i>
                  </button>
                  <button
                    className="iconbtn danger"
                    title="Xóa"
                    onClick={() =>
                      setConfirm({ mode: "single", ids: [it._id] })
                    }
                    disabled={deletingId === it._id}
                  >
                    <i
                      className="fa-solid fa-trash-can"
                      aria-hidden="true"
                    ></i>
                  </button>
                </div>
              </div>
            ))}
        </div>

        {/* Pagination Controls */}
        <div className="pagination-controls">
          <div className="per-page">
            <span>Hiển thị:</span>
            <select value={limit} onChange={handleLimitChange}>
              <option value="10">10 hàng</option>
              <option value="25">25 hàng</option>
              <option value="50">50 hàng</option>
            </select>
          </div>

          <div className="page-nav">
            <span className="page-info">
              Trang {page + 1} / {pageCount} (Tổng: {total})
            </span>
            <button
              className="btn-page"
              onClick={() => handlePageChange(skip - limit)}
              disabled={skip === 0}
            >
              <i
                className="fa-solid fa-chevron-left"
                aria-hidden="true"
              ></i>
            </button>
            <button
              className="btn-page"
              onClick={() => handlePageChange(skip + limit)}
              disabled={skip + limit >= total}
            >
              <i
                className="fa-solid fa-chevron-right"
                aria-hidden="true"
              ></i>
            </button>
          </div>
        </div>
      </div>

      {/* ===== Confirm Delete Modal (.cm-*) dùng chung single & bulk ===== */}
      {confirm && (
        <div
          className="cm-backdrop"
          role="presentation"
          onClick={() => setConfirm(null)}
        >
          <div
            className="cm-modal"
            role="dialog"
            aria-labelledby="cm-title"
            aria-describedby="cm-desc"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cm-head">
              <h1 id="cm-title" className="cm-title">
                {confirm.mode === "bulk"
                  ? `Xóa ${confirm.ids.length} món đã chọn?`
                  : "Xóa món ăn?"}
              </h1>
            </div>

            <div id="cm-desc" className="cm-body">
              Hành động này sẽ xóa khỏi danh sách và cơ sở dữ liệu. Thao tác
              không thể hoàn tác.
            </div>

            <div className="cm-foot">
              <button className="btn ghost" onClick={() => setConfirm(null)}>
                Hủy
              </button>
              {confirm.mode === "single" ? (
                <button
                  className="btn danger"
                  disabled={deletingId === confirm.ids[0]}
                  onClick={async () => {
                    const id = confirm.ids[0];
                    await onDeleteOne(id);
                    setConfirm(null);
                  }}
                >
                  {deletingId === confirm.ids[0] ? "Đang xóa..." : "Xóa"}
                </button>
              ) : (
                <button
                  className="btn danger"
                  disabled={bulkDeleting || !confirm.ids.length}
                  onClick={async () => {
                    await onBulkDelete(confirm.ids);
                    setConfirm(null);
                  }}
                >
                  {bulkDeleting ? "Đang xóa..." : `Xóa ${confirm.ids.length}`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Cannot Delete Modal ===== */}
      <CannotDeleteModal
        open={!!cannotDeleteInfo}
        title={cannotDeleteInfo?.title}
        message={cannotDeleteInfo?.message}
        details={cannotDeleteInfo?.details}
        onClose={() => setCannotDeleteInfo(null)}
      />

      {/* ===== Export Modal ===== */}
      <ModalExport
        open={exportModalOpen}
        type={exportType}
        items={exportItems}
        onClose={() => setExportModalOpen(false)}
        onExport={handleConfirmExport}
      />
    </div>
  );
}
