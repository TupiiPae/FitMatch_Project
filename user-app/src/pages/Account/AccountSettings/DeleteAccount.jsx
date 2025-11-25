// user-app/src/pages/Account/DeleteAccount.jsx
import React, { useEffect, useState } from "react";
import "./DeleteAccount.css";
import { deleteAccount as apiDeleteAccount } from "../../../api/account";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

export default function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  const hardLogout = () => {
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("onboarded");
      // nếu app có các cache khác thì xóa thêm tại đây
    } catch {}
  };

  const onDelete = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await apiDeleteAccount();
      // Xóa local session + chuyển về /login
      hardLogout();
      toast.success("Tài khoản đã bị xóa. Hẹn gặp lại bạn!");
      setOpen(false);
      nav("/login", { replace: true });
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.message ||
        "Xóa tài khoản thất bại, vui lòng thử lại.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="acc-card card cp-page">
      <h2 className="cp-title">Xóa dữ liệu và tài khoản</h2>

      <div className="cp-wrap">
        <div className="cp-block">
          <div className="cp-subtitle">
            Bạn có chắc muốn xóa dữ liệu và tài khoản?
          </div>
          <p className="cp-desc">
            Hành động này sẽ xóa toàn bộ dữ liệu liên quan đến tài khoản của
            bạn trên FitMatch và <b>không thể hoàn tác</b>. Vui lòng cân nhắc
            trước khi thực hiện.
          </p>

          <div className="cp-main-actions">
            <button
              className="btn-danger"
              type="button"
              onClick={() => setOpen(true)}
            >
              XÓA DỮ LIỆU VÀ TÀI KHOẢN
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="del-modal" role="dialog" aria-modal="true">
          <div className="del-backdrop" onClick={() => setOpen(false)} />

          <div className="del-dialog" role="document">
            <div className="del-dialog-title">
              Bạn có chắc chắn muốn xóa dữ liệu và tài khoản?
            </div>
            <p className="del-dialog-desc">
              Hành động này sẽ <b>không thể hoàn tác</b>. Bạn có chắc chắn thực
              hiện?
            </p>

            <div className="del-actions">
              <button
                className="btn-secondary"
                type="button"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Hủy
              </button>
              <button
                className="btn-danger"
                type="button"
                onClick={onDelete}
                disabled={loading}
              >
                {loading ? "Đang xóa..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
