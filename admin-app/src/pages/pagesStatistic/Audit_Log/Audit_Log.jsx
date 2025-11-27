// admin-app/src/pages/pagesStatistic/Audit_Log/Audit_Log.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { listAuditLogs } from "../../../lib/api";
import "./Audit_Log.css";

/* --------- Helpers: mapping label tiếng Việt --------- */

// Hành động -> label tiếng Việt
const ACTION_LABELS = {
  create: "Tạo mới",
  update: "Cập nhật",
  delete: "Xóa",
  login: "Đăng nhập",
  logout: "Đăng xuất",
  approve: "Duyệt",
  reject: "Từ chối",
  block: "Khóa",
  unblock: "Mở khóa",
  import: "Nhập dữ liệu",
  export: "Xuất dữ liệu",
};

function toActionLabel(action) {
  if (!action) return "";
  return ACTION_LABELS[action] || action;
}

// Loại tài nguyên -> label tiếng Việt
const RESOURCE_LABELS = {
  food: "Món ăn",
  foods: "Món ăn",
  suggestMenu: "Thực đơn gợi ý",
  suggest_menu: "Thực đơn gợi ý",
  suggestPlan: "Lịch tập gợi ý",
  suggest_plan: "Lịch tập gợi ý",
  exercise: "Bài tập",
  exercise_strength: "Bài tập Strength",
  exercise_cardio: "Bài tập Cardio",
  exercise_sport: "Bài tập Sport",
  user: "Người dùng",
  admin: "Tài khoản admin",
  adminAccount: "Tài khoản admin",
};

function toResourceLabel(rt) {
  if (!rt) return "";
  return RESOURCE_LABELS[rt] || rt;
}

// Role -> label tiếng Việt
function toRoleLabel(role) {
  if (!role) return "";
  const r = String(role);
  if (r === "admin" || r === "admin_lv1" || r === "super_admin")
    return "Admin cấp 1";
  if (r === "admin_lv2" || r === "sub_admin") return "Admin cấp 2";
  return r;
}

function getEditPath(resourceType, id) {
  if (!resourceType || !id) return null;
  const rt = String(resourceType);

  if (rt === "food" || rt === "foods") {
    return `/foods/${id}/edit`;
  }

  if (rt === "suggestMenu" || rt === "suggest_menu") {
    return `/foods/suggest-menu/${id}/edit`;
  }

  if (rt === "suggestPlan" || rt === "suggest_plan") {
    return `/exercises/suggest-plan/${id}/edit`;
  }

  if (rt === "exercise" || rt === "exercise_strength" || rt === "exercise_cardio" || rt === "exercise_sport") {
    return `/exercises/${id}/edit`;
  }

  // Các loại khác hiện chưa có trang edit riêng
  return null;
}

// Multi-select dropdown đơn giản, giống phong cách select trong Strength_List
function MultiSelectDropdown({
  label,
  placeholder,
  options,
  values,
  onChange,
  renderOptionLabel,
}) {
  const [open, setOpen] = useState(false);

  const toggleOption = (val) => {
    if (!val) return;
    if (values.includes(val)) {
      onChange(values.filter((v) => v !== val));
    } else {
      onChange([...values, val]);
    }
  };

  const displayText = useMemo(() => {
    if (!values.length) return placeholder || label;
    if (values.length === 1) {
      const v = values[0];
      return renderOptionLabel ? renderOptionLabel(v) : v;
    }
    return `${label}: ${values.length} mục`;
  }, [values, label, placeholder, renderOptionLabel]);

  return (
    <div className="al-ms">
      <button
        type="button"
        className={
          "al-ms-trigger" + (values.length ? " al-ms-trigger--selected" : "")
        }
        onClick={() => setOpen((o) => !o)}
      >
        <span className="al-ms-trigger-text">{displayText}</span>
        <i className="fa-solid fa-caret-down" />
      </button>

      {open && (
        <div className="al-ms-menu">
          <button
            type="button"
            className="al-ms-clear"
            onClick={() => onChange([])}
          >
            <i className="fa-solid fa-xmark" />
            <span>Bỏ chọn tất cả</span>
          </button>
          <div className="al-ms-options">
            {options.map((opt) => {
              const v = opt;
              const checked = values.includes(v);
              const text = renderOptionLabel
                ? renderOptionLabel(v)
                : v || "(trống)";
              return (
                <label key={v || "_empty"} className="al-ms-option">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleOption(v)}
                  />
                  <span>{text}</span>
                </label>
              );
            })}
            {options.length === 0 && (
              <div className="al-ms-empty">Chưa có dữ liệu bộ lọc</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Audit_Log() {
  const nav = useNavigate();

  /* ------------------ Data ------------------ */
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  /* ------------------ Search & Filters ------------------ */
  const [q, setQ] = useState("");

  const [filterAdmins, setFilterAdmins] = useState([]); // multi
  const [filterRoles, setFilterRoles] = useState([]); // multi
  const [filterActions, setFilterActions] = useState([]); // multi
  const [filterResources, setFilterResources] = useState([]); // multi

  const [dateFrom, setDateFrom] = useState(""); // YYYY-MM-DD
  const [dateTo, setDateTo] = useState(""); // YYYY-MM-DD

  /* ------------------ Pagination (client-side) ------------------ */
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(0);

  /* ------------------ Load data ------------------ */
  const load = async () => {
    setLoading(true);
    try {
      // lấy tối đa ~1000 bản ghi gần nhất để tiện search + filter phía FE
      const res = await listAuditLogs({ limit: 1000 });
      const arr = Array.isArray(res?.items)
        ? res.items
        : Array.isArray(res)
        ? res
        : [];
      setItems(arr);
    } catch (e) {
      console.error(e);
      toast.error("Không tải được nhật ký thao tác");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------ Helpers ------------------ */

  const fmtDateTime = (v) => {
    if (!v) return "—";
    try {
      return new Date(v).toLocaleString();
    } catch {
      return String(v);
    }
  };

  const getShortId = (id) => {
    if (!id) return "";
    const s = String(id);
    if (!s) return "";
    return `#${s.slice(-6)}`;
  };

  const getAdminName = (it) =>
    it.adminNickname ||
    it.adminName ||
    it.admin?.nickname ||
    it.admin?.name ||
    it.admin?.username ||
    "";

  const getAdminRole = (it) => {
    if (it.adminRole) return it.adminRole;
    if (it.role) return it.role;
    if (it.admin?.role) return it.admin.role;
    if (typeof it.adminLevel === "number") return `admin_lv${it.adminLevel}`;
    if (typeof it.level === "number") return `admin_lv${it.level}`;
    return "";
  };

  const getResourceType = (it) =>
    it.resourceType || it.type || it.category || "";

  const getResourceName = (it) => it.resourceName || it.resourceTitle || "";

  const getResourceId = (it) => it.resourceId || it.entityId || "";

  const getAction = (it) => it.action || "";

  /* ------------------ Unique sets for filters ------------------ */
  const uniqAdmins = useMemo(() => {
    const set = new Set();
    items.forEach((it) => {
      const v = getAdminName(it);
      if (v) set.add(v);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [items]);

  const uniqRoles = useMemo(() => {
    const set = new Set();
    items.forEach((it) => {
      const v = getAdminRole(it);
      if (v) set.add(v);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [items]);

  const uniqActions = useMemo(() => {
    const set = new Set();
    items.forEach((it) => {
      const v = getAction(it);
      if (v) set.add(v);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [items]);

  const uniqResources = useMemo(() => {
    const set = new Set();
    items.forEach((it) => {
      const v = getResourceType(it);
      if (v) set.add(v);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [items]);

  /* ------------------ Client-side filter + search ------------------ */
  const filteredItems = useMemo(() => {
    const qTrim = q.trim().toLowerCase();

    const fromMs = dateFrom
      ? new Date(`${dateFrom}T00:00:00`).getTime()
      : null;
    const toMs = dateTo
      ? new Date(`${dateTo}T23:59:59.999`).getTime()
      : null;

    return items.filter((it) => {
      const adminName = getAdminName(it);
      const roleRaw = getAdminRole(it);
      const actionRaw = getAction(it);
      const resourceTypeRaw = getResourceType(it);
      const resourceName = getResourceName(it);
      const rid = getResourceId(it);
      const createdAt = it.createdAt ? new Date(it.createdAt).getTime() : null;

      // Filter theo ngày
      if (fromMs && (!createdAt || createdAt < fromMs)) return false;
      if (toMs && (!createdAt || createdAt > toMs)) return false;

      // Multi filter (AND)
      if (filterAdmins.length && !filterAdmins.includes(adminName)) {
        return false;
      }
      if (filterRoles.length && !filterRoles.includes(roleRaw)) {
        return false;
      }
      if (filterActions.length && !filterActions.includes(actionRaw)) {
        return false;
      }
      if (
        filterResources.length &&
        !filterResources.includes(resourceTypeRaw)
      ) {
        return false;
      }

      // Search text
      if (qTrim) {
        const actionLabel = toActionLabel(actionRaw);
        const resourceLabel = toResourceLabel(resourceTypeRaw);
        const roleLabel = toRoleLabel(roleRaw);

        const haystack = [
          adminName,
          roleRaw,
          roleLabel,
          resourceTypeRaw,
          resourceLabel,
          resourceName,
          actionRaw,
          actionLabel,
          rid,
          getShortId(it._id || it.id),
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(qTrim)) return false;
      }

      return true;
    });
  }, [
    items,
    q,
    filterAdmins,
    filterRoles,
    filterActions,
    filterResources,
    dateFrom,
    dateTo,
  ]);

  /* ------------------ Pagination (client-side) ------------------ */
  const pageCount = Math.max(
    1,
    Math.ceil((filteredItems.length || 1) / pageSize)
  );
  const safePage = Math.min(page, pageCount - 1);

  const pageItems = useMemo(() => {
    const start = safePage * pageSize;
    const end = start + pageSize;
    return filteredItems.slice(start, end);
  }, [filteredItems, safePage, pageSize]);

  useEffect(() => {
    // đổi filter / search -> quay về trang 1
    setPage(0);
  }, [
    q,
    filterAdmins,
    filterRoles,
    filterActions,
    filterResources,
    dateFrom,
    dateTo,
    pageSize,
  ]);

  const handlePageChange = (delta) => {
    setPage((prev) => {
      const next = prev + delta;
      if (next < 0) return 0;
      if (next >= pageCount) return pageCount - 1;
      return next;
    });
  };

  const handlePageSizeChange = (e) => {
    setPageSize(Number(e.target.value) || 20);
  };

  const clearAllFilters = () => {
    setQ("");
    setFilterAdmins([]);
    setFilterRoles([]);
    setFilterActions([]);
    setFilterResources([]);
    setDateFrom("");
    setDateTo("");
  };

  /* ------------------ Render ------------------ */
  return (
    <div className="al-page">
      {/* breadcrumb */}
      <nav className="al-breadcrumb" aria-label="breadcrumb">
        <Link to="/dashboard">
          <i className="fa-solid fa-house" /> <span>Trang chủ</span>
        </Link>
        <span className="sep">/</span>
        <span className="grp">
          <i className="fa-solid fa-chart-line" />{" "}
          <span>Thống kê &amp; Nhật ký</span>
        </span>
        <span className="sep">/</span>
        <span className="cur">Nhật ký thao tác (Audit Log)</span>
      </nav>

      <div className="al-card">
        {/* Header */}
        <div className="al-head">
          <h2>
            Nhật ký thao tác{" "}
            <span className="al-count">({filteredItems.length})</span>
          </h2>
          <div className="al-actions">
            <button
              type="button"
              className="btn ghost"
              onClick={clearAllFilters}
            >
              <i className="fa-solid fa-eraser" />
              <span>Xoá bộ lọc</span>
            </button>
            <button type="button" className="btn ghost" onClick={load}>
              <i className="fa-solid fa-rotate-right" />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="al-filters">
          <div className="al-search">
            <i className="fa-solid fa-magnifying-glass" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo tên admin, role, hành động, tài nguyên, mã..."
            />
          </div>

          <div className="al-filter-row">
            <div className="al-filter-group">
              <span className="al-filter-label">Tên admin</span>
              <MultiSelectDropdown
                label="Admin"
                placeholder="Tất cả Admin"
                options={uniqAdmins}
                values={filterAdmins}
                onChange={setFilterAdmins}
              />
            </div>

            <div className="al-filter-group">
              <span className="al-filter-label">Role</span>
              <MultiSelectDropdown
                label="Role"
                placeholder="Tất cả Role"
                options={uniqRoles}
                values={filterRoles}
                onChange={setFilterRoles}
                renderOptionLabel={(v) => toRoleLabel(v)}
              />
            </div>

            <div className="al-filter-group">
              <span className="al-filter-label">Hành động</span>
              <MultiSelectDropdown
                label="Hành động"
                placeholder="Tất cả hành động"
                options={uniqActions}
                values={filterActions}
                onChange={setFilterActions}
                renderOptionLabel={(v) => toActionLabel(v)}
              />
            </div>

            <div className="al-filter-group">
              <span className="al-filter-label">Loại tài nguyên</span>
              <MultiSelectDropdown
                label="Loại tài nguyên"
                placeholder="Tất cả loại"
                options={uniqResources}
                values={filterResources}
                onChange={setFilterResources}
                renderOptionLabel={(v) => toResourceLabel(v)}
              />
            </div>

            <div className="al-filter-group al-date-range">
              <span className="al-filter-label">Thời gian</span>
              <div className="al-date-row">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
                <span className="al-date-sep">đến</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="al-table">
          <div className="al-thead">
            <div className="cell stt">Stt</div>
            <div className="cell admin">Tên admin</div>
            <div className="cell role">Role</div>
            <div className="cell action">Hành động</div>
            <div className="cell rtype">Loại tài nguyên</div>
            <div className="cell rname">Tên tài nguyên</div>
            <div className="cell rid">Mã tài nguyên</div>
            <div className="cell time">Thời gian</div>
            <div className="cell op">Thao tác</div>
          </div>

          {loading && <div className="al-empty">Đang tải...</div>}

          {!loading && filteredItems.length === 0 && (
            <div className="al-empty">
              Không có bản ghi phù hợp với bộ lọc hiện tại.
            </div>
          )}

          {!loading &&
            pageItems.map((it, idx) => {
              const rowIndex = safePage * pageSize + idx + 1;

              const adminName = getAdminName(it) || "—";
              const roleRaw = getAdminRole(it) || "";
              const roleLabel = toRoleLabel(roleRaw) || "—";

              const actionRaw = getAction(it) || "";
              const actionLabel = toActionLabel(actionRaw) || "—";

              const resourceTypeRaw = getResourceType(it) || "";
              const resourceLabel = toResourceLabel(resourceTypeRaw) || "—";

              const resourceName = getResourceName(it) || "—";
              const resourceId = getResourceId(it);

              const editPath = getEditPath(resourceTypeRaw, resourceId);

              return (
                <div key={it._id || it.id} className="al-trow">
                  <div className="cell stt">{rowIndex}</div>

                  <div className="cell admin">
                    <div className="al-admin-name">{adminName}</div>
                    {it.admin?.username && (
                      <div className="al-admin-sub">
                        @{it.admin.username}
                      </div>
                    )}
                  </div>

                  <div className="cell role">
                    {roleRaw ? (
                      <span className="al-tag al-tag--role">
                        {roleLabel}
                      </span>
                    ) : (
                      "—"
                    )}
                  </div>

                  <div className="cell action">
                    <span
                      className={`al-tag al-tag--act al-act-${actionRaw}`}
                    >
                      {actionLabel}
                    </span>
                  </div>

                  <div className="cell rtype">
                    {resourceTypeRaw ? (
                      <span className="al-tag al-tag--rtype">
                        {resourceLabel}
                      </span>
                    ) : (
                      "—"
                    )}
                  </div>

                  <div className="cell rname">
                    <div className="al-res-name">{resourceName}</div>
                  </div>

                  <div className="cell rid">
                    {resourceId ? (
                      <>
                        <div className="al-res-id-short">
                          {getShortId(resourceId)}
                        </div>
                        <div
                          className="al-res-id-full"
                          title={resourceId}
                        >
                          {resourceId}
                        </div>
                      </>
                    ) : (
                      "—"
                    )}
                  </div>

                  <div className="cell time">
                    <div className="al-time">
                      {fmtDateTime(it.createdAt)}
                    </div>
                  </div>

                  <div className="cell op">
                    {editPath ? (
                      <button
                        type="button"
                        className="iconbtn"
                        title="Mở trang chỉnh sửa"
                        onClick={() => nav(editPath)}
                      >
                        <i className="fa-regular fa-pen-to-square" />
                      </button>
                    ) : (
                      <span className="al-op-disabled">—</span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Pagination */}
        <div className="al-pagination">
          <div className="per-page">
            <span>Hiển thị:</span>
            <select value={pageSize} onChange={handlePageSizeChange}>
              <option value="10">10 hàng</option>
              <option value="20">20 hàng</option>
              <option value="50">50 hàng</option>
            </select>
            <span>
              | Tổng: <strong>{filteredItems.length}</strong>
            </span>
          </div>
          <div className="page-nav">
            <span className="page-info">
              Trang {safePage + 1} / {pageCount}
            </span>
            <button
              className="btn-page"
              onClick={() => handlePageChange(-1)}
              disabled={safePage === 0}
            >
              <i className="fa-solid fa-chevron-left" />
            </button>
            <button
              className="btn-page"
              onClick={() => handlePageChange(1)}
              disabled={safePage >= pageCount - 1}
            >
              <i className="fa-solid fa-chevron-right" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
