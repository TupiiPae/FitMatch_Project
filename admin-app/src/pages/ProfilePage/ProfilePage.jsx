// src/pages/ProfilePage/ProfilePage.jsx
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { adminMe, updateMyAdminProfile, changeMyAdminPassword } from "../../lib/api";
import "./ProfilePage.css";

// Nickname: chữ (có dấu), số, khoảng trắng; tối đa 30
const NICKNAME_RE = /^(?=.{1,30}$)[\p{L}\p{M}\d ]+$/u;
// Password: không bắt buộc, tối thiểu 6, tối đa 50, chấp nhận mọi ký tự
const PASSWORD_MIN = 6;
const PASSWORD_MAX = 50;

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState(null);

  const [origNickname, setOrigNickname] = useState("");

  const [nickname, setNickname] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [errNick, setErrNick] = useState("");
  const [errCur, setErrCur] = useState("");
  const [errPass, setErrPass] = useState("");
  const [errCfm, setErrCfm] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const me = await adminMe();
        const lv = Number(me?.level ?? 0);
        setLevel(lv);
        const currentNickname = me?.nickname || me?.username || "";
        setOrigNickname(currentNickname);
        setNickname(currentNickname);
      } catch {
        toast.error("Không tải được thông tin tài khoản.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const validateNickname = (v, compareWith) => {
    const val = (v || "").trim();
    if (val === compareWith) return "";
    if (!val) return "Vui lòng nhập nickname.";
    if (!NICKNAME_RE.test(val))
      return "Chỉ cho phép chữ (có dấu), số, khoảng trắng và tối đa 30 ký tự.";
    return "";
  };

  const validatePasswordGroup = (cur, pass, cfm) => {
    // nếu cả 3 trống -> không đổi mật khẩu
    if (!cur && !pass && !cfm) return { cur: "", pass: "", cfm: "", want: false };

    let curErr = "";
    let passErr = "";
    let cfmErr = "";

    if (!cur) curErr = "Vui lòng nhập mật khẩu hiện tại để xác nhận.";

    if (!pass && (cfm || cur)) {
      passErr = "Vui lòng nhập mật khẩu mới.";
    } else if (pass) {
      if (pass.length < PASSWORD_MIN) {
        passErr = `Mật khẩu tối thiểu ${PASSWORD_MIN} ký tự.`;
      } else if (pass.length > PASSWORD_MAX) {
        passErr = `Mật khẩu tối đa ${PASSWORD_MAX} ký tự.`;
      }
    }

    if (pass && pass !== cfm) cfmErr = "Mật khẩu xác nhận không khớp.";

    return { cur: curErr, pass: passErr, cfm: cfmErr, want: true };
  };

  const validateAll = () => {
    if (Number(level) !== 2) {
      toast.error("Chỉ Admin cấp 2 mới được phép chỉnh sửa.");
      return false;
    }

    const nickErr = validateNickname(nickname, origNickname);
    const { cur, pass, cfm, want } = validatePasswordGroup(
      currentPassword,
      password,
      confirmPassword
    );

    setErrNick(nickErr);
    setErrCur(cur);
    setErrPass(pass);
    setErrCfm(cfm);

    const okNick = !nickErr;
    const okPass = !want || (!cur && !pass && !cfm);
    const allOk = okNick && okPass;

    if (!allOk) toast.error("Vui lòng sửa lỗi trước khi lưu.");
    return allOk;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateAll()) return;

    const changedNickname = (nickname || "").trim() !== origNickname;
    const wantChangePassword = Boolean(currentPassword || password || confirmPassword);

    try {
      if (changedNickname) {
        await updateMyAdminProfile({ nickname: nickname.trim() });
        setOrigNickname(nickname.trim());
      }
      if (wantChangePassword) {
        await changeMyAdminPassword({
          currentPassword,
          newPassword: password,
        });
        setCurrentPassword("");
        setPassword("");
        setConfirmPassword("");
      }

      if (!changedNickname && !wantChangePassword) {
        toast.info("Không có thay đổi nào để lưu.");
      } else if (changedNickname && wantChangePassword) {
        toast.success("Đã cập nhật nickname và mật khẩu!");
      } else if (changedNickname) {
        toast.success("Cập nhật nickname thành công!");
      } else {
        toast.success("Đổi mật khẩu thành công!");
      }
    } catch (e2) {
      const msg =
        e2?.response?.data?.message || "Cập nhật thất bại. Vui lòng thử lại.";
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
          <form id="profile-form" onSubmit={handleSubmit} noValidate className="pf-form">
            {/* Nickname */}
            <div className={`pf-field ${errNick ? "has-error" : ""}`}>
              <input
                id="pf-nickname"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  if (errNick) setErrNick(validateNickname(e.target.value, origNickname));
                }}
                onBlur={(e) => setErrNick(validateNickname(e.target.value, origNickname))}
                maxLength={30}
                placeholder=" "
                disabled={disabled}
                aria-invalid={!!errNick}
                aria-describedby={errNick ? "err-pf-nick" : undefined}
              />
              <label htmlFor="pf-nickname">Tên hiển thị (nickname)</label>
              {errNick && <div id="err-pf-nick" className="pf-error">{errNick}</div>}
            </div>

            <p className="fm-form-divider">Thay đổi mật khẩu</p>

            {/* Current password */}
            <div className={`pf-field ${errCur ? "has-error" : ""}`}>
              <input
                id="pf-current"
                type="password"
                value={currentPassword}
                onChange={(e) => {
                  setCurrentPassword(e.target.value);
                  if (errCur || errPass || errCfm) {
                    const v = validatePasswordGroup(e.target.value, password, confirmPassword);
                    setErrCur(v.cur); setErrPass(v.pass); setErrCfm(v.cfm);
                  }
                }}
                placeholder=" "
                maxLength={PASSWORD_MAX}
                disabled={disabled}
                aria-invalid={!!errCur}
                aria-describedby={errCur ? "err-pf-cur" : undefined}
              />
              <label htmlFor="pf-current">Mật khẩu hiện tại</label>
              {errCur && <div id="err-pf-cur" className="pf-error">{errCur}</div>}
            </div>

            {/* New password */}
            <div className={`pf-field ${errPass ? "has-error" : ""}`}>
              <input
                id="pf-pass"
                type="password"
                value={password}
                onChange={(e) => {
                  const v = e.target.value;
                  setPassword(v);
                  if (v && v.length < PASSWORD_MIN) {
                    setErrPass(`Mật khẩu tối thiểu ${PASSWORD_MIN} ký tự.`);
                  } else if (v.length > PASSWORD_MAX) {
                    setErrPass(`Mật khẩu tối đa ${PASSWORD_MAX} ký tự.`);
                  } else {
                    const g = validatePasswordGroup(currentPassword, v, confirmPassword);
                    setErrCur(g.cur); setErrPass(g.pass); setErrCfm(g.cfm);
                  }
                }}
                placeholder=" "
                maxLength={PASSWORD_MAX}
                disabled={disabled}
                aria-invalid={!!errPass}
                aria-describedby={errPass ? "err-pf-pass" : undefined}
              />
              <label htmlFor="pf-pass">Mật khẩu mới (tùy chọn)</label>
              {errPass && <div id="err-pf-pass" className="pf-error">{errPass}</div>}
            </div>

            {/* Confirm password */}
            <div className={`pf-field ${errCfm ? "has-error" : ""}`}>
              <input
                id="pf-cfm"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  const v = validatePasswordGroup(currentPassword, password, e.target.value);
                  setConfirmPassword(e.target.value);
                  setErrCur(v.cur); setErrPass(v.pass); setErrCfm(v.cfm);
                }}
                placeholder=" "
                maxLength={PASSWORD_MAX}
                disabled={disabled}
                aria-invalid={!!errCfm}
                aria-describedby={errCfm ? "err-pf-cfm" : undefined}
              />
              <label htmlFor="pf-cfm">Xác nhận mật khẩu mới</label>
              {errCfm && <div id="err-pf-cfm" className="pf-error">{errCfm}</div>}
            </div>
          </form>

          {loading && <div className="fm-muted">Đang tải thông tin…</div>}
          {Number(level) !== 2 && !loading && (
            <div className="fm-note">Chỉ Admin cấp 2 mới được phép chỉnh sửa thông tin này.</div>
          )}
        </div>
      </div>
    </div>
  );
}
