// src/pages/Account/AccountSettings/Account.jsx
import React, { useEffect, useRef, useState } from "react";
import "./Account.css";
import { getMe } from "../../../api/account";
import api from "../../../lib/api";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCamera, faPen, faXmark } from "@fortawesome/free-solid-svg-icons";
import { toast } from "react-toastify";
import AvatarCropper from "../../../components/AvatarCropper";
import countries from "../../../data/locations/countries.json";
import regionsVN from "../../../data/locations/vn/regions.json";
import regionCenters from "../../../data/locations/vn/region-centers.json";

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => { if (!u) return u; try { return new URL(u, API_ORIGIN).toString(); } catch { return u; } };
const formatDobDMY = (dob, fallback = "") => { if (typeof dob !== "string") return fallback; if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return fallback; const [y, mo, d] = dob.split("-"); return `${d}/${mo}/${y}`; };

export default function AccountInfo() {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const [editInfo, setEditInfo] = useState(false);
  const [editAddr, setEditAddr] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [savingAddr, setSavingAddr] = useState(false);

  const [form, setForm] = useState({ nickname: "", dob: "", sex: "male", email: "", phone: "" });

  // Address + code
  const [addr, setAddr] = useState({
    country: "", countryCode: "",
    city: "", regionCode: "",
    district: "", districtCode: "",
    ward: "", wardCode: ""
  });

  // Geo theo city center (có thể đổi theo district sau này)
  const [geo, setGeo] = useState(null); // [lng, lat]

  // Lists
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);

  // Avatar
  const [avatarPreview, setAvatarPreview] = useState("/images/avatar.png");
  const fileRef = useRef(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState(null);

  useEffect(() => {
    (async () => {
      try { const me = await getMe(); if (me && typeof me === "object") setUser(me); }
      catch { toast.error("Không thể tải tài khoản"); }
      finally { setLoaded(true); }
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    const p = user.profile || {};
    const a = p.address || {};
    setForm({ nickname: p.nickname || "", dob: p.dob || "", sex: p.sex || "male", email: user.email || "", phone: user.phone || "" });
    setAddr({
      country: a.country || "", countryCode: a.countryCode || (a.country ? "VN" : ""),
      city: a.city || "", regionCode: a.regionCode || "",
      district: a.district || "", districtCode: a.districtCode || "",
      ward: a.ward || "", wardCode: a.wardCode || ""
    });
    setAvatarPreview(p.avatarUrl ? toAbs(p.avatarUrl) : "/images/avatar.png");
    // preset geo theo city
    setGeo(a.regionCode && regionCenters[a.regionCode] ? regionCenters[a.regionCode] : null);
    setEditInfo(false); setEditAddr(false);
  }, [user]);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  // Avatar handlers
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
      const res = await api.post("/api/user/avatar", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const updated = res?.data?.user; const url = res?.data?.avatarUrl;
      if (updated) setUser(updated); if (url) setAvatarPreview(toAbs(url));
      toast.success("Đã cập nhật ảnh đại diện!");
    } catch (e) { toast.error(e?.response?.data?.message || e?.message || "Tải ảnh thất bại"); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  };
  const onCropConfirm = (fileCropped, previewUrl) => { setCropOpen(false); setAvatarPreview(previewUrl); uploadAvatarDirect(fileCropped); };

  // Khi đổi City → nạp Districts + reset Ward + set geo center
  useEffect(() => {
    setAddr((a) => ({ ...a, district:"", districtCode:"", ward:"", wardCode:"" }));
    setWards([]);
    if (addr.regionCode === "HN") {
      import("../../../data/locations/vn/districts-HN.json").then((m) => setDistricts(m.default || []));
    } else if (addr.regionCode === "HCM") {
      import("../../../data/locations/vn/districts-HCM.json").then((m) => setDistricts(m.default || []));
    } else setDistricts([]);
    setGeo(Array.isArray(regionCenters[addr.regionCode]) ? regionCenters[addr.regionCode] : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addr.regionCode]);

  // Khi đổi District → nạp Wards tương ứng
  useEffect(() => {
    setAddr((a) => ({ ...a, ward:"", wardCode:"" }));
    setWards([]);
    if (!addr.regionCode || !addr.districtCode) return;
    if (addr.regionCode === "HN") {
      import("../../../data/locations/vn/wards-HN.json").then((m) => {
        const map = m.default || {};
        const list = Array.isArray(map[addr.districtCode]) ? map[addr.districtCode] : [];
        setWards(list.map((name, i) => ({ code: String(i+1).padStart(2,"0"), name })));
      });
    } else if (addr.regionCode === "HCM") {
      import("../../../data/locations/vn/wards-HCM.json").then((m) => {
        const map = m.default || {};
        const list = Array.isArray(map[addr.districtCode]) ? map[addr.districtCode] : [];
        setWards(list.map((name, i) => ({ code: String(i+1).padStart(2,"0"), name })));
      });
    }
  }, [addr.regionCode, addr.districtCode]);

  // Save Box 2
  const saveInfo = async () => {
    setSavingInfo(true);
    try {
      const payload = {
        email: form.email, phone: form.phone,
        "profile.nickname": form.nickname, "profile.dob": form.dob, "profile.sex": form.sex
      };
      const res = await api.patch("/api/user/account", payload);
      const updated = res?.data?.user; if (updated) setUser(updated);
      toast.success("Đã lưu thông tin!"); setEditInfo(false);
    } catch (e) { toast.error(e?.response?.data?.message || e?.message || "Cập nhật thất bại"); }
    finally { setSavingInfo(false); }
  };

  // Save Box 3
  const saveAddr = async () => {
    setSavingAddr(true);
    try {
      const payload = {
        "profile.address.country": addr.country,
        "profile.address.countryCode": addr.countryCode,
        "profile.address.city": addr.city,
        "profile.address.regionCode": addr.regionCode,
        "profile.address.district": addr.district,
        "profile.address.districtCode": addr.districtCode,
        "profile.address.ward": addr.ward,
        "profile.address.wardCode": addr.wardCode,
        ...(Array.isArray(geo) ? { "profile.location.coordinates": geo } : {})
      };
      const res = await api.patch("/api/user/account", payload);
      const updated = res?.data?.user; if (updated) setUser(updated);
      toast.success("Đã lưu địa chỉ!"); setEditAddr(false);
    } catch (e) { toast.error(e?.response?.data?.message || "Lưu địa chỉ thất bại"); }
    finally { setSavingAddr(false); }
  };

  if (!loaded) return (<div className="card acc-card"><h2 className="pf-title">Tài khoản</h2><div className="acc-loading">Đang tải…</div></div>);
  if (!user) return (<div className="card acc-card"><h2 className="pf-title">Tài khoản</h2><div className="pf-error">Không tìm thấy dữ liệu</div></div>);

  return (
    <div className="acc-page">
      <div className="card acc-card">
        <h2 className="pf-title">Thông tin tài khoản</h2>

        {/* Box 1 */}
        <section className="acc-sec">
          <div className="acc-profile-row">
            <div className="acc-avatarWrap acc-avatarWrap--inline">
              <div className="acc-avatar"><img src={avatarPreview} alt="avatar" /></div>
              <button className="acc-avatar-btn" title="Đổi avatar" aria-label="Đổi avatar" type="button" onClick={pickAvatar}><FontAwesomeIcon icon={faCamera} /></button>
              <input ref={fileRef} type="file" accept="image/*" className="acc-file" onChange={onFile} />
            </div>
            <div className="acc-profile-main">
              <div className="acc-name">{(user.profile?.nickname) || user.username}</div>
              <div className="acc-sub">
                <span>{user.profile?.sex === "female" ? "Nữ" : "Nam"}</span><span className="dot">•</span>
                <span>{formatDobDMY(user.profile?.dob) || "Chưa có ngày sinh"}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Box 2 */}
        <section className="acc-sec">
          <div className="acc-sec-head">
            <h3>Thông tin cá nhân</h3>
            {!editInfo ? (
              <button className="acc-edit" onClick={() => setEditInfo(true)}><FontAwesomeIcon icon={faPen} /> Edit</button>
            ) : (
              <div className="acc-edit-actions">
                <button className="btn-tertiary" onClick={() => { setEditInfo(false); const p=user.profile||{}; setForm({ nickname:p.nickname||"", dob:p.dob||"", sex:p.sex||"male", email:user.email||"", phone:user.phone||"" }); }}>
                  <FontAwesomeIcon icon={faXmark} /> Hủy
                </button>
                <button className="btn-success" onClick={saveInfo} disabled={savingInfo}>{savingInfo ? "Đang lưu..." : "Lưu"}</button>
              </div>
            )}
          </div>

          {!editInfo && (
            <div className="acc-grid">
              <div className="acc-field"><span className="label">Nickname</span><span className="value">{user.profile?.nickname || "-"}</span></div>
              <div className="acc-field"><span className="label">Ngày sinh</span><span className="value">{formatDobDMY(user.profile?.dob) || "-"}</span></div>
              <div className="acc-field"><span className="label">Giới tính</span><span className="value">{user.profile?.sex === "female" ? "Nữ" : "Nam"}</span></div>
              <div className="acc-field"><span className="label">Email</span><span className="value">{user.email || "-"}</span></div>
              <div className="acc-field"><span className="label">Số điện thoại</span><span className="value">{user.phone || "-"}</span></div>
            </div>
          )}

          {editInfo && (
            <div className="acc-form">
              <div className="acc-two">
                <div className="acc-form-col"><label>Nickname</label><input name="nickname" value={form.nickname} onChange={onChange} /></div>
                <div className="acc-form-col"><label>Ngày sinh</label><input type="date" name="dob" value={form.dob || ""} onChange={onChange} /></div>
              </div>
              <div className="acc-two">
                <div className="acc-form-col">
                  <label>Giới tính</label>
                  <div className="seg-group">
                    <label className="seg-option"><input type="radio" name="sex" value="male" checked={form.sex === "male"} onChange={onChange} /><span className="seg-btn">Nam</span></label>
                    <label className="seg-option"><input type="radio" name="sex" value="female" checked={form.sex === "female"} onChange={onChange} /><span className="seg-btn">Nữ</span></label>
                  </div>
                </div>
                <div className="acc-form-col"><label>Email</label><input type="email" name="email" value={form.email} onChange={onChange} /></div>
              </div>
              <div className="acc-one"><label>Số điện thoại</label><input name="phone" value={form.phone} onChange={onChange} /></div>
            </div>
          )}
        </section>

        {/* Box 3: Address */}
        <section className="acc-sec">
          <div className="acc-sec-head">
            <h3>Địa chỉ</h3>
            {!editAddr ? (
              <button className="acc-edit" onClick={() => setEditAddr(true)}><FontAwesomeIcon icon={faPen} /> Edit</button>
            ) : (
              <div className="acc-edit-actions">
                <button className="btn-tertiary" onClick={() => {
                  setEditAddr(false);
                  const a = user.profile?.address || {};
                  setAddr({
                    country:a.country||"", countryCode:a.countryCode||"",
                    city:a.city||"", regionCode:a.regionCode||"",
                    district:a.district||"", districtCode:a.districtCode||"",
                    ward:a.ward||"", wardCode:a.wardCode||""
                  });
                  setGeo(a.regionCode && regionCenters[a.regionCode] ? regionCenters[a.regionCode] : null);
                  setDistricts([]); setWards([]);
                }}>
                  <FontAwesomeIcon icon={faXmark} /> Hủy
                </button>
                <button className="btn-success" onClick={saveAddr} disabled={savingAddr}>{savingAddr ? "Đang lưu..." : "Lưu"}</button>
              </div>
            )}
          </div>

          {!editAddr && (
            <div className="acc-grid">
              <div className="acc-field"><span className="label">Quốc gia</span><span className="value">{user.profile?.address?.country || "-"}</span></div>
              <div className="acc-field"><span className="label">Thành phố</span><span className="value">{user.profile?.address?.city || "-"}</span></div>
              <div className="acc-field"><span className="label">Quận/Huyện</span><span className="value">{user.profile?.address?.district || "-"}</span></div>
              <div className="acc-field"><span className="label">Phường/Xã</span><span className="value">{user.profile?.address?.ward || "-"}</span></div>
            </div>
          )}

          {editAddr && (
            <div className="acc-form">
              {/* Country */}
              <div className="acc-one">
                <label>Quốc Gia</label>
                <select
                  value={addr.countryCode || ""}
                  onChange={(e) => {
                    const code = e.target.value;
                    const item = countries.find((x) => x.code === code) || null;
                    setAddr((a) => ({
                      ...a,
                      countryCode: item?.code || "", country: item?.name || "",
                      regionCode:"", city:"", districtCode:"", district:"", wardCode:"", ward:""
                    }));
                    setGeo(null); setDistricts([]); setWards([]);
                  }}
                >
                  <option value="">-- Chọn Quốc Gia --</option>
                  {countries.map((c) => (<option key={c.code} value={c.code}>{c.name}</option>))}
                </select>
              </div>

              {/* City / Region */}
              <div className="acc-one">
                <label>Thành Phố</label>
                <select
                  disabled={addr.countryCode !== "VN"}
                  value={addr.regionCode || ""}
                  onChange={(e) => {
                    const code = e.target.value;
                    const item = regionsVN.find((x) => x.code === code) || null;
                    const center = regionCenters[code];
                    setAddr((a) => ({
                      ...a,
                      regionCode: item?.code || "", city: item?.name || "",
                      districtCode:"", district:"", wardCode:"", ward:""
                    }));
                    setGeo(Array.isArray(center) ? center : null);
                  }}
                >
                  <option value="">-- Chọn Thành Phố --</option>
                  {regionsVN.map((r) => (<option key={r.code} value={r.code}>{r.name}</option>))}
                </select>
              </div>

              {/* District */}
              <div className="acc-one">
                <label>Quận</label>
                <select
                  disabled={!addr.regionCode}
                  value={addr.districtCode || ""}
                  onChange={(e) => {
                    const code = e.target.value;
                    let display = "", list = [];
                    if (addr.regionCode === "HN") {
                      import("../../../data/locations/vn/districts-HN.json").then((m) => {
                        const arr = m.default || [];
                        const item = arr.find((x) => x.code === code) || null;
                        display = item?.name || "";
                        setAddr((a) => ({ ...a, districtCode: code, district: display, wardCode:"", ward:"" }));
                      });
                      import("../../../data/locations/vn/wards-HN.json").then((m) => {
                        const map = m.default || {};
                        list = Array.isArray(map[code]) ? map[code] : [];
                        setWards(list.map((name, i) => ({ code: String(i+1).padStart(2,"0"), name })));
                      });
                    } else if (addr.regionCode === "HCM") {
                      import("../../../data/locations/vn/districts-HCM.json").then((m) => {
                        const arr = m.default || [];
                        const item = arr.find((x) => x.code === code) || null;
                        display = item?.name || "";
                        setAddr((a) => ({ ...a, districtCode: code, district: display, wardCode:"", ward:"" }));
                      });
                      import("../../../data/locations/vn/wards-HCM.json").then((m) => {
                        const map = m.default || {};
                        list = Array.isArray(map[code]) ? map[code] : [];
                        setWards(list.map((name, i) => ({ code: String(i+1).padStart(2,"0"), name })));
                      });
                    }
                  }}
                >
                  <option value="">-- Chọn Quận --</option>
                  {districts.map((d) => (<option key={d.code} value={d.code}>{d.name}</option>))}
                </select>
              </div>

              {/* Ward */}
              <div className="acc-one">
                <label>Phường</label>
                <select
                  disabled={!addr.districtCode || wards.length===0}
                  value={addr.wardCode || ""}
                  onChange={(e) => {
                    const code = e.target.value;
                    const item = wards.find((w) => w.code === code) || null;
                    setAddr((a) => ({ ...a, wardCode: item?.code || "", ward: item?.name || "" }));
                  }}
                >
                  <option value="">{wards.length ? "-- Chọn Phường --" : "Không có dữ liệu Phường"}</option>
                  {wards.map((w) => (<option key={w.code} value={w.code}>{w.name}</option>))}
                </select>
              </div>
            </div>
          )}
        </section>
      </div>

      <AvatarCropper open={cropOpen} src={cropSrc} onClose={() => setCropOpen(false)} onConfirm={onCropConfirm} />
    </div>
  );
}
