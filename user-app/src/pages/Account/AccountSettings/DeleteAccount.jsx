import React, { useEffect, useState } from "react";
import "./DeleteAccount.css";

export default function DeleteAccount() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = original; };
  }, [open]);

  const onDelete = async () => {
    // TODO: gọi API xóa dữ liệu/tài khoản
    setOpen(false);
  };

  return (
    <div className="acc-card card">
      <h2 className="pf-title">Xóa dữ liệu và tài khoản</h2>

      <div className="cp-wrap">
        <div className="cp-block">
          <div className="cp-subtitle">Bạn có chắc muốn xóa dữ liệu và tài khoản?</div>
          <p className="cp-desc">
            Hành động này sẽ xóa toàn bộ dữ liệu liên quan đến tài khoản của bạn trên FitMatch và <b> không thể hoàn tác</b>. Vui lòng cân nhắc trước khi thực hiện.
          </p>
        </div>
      </div>

      <div className="pf-actions pf-actions-right">
        <button className="btn-danger" type="button" onClick={() => setOpen(true)}>
          XÓA DỮ LIỆU VÀ TÀI KHOẢN
        </button>
      </div>

      {open && (
        <div className="del-modal" role="dialog" aria-modal="true">
          <div className="del-backdrop" onClick={() => setOpen(false)} />

          <div className="del-dialog card" role="document">
            <div className="del-dialog-title">BẠN CÓ CHẮC CHẮN MUỐN XÓA DỮ LIỆU VÀ TÀI KHOẢN?</div>
            <p className="del-dialog-desc">
              Hành động này sẽ không thể hoàn tác. Bạn có chắc chắn thực hiện?
            </p>

            <div className="del-actions">
              <button className="btn-secondary" type="button" onClick={() => setOpen(false)}>
                Hủy
              </button>
              <button className="btn-danger" type="button" onClick={onDelete}>
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
