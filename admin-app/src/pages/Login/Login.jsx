import React, { useState } from "react";
import { useAuth } from "../../auth/AuthContext.jsx";
import "./Login.css";

export default function Login(){
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      await login({ username, password }); // 👈 dùng username
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Đăng nhập thất bại");
    } finally { setLoading(false); }
  };

  return (
    <div className="lg-wrap">
      <div className="lg-left">
        <div className="lg-icon">✺</div>
        <h1>Hello FitMatch Admin! 👋</h1>
        <p>Skip repetitive admin tasks. Stay productive and save tons of time!</p>
        <div className="lg-copy">© FitMatch {new Date().getFullYear()}</div>
      </div>

      <div className="lg-right">
        <h2>Welcome Back!</h2>
        <form onSubmit={submit} className="lg-form">
          <label>Tài khoản</label>
          <input
            autoFocus
            value={username}
            onChange={e=>setUsername(e.target.value)}
            placeholder="admin_lv1"
          />

          <label>Mật khẩu</label>
          <input
            type="password"
            value={password}
            onChange={e=>setPassword(e.target.value)}
            placeholder="•••••••"
          />

          {err && <div className="lg-error">{err}</div>}
          <button disabled={loading}>{loading ? "Đang đăng nhập..." : "Login Now"}</button>
        </form>
      </div>
    </div>
  );
}
