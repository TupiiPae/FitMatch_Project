// src/pages/Account/AccountSettings/Account.jsx
import React, { useEffect, useRef, useState } from "react";
import "./Account.css";
import { getMe } from "../../../api/account";
import api from "../../../lib/api";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCamera } from "@fortawesome/free-solid-svg-icons";
import { toast } from "react-toastify";
import AvatarCropper from "../../../components/AvatarCropper";

// ===== Helper: build absolute URL từ api.defaults.baseURL =====
const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try {
    return new URL(u, API_ORIGIN).toString();
  } catch {
    return u; // nếu đã là absolute thì để nguyên
  }
};

// Hiển thị "DD/MM/YYYY" từ "YYYY-MM-DD"
function formatDobDMY(dob, fallback = "") {
  if (typeof dob !== "string") return fallback;
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(dob);
  if (!m) return fallback;
  const [y, mo, d] = dob.split("-");
  return `${d}/${mo}/${y}`;
}

export default function AccountInfo() {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // Edit mode
  const [edit, setEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form
  const [form, setForm] = useState({
    nickname: "",
    dob: "",
    sex: "male",
    email: "",
  });

  // Avatar (preview + file sau crop)
  const [avatarPreview, setAvatarPreview] = useState("/images/avatar.png");
  const [avatarFile, setAvatarFile] = useState(null);
  const fileRef = useRef(null);

  // Crop modal
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState(null);

  // Load me
  useEffect(() => {
    (async () => {
      try {
        const me = await getMe(); // return data.user
        if (me && typeof me === "object") setUser(me);
      } catch {
        toast.error("Không thể tải tài khoản");
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Sync form & avatar when user changes
  useEffect(() => {
    if (!user) return;
    const p = user.profile || {};
    setForm({
      nickname: p.nickname || "",
      dob: p.dob || "",
      sex: p.sex || "male",
      email: user.email || "",
    });
    setAvatarPreview(p.avatarUrl ? toAbs(p.avatarUrl) : "/images/avatar.png");
    setAvatarFile(null);
  }, [user]);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  // Cho phép chọn ảnh BẤT KỂ đang edit hay không
  const pickAvatar = () => fileRef.current?.click();

  // Mở cropper với ảnh đã chọn
  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn tệp hình ảnh (PNG/JPG)!");
      return;
    }
    const MAX = 2 * 1024 * 1024; // 2MB
    if (file.size > MAX) {
      toast.error("Kích thước ảnh tối đa 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result?.toString() || null);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
  };

  // Upload avatar ngay (dùng khi không ở chế độ edit)
  const uploadAvatarDirect = async (file) => {
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await api.post("/api/user/avatar", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const updated = res?.data?.user;
      const url = res?.data?.avatarUrl;
      if (updated) setUser(updated);
      if (url) setAvatarPreview(toAbs(url));
      toast.success("Đã cập nhật ảnh đại diện!");
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || "Tải ảnh thất bại";
      toast.error(msg);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // Nhận file đã crop (webp) từ modal
  const onCropConfirm = (fileCropped, previewUrl) => {
    setCropOpen(false);
    if (edit) {
      // Đang edit: chỉ đổi preview, chờ Lưu mới upload
      setAvatarPreview(previewUrl);
      setAvatarFile(fileCropped);
    } else {
      // Không edit: upload ngay
      setAvatarPreview(previewUrl);
      setAvatarFile(null);
      uploadAvatarDirect(fileCropped);
    }
  };

  const onCancel = () => {
    if (!user) return;
    const p = user.profile || {};
    setForm({
      nickname: p.nickname || "",
      dob: p.dob || "",
      sex: p.sex || "male",
      email: user.email || "",
    });
    // Không cache-bust — tên file BE đã duy nhất (theo timestamp)
    setAvatarPreview(p.avatarUrl ? toAbs(p.avatarUrl) : "/images/avatar.png");
    setAvatarFile(null);
    if (fileRef.current) fileRef.current.value = "";
    setEdit(false);
  };

  // Upload avatar nếu có (khi đang edit và bấm Lưu)
  const uploadAvatarIfNeeded = async () => {
    if (!avatarFile) return null;
    const fd = new FormData();
    fd.append("avatar", avatarFile);
    const res = await api.post("/api/user/avatar", fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    const updated = res?.data?.user;
    if (updated) setUser(updated);
    const url = res?.data?.avatarUrl;
    return url ? toAbs(url) : null;
  };

  const onSave = async () => {
    setSaving(true);
    try {
      // 1) upload avatar (nếu có – chỉ khi đang edit)
      const newAvatarAbs = await uploadAvatarIfNeeded();
      if (newAvatarAbs) {
        setAvatarPreview(newAvatarAbs); // Không dùng cache-busting nữa
      }

      // 2) patch thông tin (nickname/dob/sex/email)
      const payload = {
        email: form.email,
        "profile.nickname": form.nickname,
        "profile.dob": form.dob,
        "profile.sex": form.sex,
      };
      const res = await api.patch("/api/user/account", payload);
      const updated = res?.data?.user;
      if (updated) setUser(updated);

      setEdit(false);
      setAvatarFile(null);
      if (fileRef.current) fileRef.current.value = "";
      toast.success("Cập nhật tài khoản thành công!");
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || "Cập nhật thất bại";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // UI khi chưa load xong
  if (!loaded) {
    return (
      <div className="card acc-card">
        <h2 className="pf-title">Thông tin tài khoản</h2>
        <div className="acc-loading">Đang tải dữ liệu tài khoản…</div>
      </div>
    );
  }

  // UI khi load xong nhưng chưa có user
  if (!user) {
    return (
      <div className="card acc-card">
        <h2 className="pf-title">Thông tin tài khoản</h2>
        <div className="pf-error">Không tìm thấy dữ liệu tài khoản</div>
      </div>
    );
  }

  return (
    <div className="card acc-card">
      <h2 className="pf-title">Thông tin tài khoản</h2>

      {/* AVATAR */}
      <div className="acc-hero">
        <div className="acc-avatarWrap">
          <div className={`acc-avatar ${!edit ? "is-readonly" : ""}`}>
            <img src={avatarPreview} alt="avatar" />
          </div>

          <button
            className="acc-avatar-btn"
            title="Đổi avatar"
            aria-label="Đổi avatar"
            type="button"
            onClick={pickAvatar} // luôn cho phép đổi ảnh
          >
            <FontAwesomeIcon icon={faCamera} />
          </button>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="acc-file"
            onChange={onFile}
          />
        </div>

        <div className="acc-note">PNG/JPG, tối đa 2MB</div>
      </div>

      {/* FORM */}
      <div className="acc-frame">
        <div className="pf-form-row">
          <label>Nickname</label>
          <input
            name="nickname"
            value={form.nickname}
            onChange={onChange}
            placeholder="Nhập nickname"
            disabled={!edit}
          />
        </div>

        <div className="pf-form-2">
          <div className="pf-form-cell">
            <label>Ngày sinh</label>
            <div className="pf-unit">
              {!edit ? (
                <>
                  <input
                    type="text"
                    disabled
                    value={formatDobDMY(form.dob) || ""}
                    placeholder="dd/mm/yyyy"
                  />
                </>
              ) : (
                <>
                  <input
                    type="date"
                    name="dob"
                    value={form.dob || ""}
                    onChange={onChange}
                  />
                </>
              )}
            </div>
          </div>

          <div className="pf-form-cell">
            <label>Giới tính</label>
            <div className="seg-group" role="tablist" aria-label="Giới tính">
              <label className={`seg-option ${!edit ? "is-disabled" : ""}`}>
                <input
                  type="radio"
                  name="sex"
                  value="male"
                  checked={form.sex === "male"}
                  onChange={onChange}
                  disabled={!edit}
                />
                <span className="seg-btn">Nam</span>
              </label>
              <label className={`seg-option ${!edit ? "is-disabled" : ""}`}>
                <input
                  type="radio"
                  name="sex"
                  value="female"
                  checked={form.sex === "female"}
                  onChange={onChange}
                  disabled={!edit}
                />
                <span className="seg-btn">Nữ</span>
              </label>
            </div>
          </div>
        </div>

        <div className="pf-form-row">
          <label>Email</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={onChange}
            placeholder="email@domain.com"
            disabled={!edit}
          />
        </div>

        <div className="pf-form-row" data-readonly>
          <label>Tài khoản đăng nhập</label>
          <input value={user?.username || ""} disabled />
        </div>

        <div className="pf-form-row" data-readonly>
          <label>Mật khẩu đăng nhập</label>
          <input type="text" value={"********"} disabled />
        </div>
      </div>

      {/* Actions */}
      <div className="pf-actions pf-actions-right">
        {!edit ? (
          <button
            className="btn-secondary"
            type="button"
            onClick={() => setEdit(true)}
          >
            Cập nhật
          </button>
        ) : (
          <>
            <button
              className="btn-tertiary"
              type="button"
              onClick={onCancel}
              disabled={saving}
              style={{ marginRight: 8 }}
            >
              Hủy
            </button>
            <button
              className="btn-success"
              type="button"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </>
        )}
      </div>

      {/* Modal crop ảnh */}
      <AvatarCropper
        open={cropOpen}
        src={cropSrc}
        onClose={() => setCropOpen(false)}
        onConfirm={onCropConfirm}
      />
    </div>
  );
}
