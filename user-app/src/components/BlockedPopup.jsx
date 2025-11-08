// user-app/src/components/BlockedPopup.jsx
import React from "react";
import "./BlockedPopup.css";
import { buildMailto } from "../helpers/mailto";

export default function BlockedPopup({ open, reason, onClose }) {
  if (!open) return null;

  const mailHref = buildMailto({
    to: "fitmatchservice@gmail.com",
    subject: "Tài khoản bị khóa - Hỗ trợ mở khóa",
    body: `Chào FitMatch,

Tôi cần hỗ trợ mở khóa tài khoản.
Lý do hệ thống hiển thị: ${reason || ""}`,
  });

  return (
    <div
      className="blk-backdrop"
      onMouseDown={(e) =>
        e.target.classList.contains("blk-backdrop") && onClose()
      }
    >
      <div
        className="blk-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="blk-title"
      >
        <div className="blk-head">
          <h3 id="blk-title">
            <i className="fa-solid fa-circle-exclamation" />
            <span>Tài khoản đã bị khóa</span>
          </h3>
        </div>

        <div className="blk-body">
          <div className="blk-hero">
            <img src="/images/lock-user.png" alt="Tài khoản bị khóa" />
          </div>

          <p className="blk-main-title">Tài khoản của bạn đã bị khóa</p>

          {/* BOX LÝ DO */}
          <div className="blk-reason">
            <div className="blk-reason-title">Lý do</div>
            <div className="blk-reason-text">
              {reason || "Không có lý do chi tiết."}
            </div>
          </div>

          <p className="blk-contact-text">
            Liên hệ với chúng tôi để thực hiện mở khóa tài khoản theo địa chỉ:{" "}
            <span>fitmatchservice@gmail.com</span>
          </p>
        </div>

        <div className="blk-foot">
          <div className="blk-actions">
            <button
              type="button"
              className="blk-btn blk-btn-ghost"
              onClick={onClose}
            >
              Đã hiểu
            </button>

            {/* Dùng thẻ <a> để mở email */}
            <a
              href={mailHref}
              className="blk-btn blk-btn-call"
              onClick={(e) => e.stopPropagation()}
              target="_blank"
              rel="noopener noreferrer"
            >
              <i className="fa-regular fa-envelope" />
              <span>Liên hệ với FitMatch</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
