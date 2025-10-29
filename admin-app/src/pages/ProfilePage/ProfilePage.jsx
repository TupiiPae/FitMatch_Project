// src/pages/ProfilePage/ProfilePage.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { adminMe, updateMyAdminProfile, changeMyAdminPassword } from "../../lib/api";
import "./ProfilePage.css";

/** Regex theo yêu cầu:
 * - Nickname: <=30, KHÔNG ký tự đặc biệt, cho phép chữ (có dấu), số, khoảng trắng
 * - Password: 6..30 ký tự, KHÔNG khoảng trắng (cho phép ký tự đặc biệt)
 */
const NICKNAME_PLAIN_REGEX = /^[\p{L}\d\s]{1,30}$/u;
const PASSWORD_REGEX = /^\S{6,30}$/;

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState(null);

  // dữ liệu ban đầu để so sánh thay đổi
  const [origNickname, setOrigNickname] = useState("");

  // form state
  const [nickname, setNickname] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // inline errors
  const [errNick, setErrNick] = useState("");
  const [errCur, setErrCur] = useState("");
  const [errPass, setErrPass] = useState("");
  const [errCfm, setErrCfm] = useState("");

  useEffect(() => {
    (async () => {
      try {
        // { id, username, nickname, role, level, status, ... } (tuỳ BE)
        const me = await adminMe();
        const lv = Number(me?.level ?? 0);
        setLevel(lv);

        const currentNickname = me?.nickname || me?.username || "";
        setOrigNickname(currentNickname);
        setNickname(currentNickname);
      } catch (e) {
        toast.error("Không tải được thông tin tài khoản.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const validate = () => {
    let ok = true;
    setErrNick("");
    setErrCur("");
    setErrPass("");
    setErrCfm("");

    if (Number(level) !== 2) {
      toast.error("Chỉ Admin cấp 2 mới được phép chỉnh sửa.");
      return false;
    }

    // Kiểm tra nickname nếu thay đổi
    const nickTrim = (nickname || "").trim();
    if (nickTrim !== origNickname) {
      if (!nickTrim || !NICKNAME_PLAIN_REGEX.test(nickTrim)) {
        setErrNick(
          "Nickname tối đa 30 ký tự, không chứa ký tự đặc biệt (cho phép chữ, số, khoảng trắng)."
        );
        ok = false;
      }
    }

    // Nếu có đổi mật khẩu → cần currentPassword + password hợp lệ + confirm khớp
    const wantChangePassword = Boolean(password || confirmPassword || currentPassword);
    if (wantChangePassword) {
      if (!currentPassword) {
        setErrCur("Vui lòng nhập mật khẩu hiện tại.");
        ok = false;
      }
      if (!PASSWORD_REGEX.test(password)) {
        setErrPass("Mật khẩu 6–30 ký tự, không chứa khoảng trắng (ký tự đặc biệt được phép).");
        ok = false;
      }
      if (password !== confirmPassword) {
        setErrCfm("Mật khẩu xác nhận không khớp.");
        ok = false;
      }
    }

    return ok;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const actions = [];
    const nickTrim = (nickname || "").trim();
    const changedNickname = nickTrim !== origNickname;
    const wantChangePassword = Boolean(password || confirmPassword || currentPassword);

    try {
      // Đổi nickname (nếu có thay đổi)
      if (changedNickname) {
        actions.push("nickname");
        await updateMyAdminProfile({ nickname: nickTrim });
        setOrigNickname(nickTrim);
      }

      // Đổi mật khẩu (nếu người dùng nhập)
      if (wantChangePassword) {
        actions.push("password");
        await changeMyAdminPassword({
          currentPassword,
          newPassword: password,
        });
        // reset trường mật khẩu sau khi đổi
        setCurrentPassword("");
        setPassword("");
        setConfirmPassword("");
      }

      if (actions.length === 0) {
        toast.info("Không có thay đổi nào để lưu.");
      } else if (actions.length === 2) {
        toast.success("Đã cập nhật nickname và mật khẩu!");
      } else if (actions[0] === "nickname") {
        toast.success("Cập nhật nickname thành công!");
      } else {
        toast.success("Đổi mật khẩu thành công!");
      }
    } catch (e) {
      const status = e?.response?.status;
      const msg =
        e?.response?.data?.message ||
        (status === 403
          ? "Bạn không có quyền cập nhật thông tin này."
          : "Cập nhật thất bại. Vui lòng thử lại.");
      toast.error(msg);
    }
  };

  const disabled = loading || Number(level) !== 2;

  return (
    <div className="fm-profile-page">
      {/* Breadcrumb */}
      <nav className="breadcrumb-nav" aria-label="breadcrumb">
        <Link to="/">
          <i className="fa-solid fa-house" aria-hidden="true"></i>
          <span>Trang chủ</span>
        </Link>
        <span className="separator">/</span>
        <span className="current-group">
          <i className="fa-solid fa-gear" aria-hidden="true"></i>
          <span>Cài đặt</span>
        </span>
        <span className="separator">/</span>
        <span className="current-page">Thông tin tài khoản</span>
      </nav>

      <div className="card">
        <div className="page-head">
          <h2>Thông tin tài khoản</h2>
          <div className="head-actions">
            <button
              type="submit"
              form="profile-form"
              className="btn primary"
              disabled={disabled}
              title={Number(level) !== 2 ? "Chỉ Admin cấp 2 được phép" : ""}
            >
              Lưu thay đổi
            </button>
          </div>
        </div>

        <div className="profile-form-content">
          <form id="profile-form" onSubmit={handleSubmit} noValidate>
            {/* Nickname */}
            <div className={`fm-form-group ${errNick ? "has-error" : ""}`}>
              <label htmlFor="nickname">Tên người quản trị</label>
              <input
                type="text"
                id="nickname"
                className="fm-input"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={30}
                disabled={disabled}
                aria-invalid={!!errNick}
                aria-describedby={errNick ? "err-nickname" : undefined}
              />
              {errNick && (
                <div id="err-nickname" className="fm-error-text">
                  {errNick}
                </div>
              )}
            </div>

            <p className="fm-form-divider">Thay đổi mật khẩu</p>

            {/* Current password */}
            <div className={`fm-form-group ${errCur ? "has-error" : ""}`}>
              <label htmlFor="currentPassword">Mật khẩu hiện tại</label>
              <input
                type="password"
                id="currentPassword"
                className="fm-input"
                placeholder="Bắt buộc nếu muốn đổi mật khẩu"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                maxLength={30}
                disabled={disabled}
                aria-invalid={!!errCur}
                aria-describedby={errCur ? "err-current" : undefined}
              />
              {errCur && (
                <div id="err-current" className="fm-error-text">
                  {errCur}
                </div>
              )}
            </div>

            {/* New password */}
            <div className={`fm-form-group ${errPass ? "has-error" : ""}`}>
              <label htmlFor="password">Mật khẩu mới</label>
              <input
                type="password"
                id="password"
                className="fm-input"
                placeholder="Bỏ trống nếu không đổi"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={30}
                disabled={disabled}
                aria-invalid={!!errPass}
                aria-describedby={errPass ? "err-password" : undefined}
              />
              {errPass && (
                <div id="err-password" className="fm-error-text">
                  {errPass}
                </div>
              )}
            </div>

            {/* Confirm */}
            <div className={`fm-form-group ${errCfm ? "has-error" : ""}`}>
              <label htmlFor="confirmPassword">Xác nhận mật khẩu mới</label>
              <input
                type="password"
                id="confirmPassword"
                className="fm-input"
                placeholder="Bỏ trống nếu không đổi"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                maxLength={30}
                disabled={disabled}
                aria-invalid={!!errCfm}
                aria-describedby={errCfm ? "err-confirm" : undefined}
              />
              {errCfm && (
                <div id="err-confirm" className="fm-error-text">
                  {errCfm}
                </div>
              )}
            </div>
          </form>

          {loading && <div className="fm-muted">Đang tải thông tin…</div>}
          {Number(level) !== 2 && !loading && (
            <div className="fm-note">
              Chỉ Admin cấp 2 mới được phép chỉnh sửa thông tin này.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
