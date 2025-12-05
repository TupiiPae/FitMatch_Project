// user-app/src/pages/Account/Profile/ProgressPhotoModal.jsx
import React, { useEffect, useMemo, useState } from "react";
import api from "../../../lib/api";
import { toast } from "react-toastify";

const TABS = [
  { id: "front", label: "Mặt trước" },
  { id: "side", label: "Mặt hông" },
  { id: "back", label: "Mặt sau" },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function ProgressPhotoModal({
  mode = "create", // "create" | "edit"
  photo = null, // khi edit: { _id, view, url, takenAt, caption }
  initialTab = "front",
  onClose,
  onUploaded, // sau khi tạo / sửa / xoá thành công => BodyProfile sẽ reload
  onDeleted, // callback riêng cho xoá khi edit (nếu cần)
}) {
  const isEdit = mode === "edit" && !!photo;

  const [tab, setTab] = useState("front");
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [takenAt, setTakenAt] = useState(todayISO());
  const [caption, setCaption] = useState("");
  const [loading, setLoading] = useState(false);

  // 🔹 Modal xác nhận xoá
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Khi mở modal thì khoá scroll nền
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev || "";
    };
  }, []);

  // Khởi tạo state theo mode / photo
  useEffect(() => {
    if (isEdit) {
      setTab(photo.view || "front");
      setPreview(photo.url || "");
      setTakenAt(
        photo.takenAt
          ? new Date(photo.takenAt).toISOString().slice(0, 10)
          : todayISO()
      );
      setCaption(photo.caption || "");
    } else {
      const init =
        TABS.some((t) => t.id === initialTab) ? initialTab : "front";
      setTab(init);
      setTakenAt(todayISO());
      setCaption("");
      setFile(null);
      setPreview("");
    }
  }, [isEdit, photo, initialTab]);

  const charCount = caption.length;
  const remaining = 300 - charCount;

  const onFileChange = (f) => {
    if (!f) {
      setFile(null);
      setPreview("");
      return;
    }
    if (!f.type.startsWith("image/")) {
      toast.error("Vui lòng chọn tệp hình ảnh (JPEG/PNG)");
      return;
    }
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const handleFileInputChange = (e) => {
    const f = e.target.files?.[0];
    if (isEdit) return; // không cho đổi ảnh khi chỉnh sửa
    onFileChange(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isEdit) return;
    const f = e.dataTransfer.files?.[0];
    onFileChange(f);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // 🔹 Nút "Xóa ảnh" (ở modal chính)
  const handleDelete = () => {
    if (isEdit) {
      const photoId = photo?._id || photo?.id;
      if (!photoId) {
        toast.error("Không xác định được ảnh để xoá (thiếu ID).");
        return;
      }
      // mở modal xác nhận xoá
      setShowConfirmDelete(true);
    } else {
      // create mode: Xóa ảnh đang chọn (clear file + preview)
      setFile(null);
      setPreview("");
    }
  };

  // 🔹 Xác nhận xoá vĩnh viễn (modal confirm)
  const handleConfirmDelete = async () => {
    if (!isEdit) return;
    const photoId = photo?._id || photo?.id;
    if (!photoId) {
      toast.error("Không xác định được ảnh để xoá (thiếu ID).");
      setShowConfirmDelete(false);
      return;
    }

    setLoading(true);
    try {
      await api.delete(`/user/progress-photo/${photoId}`);
      toast.success("Đã xoá ảnh tiến độ");
      setShowConfirmDelete(false);
      if (typeof onDeleted === "function") {
        await onDeleted();
      } else if (typeof onUploaded === "function") {
        await onUploaded();
      }
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        "Xoá ảnh thất bại, vui lòng thử lại";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Nút chính: "Lưu" (edit) / "Tải ảnh" (create)
  const handlePrimary = async () => {
    if (isEdit) {
      const photoId = photo?._id || photo?.id;
      if (!photoId) {
        toast.error("Không xác định được ảnh để chỉnh sửa (thiếu ID).");
        return;
      }

      setLoading(true);
      try {
        await api.patch(`/user/progress-photo/${photoId}`, {
          type: tab,
          takenAt: takenAt || undefined,
          caption,
        });
        toast.success("Đã lưu chỉnh sửa ảnh");
        if (typeof onUploaded === "function") {
          await onUploaded();
        }
      } catch (e) {
        const msg =
          e?.response?.data?.message ||
          e?.message ||
          "Lưu chỉnh sửa thất bại";
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    } else {
      // CREATE: phải có file
      if (!file) {
        toast.error("Vui lòng chọn ảnh trước");
        return;
      }
      setLoading(true);
      try {
        const formData = new FormData();
        formData.append("avatar", file);
        formData.append("type", tab);
        if (takenAt) formData.append("takenAt", takenAt);
        if (caption) formData.append("caption", caption);

        await api.post("/user/progress-photo", formData);
        toast.success("Tải ảnh tiến độ thành công!");
        if (typeof onUploaded === "function") {
          await onUploaded();
        } else if (typeof onClose === "function") {
          onClose();
        }
      } catch (e) {
        const msg =
          e?.response?.data?.message ||
          e?.message ||
          "Tải ảnh thất bại, vui lòng thử lại";
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleClose = () => {
    if (loading) return;
    if (typeof onClose === "function") onClose();
  };

  const title = isEdit ? "Chỉnh sửa ảnh tiến độ" : "Thêm ảnh tiến độ";

  const helperText = useMemo(() => {
    if (tab === "front")
      return "Ảnh mặt trước với toàn thân hoặc nửa người, ánh sáng tốt, phông nền rõ ràng.";
    if (tab === "side")
      return "Ảnh chụp từ bên hông để dễ thấy đường cong cơ thể.";
    return "Ảnh chụp mặt sau với phông nền và ánh sáng ổn định.";
  }, [tab]);

  return (
    <div className="bp-modal">
      <div className="bp-modal-backdrop" onClick={handleClose} />
      <div className="bp-modal-card bp-photo-modal-card">
        <h3 className="bp-modal-title">{title}</h3>

        <div className="bp-photo-layout">
          {/* CỘT TRÁI: khung ảnh / dropzone */}
          <div
            className={`bp-photo-left ${
              isEdit ? "bp-photo-left-readonly" : ""
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
          >
            {!isEdit && (
              <input
                id="bp-photo-file-input"
                type="file"
                accept="image/*"
                onChange={handleFileInputChange}
                disabled={loading}
                style={{ display: "none" }}
              />
            )}

            <div
              className="bp-photo-dropzone"
              onClick={() => {
                if (isEdit || loading) return;
                const el = document.getElementById("bp-photo-file-input");
                if (el) el.click();
              }}
            >
              {preview ? (
                <img
                  src={preview}
                  alt="Preview"
                  className="bp-photo-img-full"
                />
              ) : (
                <div className="bp-photo-drop-inner">
                  <div className="bp-photo-upload-icon">
                    <i className="fa-regular fa-image"></i>
                  </div>
                  <div className="bp-photo-drop-title">
                    Chọn ảnh hoặc kéo thả vào đây
                  </div>
                  <div className="bp-photo-drop-sub">
                    Hỗ trợ JPEG / PNG, tối đa ~5MB
                  </div>
                  {isEdit && (
                    <div className="bp-photo-drop-note">
                      Chế độ chỉnh sửa: không thể thay đổi ảnh.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* CỘT PHẢI: tab + ngày + mô tả */}
          <div className="bp-photo-right">
            {/* Tabs loại ảnh */}
            <div className="bp-photo-tabs">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`modal-bp-tab ${tab === t.id ? "active" : ""}`}
                  onClick={() => setTab(t.id)}
                  disabled={loading}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Mô tả loại ảnh */}
            <div className="bp-photo-helper">
              <div className="bp-photo-helper-title">
                {tab === "front"
                  ? "Ảnh mặt trước"
                  : tab === "side"
                  ? "Ảnh mặt hông"
                  : "Ảnh mặt sau"}
              </div>
              <div className="bp-photo-helper-text">{helperText}</div>
            </div>

            {/* Ngày chụp */}
            <div className="bp-photo-form-row">
              <label className="bp-photo-label">
                Ngày chụp
                <input
                  type="date"
                  value={takenAt}
                  onChange={(e) => setTakenAt(e.target.value)}
                  disabled={loading}
                />
                <i className="fa-solid fa-calendar-days bp-date-icon"></i>
              </label>
            </div>

            {/* Mô tả */}
            <div className="bp-photo-caption-wrap">
              <label className="bp-photo-label">
                Mô tả (không bắt buộc)
                <textarea
                  rows={10}
                  maxLength={300}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  disabled={loading}
                  placeholder="Nhập mô tả cho ảnh tiến độ của bạn..."
                />
              </label>
              <div className="bp-photo-caption-counter">
                {charCount}/{300}
              </div>
            </div>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="bp-modal-actions bp-photo-actions">
          <button
            className="bp-btn bp-btn-outline bp-photo-delete"
            onClick={handleDelete}
            disabled={loading}
          >
            Xóa ảnh
          </button>
          <div className="bp-photo-actions-right">
            <button
              className="bp-btn bp-btn-outline"
              onClick={handleClose}
              disabled={loading}
            >
              Hủy
            </button>
            <button
              className="bp-btn bp-btn-primary"
              onClick={handlePrimary}
              disabled={loading}
            >
              {loading
                ? isEdit
                  ? "Đang lưu..."
                  : "Đang tải..."
                : isEdit
                ? "Lưu"
                : "Tải ảnh"}
            </button>
          </div>
        </div>
      </div>

      {/* 🔹 Modal xác nhận xoá ảnh vĩnh viễn (chỉ khi edit) */}
      {isEdit && showConfirmDelete && (
        <div className="bp-confirm-overlay">
          <div className="bp-confirm-card">
            <h4 className="bp-confirm-title">Xoá ảnh tiến độ?</h4>
            <p className="bp-confirm-text">
              Hành động này sẽ <strong>xóa vĩnh viễn</strong> ảnh khỏi hồ sơ
              của bạn và không thể hoàn tác.
            </p>
            <div className="bp-confirm-actions">
              <button
                type="button"
                className="bp-btn bp-btn-outline"
                onClick={() => !loading && setShowConfirmDelete(false)}
                disabled={loading}
              >
                Hủy
              </button>
              <button
                type="button"
                className="bp-btn bp-btn-primary bp-confirm-danger"
                onClick={handleConfirmDelete}
                disabled={loading}
              >
                {loading ? "Đang xoá..." : "Xoá vĩnh viễn"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
