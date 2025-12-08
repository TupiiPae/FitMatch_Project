import { useState } from "react";
import api from "../../../lib/api"; // dùng axios instance user-app
import "./Contact.css";

const MAX_NAME = 100;
const MAX_EMAIL = 100;
const MAX_PHONE = 11;
const MAX_SUBJECT = 100;
const MAX_MESSAGE = 1000;

export default function ContactPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [sentOk, setSentOk] = useState(false);

  const handleChange = (field) => (e) => {
    let value = e.target.value;

    if (field === "phone") {
      // chỉ cho nhập số
      value = value.replace(/\D/g, "");
      if (value.length > MAX_PHONE) value = value.slice(0, MAX_PHONE);
    }

    if (field === "name" && value.length > MAX_NAME)
      value = value.slice(0, MAX_NAME);
    if (field === "email" && value.length > MAX_EMAIL)
      value = value.slice(0, MAX_EMAIL);
    if (field === "subject" && value.length > MAX_SUBJECT)
      value = value.slice(0, MAX_SUBJECT);
    if (field === "message" && value.length > MAX_MESSAGE)
      value = value.slice(0, MAX_MESSAGE);

    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
    setSentOk(false);
  };

  const validate = () => {
    const errs = {};
    const name = form.name.trim();
    const email = form.email.trim();
    const phone = form.phone.trim();
    const subject = form.subject.trim();
    const message = form.message;

    if (!name) errs.name = "Vui lòng nhập tên";
    else if (name.length > MAX_NAME)
      errs.name = `Tên tối đa ${MAX_NAME} ký tự`;

    if (!email) errs.email = "Vui lòng nhập email";
    else if (email.length > MAX_EMAIL)
      errs.email = `Email tối đa ${MAX_EMAIL} ký tự`;
    else if (!/^[^@\s]+@gmail\.com$/i.test(email))
      errs.email = "Email phải có đuôi @gmail.com";

    if (!phone) errs.phone = "Vui lòng nhập số điện thoại";
    else if (!/^\d{1,11}$/.test(phone))
      errs.phone = "Số điện thoại chỉ gồm số, tối đa 11 số";

    if (!subject) errs.subject = "Vui lòng nhập tiêu đề";
    else if (subject.length > MAX_SUBJECT)
      errs.subject = `Tiêu đề tối đa ${MAX_SUBJECT} ký tự`;

    if (message && message.length > MAX_MESSAGE)
      errs.message = `Nội dung tối đa ${MAX_MESSAGE} ký tự`;

    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    setSubmitting(true);
    setSentOk(false);
    try {
      await api.post("/api/contact-messages", {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
      });

      setSentOk(true);
      setForm({
        name: "",
        email: "",
        phone: "",
        subject: "",
        message: "",
      });
    } catch (err) {
      console.error(err);
      const data = err?.response?.data;
      if (data?.errors) {
        setErrors(
          Object.fromEntries(
            Object.entries(data.errors).map(([k, v]) => [k, String(v)])
          )
        );
      } else {
        setErrors((prev) => ({
          ...prev,
          submit: data?.message || "Gửi liên hệ thất bại, vui lòng thử lại.",
        }));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ct-page">
      <div className="ct-container">
        {/* BOX LEFT: Thông tin liên hệ */}
        <div className="ct-info-card">
          <h2 className="ct-info-title">Địa Chỉ Liên hệ</h2>
          <p className="ct-info-sub">
            Gửi lời nhắn, hoặc liên lạc trực tiếp với chúng tôi qua
          </p>

          {/* <div className="ct-info-block">
            <div className="ct-info-icon">
              <i className="fa-solid fa-location-dot" />
            </div>
            <div className="ct-info-text">
              <div className="ct-info-label">ĐỊA CHỈ:</div>
              <div>
                Phòng 2.28, tòa A, 69/68 Đặng Thùy Trâm,
                <br />
                phường 13, quận Bình Thạnh, TP. Hồ Chí Minh
              </div>
            </div>
          </div> */}

          <div className="ct-info-block">
            <div className="ct-info-icon">
              <i className="fa-regular fa-envelope" />
            </div>
            <div className="ct-info-text">
              <div className="ct-info-label">EMAIL:</div>
              <div>fitmatchservice@gmail.com</div>
            </div>
          </div>

          <div className="ct-info-block">
            <div className="ct-info-icon">
              <i className="fa-solid fa-phone" />
            </div>
            <div className="ct-info-text">
              <div className="ct-info-label">PHONE:</div>
              <div>085. 7314 462</div>
            </div>
          </div>

          <hr className="ct-info-divider" />

          <div className="ct-social-row">
            <a href="#" className="ct-social-btn" aria-label="Facebook">
              <i className="fa-brands fa-facebook-f" />
            </a>
            <a href="#" className="ct-social-btn" aria-label="YouTube">
              <i className="fa-brands fa-youtube" />
            </a>
            <a href="mailto:qhdn@vlu.edu.vn" className="ct-social-btn" aria-label="Email">
              <i className="fa-regular fa-envelope" />
            </a>
          </div>
        </div>

        {/* BOX RIGHT: Form gửi lời nhắn */}
        <div className="ct-form-card">
          <h2 className="ct-form-title">Gửi lời nhắn tới chúng tôi</h2>

          {sentOk && (
            <div className="ct-alert success">
              Cảm ơn bạn! Lời nhắn đã được gửi thành công.
            </div>
          )}
          {errors.submit && (
            <div className="ct-alert error">{errors.submit}</div>
          )}

          <form onSubmit={handleSubmit} className="ct-form">
            <div className="ct-field">
              <input
                type="text"
                placeholder="Tên của bạn"
                value={form.name}
                onChange={handleChange("name")}
                required
              />
              {errors.name && <div className="ct-error">{errors.name}</div>}
            </div>

            <div className="ct-field">
              <input
                type="email"
                placeholder="Địa chỉ email"
                value={form.email}
                onChange={handleChange("email")}
                required
              />
              {errors.email && <div className="ct-error">{errors.email}</div>}
            </div>

            <div className="ct-field">
              <input
                type="text"
                placeholder="Số điện thoại liên lạc"
                value={form.phone}
                onChange={handleChange("phone")}
                inputMode="numeric"
                required
              />
              {errors.phone && <div className="ct-error">{errors.phone}</div>}
            </div>

            <div className="ct-field">
              <input
                type="text"
                placeholder="Tiêu đề"
                value={form.subject}
                onChange={handleChange("subject")}
                required
              />
              {errors.subject && (
                <div className="ct-error">{errors.subject}</div>
              )}
            </div>

            <div className="ct-field">
              <textarea
                placeholder="Nội dung"
                rows={5}
                value={form.message}
                onChange={handleChange("message")}
              />
              {errors.message && (
                <div className="ct-error">{errors.message}</div>
              )}
            </div>

            <button
              type="submit"
              className="ct-submit-btn"
              disabled={submitting}
            >
              {submitting ? "Đang gửi..." : "Gửi"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
