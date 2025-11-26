// admin-app/src/pagesAdmins/Admin_Create/Admin_Create.jsx
import React, { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createAdminAccount } from "../../../lib/api.js";
import { toast } from "react-toastify";
import "./Admin_Create.css";

// MUI
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import FormHelperText from "@mui/material/FormHelperText";

const USERNAME_REGEX = /^[a-zA-Z0-9]{4,200}$/;
const NICKNAME_RE = /^(?=.{1,30}$)[\p{L}\p{M}\d ]+$/u;

export default function AdminCreate() {
  const nav = useNavigate();
  const [username, setUsername] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);
  const [errs, setErrs] = useState({}); // { username, nickname, global }

  // ref để cuộn tới field lỗi đầu tiên (nhẹ giống Food_Create)
  const refUsername = useRef(null);
  const refNickname = useRef(null);

  const validateUsername = (v) => {
    const u = (v || "").trim();
    if (!u) return "Vui lòng nhập username";
    if (!USERNAME_REGEX.test(u)) return "Username chỉ gồm chữ và số (4–200)";
    return "";
  };

  const validateNickname = (v) => {
    const n = (v || "").trim();
    if (!n) return "Vui lòng nhập nickname";
    if (!NICKNAME_RE.test(n)) {
      return "Chỉ cho phép chữ (có dấu), số, khoảng trắng và tối đa 30 ký tự.";
    }
    return "";
  };

  const validate = () => {
    const e = {
      username: validateUsername(username),
      nickname: validateNickname(nickname),
    };

    // xoá các key không lỗi
    Object.keys(e).forEach((k) => {
      if (!e[k]) delete e[k];
    });
    setErrs(e);
    return e;
  };

  const scrollToFirstError = (e) => {
    if (e.username && refUsername.current) {
      refUsername.current.scrollIntoView({ behavior: "smooth", block: "center" });
      refUsername.current.focus();
      return;
    }
    if (e.nickname && refNickname.current) {
      refNickname.current.scrollIntoView({ behavior: "smooth", block: "center" });
      refNickname.current.focus();
    }
  };

  const onSubmit = async (ev) => {
    ev.preventDefault();
    setErrs({});
    const e = validate();
    if (Object.keys(e).length > 0) {
      toast.error("Vui lòng nhập đúng các trường trước khi lưu.");
      scrollToFirstError(e);
      return;
    }

    setLoading(true);
    try {
      await createAdminAccount({
        username: username.trim(),
        nickname: nickname.trim(),
      });
      // Không toast ở đây để tránh trùng – Admin_List sẽ hiển thị 1 lần
      nav("/admins", { state: { justCreated: true } });
    } catch (err) {
      const msg =
        err?.response?.data?.message || "Tạo tài khoản thất bại";
      setErrs({ global: msg });
    } finally {
      setLoading(false);
    }
  };

  // style chung cho TextField (border-radius 4px, không shadow dày)
  const textFieldSx = {
    "& .MuiOutlinedInput-root": {
      borderRadius: "4px",
    },
  };

  return (
    <div className="foods-page admin-create-page">
      <nav className="breadcrumb-nav" aria-label="breadcrumb">
        <Link to="/">
          <i className="fa-solid fa-house"></i>
          <span>Trang chủ</span>
        </Link>
        <span className="separator">/</span>
        <Link to="/admins" className="current-group">
          <i className="fa-solid fa-user-gear"></i>
          <span>Quản lý Admin</span>
        </Link>
        <span className="separator">/</span>
        <span className="current-page">Tạo tài khoản</span>
      </nav>

      <div className="card admin-create-card">
        <div className="page-head">
          <h2>Tạo tài khoản quản trị (cấp 2)</h2>
          <div className="head-actions">
            <Link to="/admins" className="btn ghost">
              <span>Quay lại danh sách</span>
            </Link>
            <button
              className="btn primary"
              type="submit"
              form="admin-create-form"
              disabled={loading}
            >
              {loading ? "Đang tạo..." : "Tạo tài khoản"}
            </button>
          </div>
        </div>

        <div className="admin-create-grid">
          <form
            id="admin-create-form"
            onSubmit={onSubmit}
            className="admin-create-form"
          >
            <Box className="admin-create-fields" sx={{ display: "flex", flexDirection: "column"}}>
              <div className="ac-field-title">Tên đăng nhập *</div>
              {/* Username */}
              <TextField
                inputRef={refUsername}
                label="Tên đăng nhập (username)"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  // clear lỗi khi user sửa
                  setErrs((prev) => ({ ...prev, username: undefined }));
                }}
                onBlur={() =>
                  setErrs((prev) => ({
                    ...prev,
                    username: validateUsername(username) || undefined,
                  }))
                }
                error={!!errs.username}
                helperText={errs.username}
                fullWidth
                required
                inputProps={{ maxLength: 200 }}
                sx={textFieldSx}
              />

              {/* Nickname */}
              <div className="ac-field-title">Tên hiển thị *</div>
              <TextField
                inputRef={refNickname}
                label="Tên hiển thị (nickname)"
                value={nickname}
                onChange={(e) => {
                  setNickname(e.target.value);
                  setErrs((prev) => ({ ...prev, nickname: undefined }));
                }}
                onBlur={() =>
                  setErrs((prev) => ({
                    ...prev,
                    nickname: validateNickname(nickname) || undefined,
                  }))
                }
                error={!!errs.nickname}
                helperText={errs.nickname}
                fullWidth
                required
                inputProps={{ maxLength: 30 }}
                sx={textFieldSx}
              />

              <div className="hint">
                Mật khẩu mặc định: <b>fitmatch@admin2</b> (Admin có thể tự đổi sau khi đăng nhập).
              </div>

              {errs.global && (
                <FormHelperText error className="error-global">
                  {errs.global}
                </FormHelperText>
              )}
            </Box>
          </form>

          {/* Cột phải để trống / có thể thêm banner / mô tả sau này */}
          <div className="admin-create-aside" aria-hidden="true"></div>
        </div>
      </div>
    </div>
  );
}
