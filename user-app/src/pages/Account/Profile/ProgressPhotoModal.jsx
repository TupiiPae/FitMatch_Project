// user-app/src/pages/Account/Profile/ProgressPhotoModal.jsx
import React, { useState } from "react";
import api from "../../../lib/api";
import { toast } from "react-toastify";

const TABS = [
  { id: "front", label: "Mặt trước" },
  { id: "side", label: "Mặt hông" },
  { id: "back", label: "Mặt sau" },
];

export default function ProgressPhotoModal({
  initialTab = "front",
  onClose,
  onUploaded,
}) {
  const [tab, setTab] = useState(
    TABS.some((t) => t.id === initialTab) ? initialTab : "front"
  );
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  const [takenAt, setTakenAt] = useState("");
  const [uploading, setUploading] = useState(false);

  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) {
      setFile(null);
      setPreview("");
      return;
    }
    if (!f.type.startsWith("image/")) {
      toast.error("Vui lòng chọn tệp hình ảnh");
      return;
    }
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Vui lòng chọn ảnh trước");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      // dùng chung middleware uploadAvatarSingle => field "avatar"
      formData.append("avatar", file);
      formData.append("type", tab);
      if (takenAt) formData.append("takenAt", takenAt);

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
      setUploading(false);
    }
  };

  return (
    <div className="bp-modal">
      <div
        className="bp-modal-backdrop"
        onClick={() => !uploading && onClose && onClose()}
      />
      <div className="bp-modal-card bp-photo-modal-card">
        <h3 className="bp-modal-title">Thêm ảnh tiến độ</h3>

        {/* Tabs chọn loại ảnh */}
        <div className="bp-photo-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`bp-tab ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
              disabled={uploading}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Form chọn file + ngày chụp */}
        <div className="bp-photo-form">
          <label className="bp-photo-label">
            Chọn ảnh
            <input
              type="file"
              accept="image/*"
              onChange={onFileChange}
              disabled={uploading}
            />
          </label>

          <label className="bp-photo-label">
            Ngày chụp (tuỳ chọn)
            <input
              type="date"
              value={takenAt}
              onChange={(e) => setTakenAt(e.target.value)}
              disabled={uploading}
            />
          </label>
        </div>

        {/* Preview */}
        <div className="bp-photo-preview">
          {preview ? (
            <img src={preview} alt="Preview" className="bp-photo-img" />
          ) : (
            <div className="bp-photo-placeholder">
              Chưa có ảnh xem trước. Vui lòng chọn ảnh.
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="bp-modal-actions">
          <button
            className="bp-btn bp-btn-outline"
            onClick={() => !uploading && onClose && onClose()}
            disabled={uploading}
          >
            Hủy
          </button>
          <button
            className="bp-btn bp-btn-primary"
            onClick={handleUpload}
            disabled={uploading}
          >
            {uploading ? "Đang tải..." : "Tải ảnh"}
          </button>
        </div>
      </div>
    </div>
  );
}
