import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthLayout from "../Style/AuthLayout";
import "../Style/style.css";
import { api } from "../../lib/api";

export default function Register() {
  const nav = useNavigate();

  const [username, setUsername] = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showCfm,  setShowCfm]  = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState({}); // { username, email, password, confirm, global }

const validate = () => {
  // Nếu thiếu bất kỳ trường nào → chỉ 1 câu chung
  if (!username.trim() || !email.trim() || !password || !confirm) {
    setErr({ single: "Vui lòng nhập đầy đủ các trường" });
    return false;
  }
  // Đã nhập đủ → kiểm tra quy tắc, vẫn gom về 1 dòng
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    setErr({ single: "Định dạng email không hợp lệ" });
    return false;
  }
  if (password.length < 6) {
    setErr({ single: "Mật khẩu phải có ít nhất 6 ký tự" });
    return false;
  }
  if (confirm !== password) {
    setErr({ single: "Mật khẩu xác nhận không khớp" });
    return false;
  }
  setErr({});
  return true;
};

  const onSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", {
        username, email, password, confirmPassword: confirm
      });
      if (data?.token) {
        localStorage.setItem("token", data.token);
        if (data.user?.role) localStorage.setItem("role", data.user.role);
      }
      if (data?.success || data?.token) nav("/login");
      else setErr({ global: data?.message || "Đăng ký thất bại." });
    } catch (error) {
      setErr({ global: error?.response?.data?.message || "Đăng ký thất bại." });
    } finally { setLoading(false); }
  };

  const renderSignIn = <div />;

  const renderSignUp = (
    <form className="auth-form" noValidate onSubmit={onSubmit} style={{ width:"100%", maxWidth: 520 }}>
      <h1>Tạo tài khoản</h1>

      <div className="auth-social">
        <a href="#" className="icon" aria-label="Google"><i className="fa-brands fa-google"></i></a>
        <a href="#" className="icon" aria-label="Facebook"><i className="fa-brands fa-facebook-f"></i></a>
      </div>

      <span>hoặc đăng ký tài khoản</span>

      {/* Username */}
      <input
        className="auth-input"
        type="text"
        id="reg-username"
        placeholder="Tên tài khoản"
        value={username}
        onChange={(e)=>setUsername(e.target.value)}
        required autoComplete="username"
      />
      {/* KHÔNG render lỗi tại chỗ */}

      {/* Email */}
      <input
        className="auth-input"
        type="email"
        id="reg-email"
        placeholder="Email"
        value={email}
        onChange={(e)=>setEmail(e.target.value)}
        required autoComplete="email"
      />
      {/* KHÔNG render lỗi tại chỗ */}

      {/* Password + eye */}
      <div className="field">
        <input
          className="auth-input"
          type={showPass ? "text" : "password"}
          id="reg-password"
          placeholder="Mật khẩu"
          value={password}
          onChange={(e)=>setPassword(e.target.value)}
          required autoComplete="new-password"
        />
        <button type="button" className="eye-toggle" onClick={()=>setShowPass(v=>!v)} aria-label="Hiện/ẩn mật khẩu">
          <i className={`fa-solid ${showPass ? "fa-eye-slash" : "fa-eye"}`}></i>
        </button>
      </div>
      {/* KHÔNG render lỗi tại chỗ */}

      {/* Confirm + eye */}
      <div className="field">
        <input
          className="auth-input"
          type={showCfm ? "text" : "password"}
          id="reg-confirm"
          placeholder="Xác nhận mật khẩu"
          value={confirm}
          onChange={(e)=>setConfirm(e.target.value)}
          required autoComplete="new-password"
        />
        <button type="button" className="eye-toggle" onClick={()=>setShowCfm(v=>!v)} aria-label="Hiện/ẩn mật khẩu">
          <i className={`fa-solid ${showCfm ? "fa-eye-slash" : "fa-eye"}`}></i>
        </button>
      </div>

      <div className="error-stack" aria-live="polite">
        {err.single && <span className="error-item">{err.single}</span>}
        {err.global && <span className="error-item">{err.global}</span>}
      </div>

      <button type="submit" className={`material-btn ${loading ? "loading" : ""}`} disabled={loading} style={{ marginTop: 6 }}>
        <span className="btn-text">Đăng ký</span>
        <div className="btn-loader"></div>
      </button>

      {/* Không cần "Đã có tài khoản?" vì đã có nút ở panel trái */}
    </form>
  );

  return <AuthLayout mode="register" renderSignIn={renderSignIn} renderSignUp={renderSignUp} />;
}
