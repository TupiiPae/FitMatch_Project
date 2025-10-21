// src/pages/Account/AccountSettings/Account.jsx
import React, { useEffect, useRef, useState } from "react";
import "./Account.css";
import { getMe } from "../../../api/account";
import api from "../../../lib/api";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCamera, faPen, faXmark } from "@fortawesome/free-solid-svg-icons";
import { toast } from "react-toastify";
import AvatarCropper from "../../../components/AvatarCropper";

/* Utils */
const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try { return new URL(u, API_ORIGIN).toString(); } catch { return u; }
};
function formatDobDMY(dob, fallback = "") {
  if (typeof dob !== "string") return fallback;
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(dob);
  if (!m) return fallback;
  const [y, mo, d] = dob.split("-");
  return `${d}/${mo}/${y}`;
}

export default function AccountInfo() {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // --- states cho 2 box edit riêng ---
  const [editInfo, setEditInfo] = useState(false);     // Box 2
  const [editAddr, setEditAddr] = useState(false);     // Box 3
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingAddr, setSavingAddr] = useState(false);

  // --- form Box 2 (User info) ---
  const [form, setForm] = useState({
    nickname: "",
    dob: "",
    sex: "male",
    email: "",
    phone: "",
  });

  // --- form Box 3 (Address) ---
  const [addr, setAddr] = useState({
    country: "",
    city: "",
    district: "",
    ward: "",
  });

  // Avatar
  const [avatarPreview, setAvatarPreview] = useState("/images/avatar.png");
  const [avatarFile, setAvatarFile] = useState(null);
  const fileRef = useRef(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await getMe(); // data.user
        if (me && typeof me === "object") setUser(me);
      } catch {
        toast.error("Không thể tải tài khoản");
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Sync form khi user thay đổi
  useEffect(() => {
    if (!user) return;
    const p = user.profile || {};
    const a = (p.address || {});
    setForm({
      nickname: p.nickname || "",
      dob: p.dob || "",
      sex: p.sex || "male",
      email: user.email || "",
      phone: user.phone || "",
    });
    setAddr({
      country: a.country || "",
      city: a.city || "",
      district: a.district || "",
      ward: a.ward || "",
    });
    setAvatarPreview(p.avatarUrl ? toAbs(p.avatarUrl) : "/images/avatar.png");
    setAvatarFile(null);
    setEditInfo(false);
    setEditAddr(false);
  }, [user]);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const onAddrChange = (e) => setAddr((a) => ({ ...a, [e.target.name]: e.target.value }));

  // chọn avatar
  const pickAvatar = () => fileRef.current?.click();
  const onFile = (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Vui lòng chọn ảnh PNG/JPG");
    if (file.size > 2 * 1024 * 1024) return toast.error("Kích thước ảnh tối đa 2MB");
    const reader = new FileReader();
    reader.onload = () => { setCropSrc(reader.result?.toString() || null); setCropOpen(true); };
    reader.readAsDataURL(file);
  };
  const uploadAvatarDirect = async (file) => {
    try {
      const fd = new FormData(); fd.append("avatar", file);
      const res = await api.post("/api/user/avatar", fd, { headers: { "Content-Type": "multipart/form-data" }});
      const updated = res?.data?.user; const url = res?.data?.avatarUrl;
      if (updated) setUser(updated);
      if (url) setAvatarPreview(toAbs(url));
      toast.success("Đã cập nhật ảnh đại diện!");
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Tải ảnh thất bại");
    } finally { if (fileRef.current) fileRef.current.value = ""; }
  };
  const onCropConfirm = (fileCropped, previewUrl) => {
    setCropOpen(false);
    // cho phép đổi ảnh bất kể đang edit box nào
    setAvatarPreview(previewUrl);
    setAvatarFile(null);
    uploadAvatarDirect(fileCropped);
  };

  // ===== Save Box 2
  const saveInfo = async () => {
    setSavingInfo(true);
    try {
      const payload = {
        email: form.email,
        phone: form.phone,
        "profile.nickname": form.nickname,
        "profile.dob": form.dob,
        "profile.sex": form.sex,
      };
      const res = await api.patch("/api/user/account", payload);
      const updated = res?.data?.user;
      if (updated) setUser(updated);
      toast.success("Đã lưu thông tin!");
      setEditInfo(false);
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Cập nhật thất bại");
    } finally { setSavingInfo(false); }
  };

  // ===== Save Box 3 (địa chỉ) – chuẩn bị sẵn keys; bạn sẽ bổ sung schema BE sau
  const saveAddr = async () => {
    setSavingAddr(true);
    try {
      const payload = {
        "profile.address.country": addr.country,
        "profile.address.city": addr.city,
        "profile.address.district": addr.district,
        "profile.address.ward": addr.ward,
      };
      const res = await api.patch("/api/user/account", payload);
      const updated = res?.data?.user;
      if (updated) setUser(updated);
      toast.success("Đã lưu địa chỉ!");
      setEditAddr(false);
    } catch (e) {
      // Nếu BE chưa có field → có thể 400. Hiện thông báo gợi ý.
      toast.error(e?.response?.data?.message || "Chưa bật field địa chỉ ở BE. Gửi mình file User.js để thêm nhé.");
    } finally { setSavingAddr(false); }
  };

  if (!loaded) {
    return (<div className="card acc-card"><h2 className="pf-title">Tài khoản</h2><div className="acc-loading">Đang tải…</div></div>);
  }
  if (!user) {
    return (<div className="card acc-card"><h2 className="pf-title">Tài khoản</h2><div className="pf-error">Không tìm thấy dữ liệu</div></div>);
  }

  const p = user.profile || {};
  const a = p.address || {};

return (
  <div className="acc-page">
    {/* Card lớn GIỮ NGUYÊN */}
    <div className="card acc-card">
      <h2 className="pf-title">Thông tin tài khoản</h2>

      {/* ====== SECTION 1: Profile (avatar + info nhanh) ====== */}
      <section className="acc-sec">
        <div className="acc-profile-row">
          <div className="acc-avatarWrap acc-avatarWrap--inline">
            <div className="acc-avatar"><img src={avatarPreview} alt="avatar" /></div>
            <button className="acc-avatar-btn" title="Đổi avatar" aria-label="Đổi avatar" type="button" onClick={pickAvatar}>
              <FontAwesomeIcon icon={faCamera} />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="acc-file" onChange={onFile}/>
          </div>

          <div className="acc-profile-main">
            <div className="acc-name">{(user.profile?.nickname) || user.username}</div>
            <div className="acc-sub">
              <span>{formatDobDMY(user.profile?.dob) || "Chưa có ngày sinh"}</span>
              <span className="dot">•</span>
              <span>{user.profile?.sex === "female" ? "Nữ" : "Nam"}</span>
              <span className="dot">•</span>
              <span>{user.email}</span>
              {(user.profile?.address?.city || user.profile?.address?.country) && (
                <>
                  <span className="dot">•</span>
                  <span>{[
                    user.profile?.address?.ward,
                    user.profile?.address?.district,
                    user.profile?.address?.city,
                    user.profile?.address?.country,
                  ].filter(Boolean).join(", ")}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ====== SECTION 2: Personal information (edit riêng) ====== */}
      <section className="acc-sec">
        <div className="acc-sec-head">
          <h3>Personal information</h3>
          {!editInfo ? (
            <button className="acc-edit" onClick={() => setEditInfo(true)}>
              <FontAwesomeIcon icon={faPen}/> Edit
            </button>
          ) : (
            <div className="acc-edit-actions">
              <button
                className="btn-tertiary"
                onClick={() => { setEditInfo(false); const p=user.profile||{};
                  setForm({ nickname:p.nickname||"", dob:p.dob||"", sex:p.sex||"male", email:user.email||"", phone:user.phone||"" });
                }}
              ><FontAwesomeIcon icon={faXmark}/> Cancel</button>
              <button className="btn-success" onClick={saveInfo} disabled={savingInfo}>
                {savingInfo ? "Saving..." : "Save"}
              </button>
            </div>
          )}
        </div>

        {/* Read view */}
        {!editInfo && (
          <div className="acc-grid">
            <div className="acc-field"><span className="label">Nickname</span><span className="value">{user.profile?.nickname || "-"}</span></div>
            <div className="acc-field"><span className="label">Ngày sinh</span><span className="value">{formatDobDMY(user.profile?.dob) || "-"}</span></div>
            <div className="acc-field"><span className="label">Giới tính</span><span className="value">{user.profile?.sex === "female" ? "Nữ" : "Nam"}</span></div>
            <div className="acc-field"><span className="label">Email</span><span className="value">{user.email || "-"}</span></div>
            <div className="acc-field"><span className="label">Số điện thoại</span><span className="value">{user.phone || "-"}</span></div>
          </div>
        )}

        {/* Edit view */}
        {editInfo && (
          <div className="acc-form">
            <div className="acc-two">
              <div className="acc-form-col">
                <label>Nickname</label>
                <input name="nickname" value={form.nickname} onChange={onChange} />
              </div>
              <div className="acc-form-col">
                <label>Ngày sinh</label>
                <input type="date" name="dob" value={form.dob || ""} onChange={onChange}/>
              </div>
            </div>
            <div className="acc-two">
              <div className="acc-form-col">
                <label>Giới tính</label>
                <div className="seg-group">
                  <label className="seg-option"><input type="radio" name="sex" value="male" checked={form.sex==="male"} onChange={onChange}/><span className="seg-btn">Nam</span></label>
                  <label className="seg-option"><input type="radio" name="sex" value="female" checked={form.sex==="female"} onChange={onChange}/><span className="seg-btn">Nữ</span></label>
                </div>
              </div>
              <div className="acc-form-col">
                <label>Email</label>
                <input type="email" name="email" value={form.email} onChange={onChange}/>
              </div>
            </div>
            <div className="acc-one">
              <label>Số điện thoại</label>
              <input name="phone" value={form.phone} onChange={onChange}/>
            </div>
          </div>
        )}
      </section>

      {/* ====== SECTION 3: Address (edit riêng) ====== */}
      <section className="acc-sec">
        <div className="acc-sec-head">
          <h3>Address</h3>
          {!editAddr ? (
            <button className="acc-edit" onClick={() => setEditAddr(true)}>
              <FontAwesomeIcon icon={faPen}/> Edit
            </button>
          ) : (
            <div className="acc-edit-actions">
              <button
                className="btn-tertiary"
                onClick={() => { setEditAddr(false); const a = user.profile?.address || {};
                  setAddr({ country:a.country||"", city:a.city||"", district:a.district||"", ward:a.ward||"" });
                }}
              ><FontAwesomeIcon icon={faXmark}/> Cancel</button>
              <button className="btn-success" onClick={saveAddr} disabled={savingAddr}>
                {savingAddr ? "Saving..." : "Save"}
              </button>
            </div>
          )}
        </div>

        {/* Read view */}
        {!editAddr && (
          <div className="acc-grid">
            <div className="acc-field"><span className="label">Quốc gia</span><span className="value">{user.profile?.address?.country || "-"}</span></div>
            <div className="acc-field"><span className="label">Thành phố</span><span className="value">{user.profile?.address?.city || "-"}</span></div>
            <div className="acc-field"><span className="label">Quận</span><span className="value">{user.profile?.address?.district || "-"}</span></div>
            <div className="acc-field"><span className="label">Phường</span><span className="value">{user.profile?.address?.ward || "-"}</span></div>
          </div>
        )}

        {/* Edit view */}
        {editAddr && (
          <div className="acc-form">
            <div className="acc-two">
              <div className="acc-form-col">
                <label>Country</label>
                <input name="country" value={addr.country} onChange={onAddrChange}/>
              </div>
              <div className="acc-form-col">
                <label>City / State</label>
                <input name="city" value={addr.city} onChange={onAddrChange}/>
              </div>
            </div>
            <div className="acc-two">
              <div className="acc-form-col">
                <label>District</label>
                <input name="district" value={addr.district} onChange={onAddrChange}/>
              </div>
              <div className="acc-form-col">
                <label>Ward</label>
                <input name="ward" value={addr.ward} onChange={onAddrChange}/>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>

    {/* Modal crop ảnh */}
    <AvatarCropper open={cropOpen} src={cropSrc} onClose={() => setCropOpen(false)} onConfirm={onCropConfirm} />
  </div>
);
}