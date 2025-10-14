import React, { useEffect, useMemo, useRef, useState } from "react";
import "./Account.css";
import { getMe } from "../../../api/account";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCamera } from "@fortawesome/free-solid-svg-icons";

const fallbackUser = {
  username: "tupaedev",
  createdAt: null,
  email: "tupae@example.com", // email ở root
  profile: { nickname: "Tupae", sex: "male", dob: "2003-01-01" },
};

export default function AccountInfo() {
  const [user, setUser] = useState(fallbackUser);
  const [loaded, setLoaded] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState("/images/avatar.png");
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await getMe();
        if (me && typeof me === "object") {
          setUser((prev) => ({
            ...prev,
            ...me,
            profile: { ...(prev.profile || {}), ...(me.profile || {}) },
          }));
        }
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const p = user?.profile || {};
  const [form, setForm] = useState({
    nickname: p.nickname || "",
    dob: p.dob || "",
    sex: p.sex || "male",
    email: user?.email || "", // email từ root user
  });

  useEffect(() => {
    setForm((f) => ({
      ...f,
      nickname: p.nickname || "",
      dob: p.dob || "",
      sex: p.sex || "male",
      email: user?.email || "",
    }));
    // phụ thuộc vào các giá trị thực sự thay đổi
  }, [p.nickname, p.dob, p.sex, user?.email]);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const pickAvatar = () => fileRef.current?.click();
  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
    // TODO: upload avatar
  };
  const onSubmit = (e) => {
    e.preventDefault();
    // TODO: call API update profile + email (root)
  };

  const maskedPassword = "********";
  const SHOW_LONG_BUTTON_UNDER_AVATAR = false;

  return (
    // BỎ className="acc-page" ở đây, scope đã đặt ở layout
    <form className="card acc-card" onSubmit={onSubmit}>
      <h2 className="pf-title">Thông tin tài khoản</h2>

      {/* AVATAR giữa, phía trên ghi chú */}
      <div className="acc-hero">
        <div className="acc-avatarWrap">
          <div className="acc-avatar">
            <img src={avatarPreview} alt="avatar" />
          </div>

          <button
            className="acc-avatar-btn"
            title="Đổi avatar"
            aria-label="Đổi avatar"
            type="button"
            onClick={pickAvatar}
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

        {SHOW_LONG_BUTTON_UNDER_AVATAR && (
          <button type="button" className="acc-change-btn" onClick={pickAvatar}>
            <FontAwesomeIcon icon={faCamera} />
            <span>Thay đổi hình ảnh</span>
          </button>
        )}
      </div>

      {/* Khung dữ liệu */}
      <div className="acc-frame">
        <div className="pf-form-row">
          <label>Nickname</label>
          <input
            name="nickname"
            value={form.nickname}
            onChange={onChange}
            placeholder="Nhập nickname"
          />
        </div>

        <div className="pf-form-2">
          <div className="pf-form-cell">
            <label>Ngày sinh</label>
            <input
              type="date"
              name="dob"
              value={form.dob || ""}
              onChange={onChange}
            />
          </div>

          <div className="pf-form-cell">
            <label>Giới tính</label>
            <div className="seg-group" role="tablist" aria-label="Giới tính">
              <label className="seg-option">
                <input
                  type="radio"
                  name="sex"
                  value="male"
                  checked={form.sex === "male"}
                  onChange={onChange}
                />
                <span className="seg-btn">Nam</span>
              </label>
              <label className="seg-option">
                <input
                  type="radio"
                  name="sex"
                  value="female"
                  checked={form.sex === "female"}
                  onChange={onChange}
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
          />
        </div>

        <div className="pf-form-row" data-readonly>
          <label>Tài khoản đăng nhập</label>
          <input value={user?.username || ""} disabled />
        </div>

        <div className="pf-form-row" data-readonly>
          <label>Mật khẩu đăng nhập</label>
          <input type="password" value={maskedPassword} disabled />
        </div>
      </div>

      <div className="pf-actions pf-actions-right">
        <button className="btn-success" type="submit">Cập nhật</button>
      </div>

      {!loaded && <div className="acc-loading">Đang tải dữ liệu tài khoản…</div>}
    </form>
  );
}
