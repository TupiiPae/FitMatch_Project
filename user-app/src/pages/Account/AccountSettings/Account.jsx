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

import {
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";

// >>>>> THÊM: import validators
import {
  validateNickname,
  validateEmailGmail,
  validatePhone,
} from "../../../lib/validators";

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

  // >>>>> THÊM: state lỗi theo field
  const [errs, setErrs] = useState({ nickname: "", email: "", phone: "" });

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
    setGeo(a.regionCode && regionCenters[a.regionCode] ? regionCenters[a.regionCode] : null);
    setEditInfo(false); setEditAddr(false);

    // >>>>> THÊM: reset lỗi khi load user
    setErrs({ nickname: "", email: "", phone: "" });
  }, [user]);

  // >>>>> THÊM: validate theo từng field khi change
  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));

    setErrs((prev) => {
      const next = { ...prev };
      if (name === "nickname") next.nickname = validateNickname(value, { required: true });
      if (name === "email") next.email = validateEmailGmail(value);
      if (name === "phone") next.phone = validatePhone(value);
      return next;
    });
  };

  // Avatar handlers (giữ nguyên)
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
    setAddr((a) => ({ ...a, district: "", districtCode: "", ward: "", wardCode: "" }));
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
    setAddr((a) => ({ ...a, ward: "", wardCode: "" }));
    setWards([]);
    if (!addr.regionCode || !addr.districtCode) return;
    if (addr.regionCode === "HN") {
      import("../../../data/locations/vn/wards-HN.json").then((m) => {
        const map = m.default || {};
        const list = Array.isArray(map[addr.districtCode]) ? map[addr.districtCode] : [];
        setWards(list.map((name, i) => ({ code: String(i + 1).padStart(2, "0"), name })));
      });
    } else if (addr.regionCode === "HCM") {
      import("../../../data/locations/vn/wards-HCM.json").then((m) => {
        const map = m.default || {};
        const list = Array.isArray(map[addr.districtCode]) ? map[addr.districtCode] : [];
        setWards(list.map((name, i) => ({ code: String(i + 1).padStart(2, "0"), name })));
      });
    }
  }, [addr.regionCode, addr.districtCode]);

  // >>>>> THÊM: hàm validate tổng trước khi lưu Box 2
  const validateInfoAll = () => {
    const eNick = validateNickname(form.nickname, { required: true });
    const eEmail = validateEmailGmail(form.email);
    const ePhone = validatePhone(form.phone);
    const next = { nickname: eNick, email: eEmail, phone: ePhone };
    setErrs(next);
    const hasErr = Object.values(next).some((x) => x);
    return !hasErr;
  };

  // Save Box 2
  const saveInfo = async () => {
    // >>>>> THÊM: chặn lưu nếu còn lỗi
    if (!validateInfoAll()) {
      toast.error("Thông tin chưa hợp lệ. Vui lòng chỉnh sửa.");
      return;
    }

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

  // Save Box 3 (địa chỉ) — giữ nguyên
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
              <button className="acc-edit" onClick={() => setEditInfo(true)}><FontAwesomeIcon icon={faPen} /></button>
            ) : (
              <div className="acc-edit-actions">
                <button className="btn-tertiary" onClick={() => { 
                  setEditInfo(false); 
                  const p = user.profile || {}; 
                  setForm({ nickname: p.nickname || "", dob: p.dob || "", sex: p.sex || "male", email: user.email || "", phone: user.phone || "" });
                  setErrs({ nickname: "", email: "", phone: "" });
                }}>
                 Hủy
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
              {/* Hàng 1: Nickname (MUI) */}
              <div className="acc-one">
                <div className="acc-form-col">
                  <TextField
                    label="Nickname"
                    name="nickname"
                    value={form.nickname}
                    onChange={onChange}
                    onBlur={(e)=> setErrs((p)=>({ ...p, nickname: validateNickname(e.target.value, { required: true }) }))}
                    error={Boolean(errs.nickname)}
                    helperText={errs.nickname || ""}
                    fullWidth
                    size="small"
                  />
                </div>
              </div>

              <div className="acc-two">
                <div className="acc-form-col">
                  <FormControl fullWidth size="small">
                    <InputLabel id="gender-select-label">Giới tính</InputLabel>
                    <Select
                      labelId="gender-select-label"
                      label="Giới tính"
                      name="sex"
                      value={form.sex}
                      onChange={onChange}
                      MenuProps={{ disableScrollLock: true }}
                    >
                      <MenuItem value="male">Nam</MenuItem>
                      <MenuItem value="female">Nữ</MenuItem>
                    </Select>
                  </FormControl>
                </div>
                
                <div className="acc-form-col">
                  <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <DatePicker
                      label="Ngày sinh"
                      format="DD/MM/YYYY"
                      value={form.dob ? dayjs(form.dob) : null}
                      onChange={(newValue) => {
                        onChange({
                          target: {
                            name: 'dob',
                            value: newValue ? newValue.format('YYYY-MM-DD') : ''
                          }
                        });
                      }}
                      slotProps={{
                        textField: {
                          size: 'small',
                          fullWidth: true
                        }
                      }}
                    />
                  </LocalizationProvider>
                </div>
              </div>

              {/* Hàng 3: Email (MUI) + SĐT (MUI) */}
              <div className="acc-two">
                <div className="acc-form-col">
                  <TextField
                    label="Email"
                    type="email"
                    name="email"
                    value={form.email}
                    onChange={onChange}
                    onBlur={(e)=> setErrs((p)=>({ ...p, email: validateEmailGmail(e.target.value) }))}
                    error={Boolean(errs.email)}
                    helperText={errs.email || ""}
                    fullWidth
                    size="small"
                  />
                </div>
                <div className="acc-form-col">
                  <TextField
                    label="Số điện thoại"
                    name="phone"
                    value={form.phone}
                    onChange={onChange}
                    onBlur={(e)=> setErrs((p)=>({ ...p, phone: validatePhone(e.target.value) }))}
                    error={Boolean(errs.phone)}
                    helperText={errs.phone || ""}
                    fullWidth
                    size="small"
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Box 3: Address */}
        <section className="acc-sec">
          <div className="acc-sec-head">
            <h3>Địa chỉ</h3>
            {!editAddr ? (
              <button className="acc-edit" onClick={() => setEditAddr(true)}><FontAwesomeIcon icon={faPen} /></button>
            ) : (
              <div className="acc-edit-actions">
                <button className="btn-tertiary" onClick={() => {
                  setEditAddr(false);
                  const a = user.profile?.address || {};
                  setAddr({
                    country: a.country || "", countryCode: a.countryCode || "",
                    city: a.city || "", regionCode: a.regionCode || "",
                    district: a.district || "", districtCode: a.districtCode || "",
                    ward: a.ward || "", wardCode: a.wardCode || ""
                  });
                  setGeo(a.regionCode && regionCenters[a.regionCode] ? regionCenters[a.regionCode] : null);
                  setDistricts([]); setWards([]);
                }}>
                 Hủy
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
                <FormControl fullWidth size="small">
                  <InputLabel id="country-select-label">Quốc Gia</InputLabel>
                  <Select
                    labelId="country-select-label"
                    label="Quốc Gia"
                    value={addr.countryCode || ""}
                    MenuProps={{ disableScrollLock: true }}
                    onChange={(e) => {
                      const code = e.target.value;
                      const item = countries.find((x) => x.code === code) || null;
                      setAddr((a) => ({
                        ...a,
                        countryCode: item?.code || "", country: item?.name || "",
                        regionCode: "", city: "", districtCode: "", district: "", wardCode: "", ward: ""
                      }));
                      setGeo(null); setDistricts([]); setWards([]);
                    }}
                  >
                    <MenuItem value="">-- Chọn Quốc Gia --</MenuItem>
                    {countries.map((c) => (<MenuItem key={c.code} value={c.code}>{c.name}</MenuItem>))}
                  </Select>
                </FormControl>
              </div>

              {/* City / Region */}
              <div className="acc-one">
                <FormControl fullWidth size="small">
                  <InputLabel id="city-select-label">Thành Phố</InputLabel>
                  <Select
                    labelId="city-select-label"
                    label="Thành Phố"
                    disabled={addr.countryCode !== "VN"}
                    value={addr.regionCode || ""}
                    MenuProps={{ disableScrollLock: true }}
                    onChange={(e) => {
                      const code = e.target.value;
                      const item = regionsVN.find((x) => x.code === code) || null;
                      const center = regionCenters[code];
                      setAddr((a) => ({
                        ...a,
                        regionCode: item?.code || "", city: item?.name || "",
                        districtCode: "", district: "", wardCode: "", ward: ""
                      }));
                      setGeo(Array.isArray(center) ? center : null);
                    }}
                  >
                    <MenuItem value="">-- Chọn Thành Phố --</MenuItem>
                    {regionsVN.map((r) => (<MenuItem key={r.code} value={r.code}>{r.name}</MenuItem>))}
                  </Select>
                </FormControl>
              </div>

              {/* District */}
              <div className="acc-one">
                <FormControl fullWidth size="small">
                  <InputLabel id="district-select-label">Quận</InputLabel>
                  <Select
                    labelId="district-select-label"
                    label="Quận"
                    disabled={!addr.regionCode}
                    value={addr.districtCode || ""}
                    MenuProps={{ disableScrollLock: true }}
                    onChange={(e) => {
                      const code = e.target.value;
                      let display = "", list = [];
                      if (addr.regionCode === "HN") {
                        import("../../../data/locations/vn/districts-HN.json").then((m) => {
                          const arr = m.default || [];
                          const item = arr.find((x) => x.code === code) || null;
                          display = item?.name || "";
                          setAddr((a) => ({ ...a, districtCode: code, district: display, wardCode: "", ward: "" }));
                        });
                        import("../../../data/locations/vn/wards-HN.json").then((m) => {
                          const map = m.default || {};
                          list = Array.isArray(map[code]) ? map[code] : [];
                          setWards(list.map((name, i) => ({ code: String(i + 1).padStart(2, "0"), name })));
                        });
                      } else if (addr.regionCode === "HCM") {
                        import("../../../data/locations/vn/districts-HCM.json").then((m) => {
                          const arr = m.default || [];
                          const item = arr.find((x) => x.code === code) || null;
                          display = item?.name || "";
                          setAddr((a) => ({ ...a, districtCode: code, district: display, wardCode: "", ward: "" }));
                        });
                        import("../../../data/locations/vn/wards-HCM.json").then((m) => {
                          const map = m.default || {};
                          list = Array.isArray(map[code]) ? map[code] : [];
                          setWards(list.map((name, i) => ({ code: String(i + 1).padStart(2, "0"), name })));
                        });
                      }
                    }}
                  >
                    <MenuItem value="">-- Chọn Quận --</MenuItem>
                    {districts.map((d) => (<MenuItem key={d.code} value={d.code}>{d.name}</MenuItem>))}
                  </Select>
                </FormControl>
              </div>

              {/* Ward */}
              <div className="acc-one">
                <FormControl fullWidth size="small">
                  <InputLabel id="ward-select-label">Phường</InputLabel>
                  <Select
                    labelId="ward-select-label"
                    label="Phường"
                    disabled={!addr.districtCode || wards.length === 0}
                    value={addr.wardCode || ""}
                    MenuProps={{ disableScrollLock: true }}
                    onChange={(e) => {
                      const code = e.target.value;
                      const item = wards.find((w) => w.code === code) || null;
                      setAddr((a) => ({ ...a, wardCode: item?.code || "", ward: item?.name || "" }));
                    }}
                  >
                    <MenuItem value="">{wards.length ? "-- Chọn Phường --" : "Không có dữ liệu Phường"}</MenuItem>
                    {wards.map((w) => (<MenuItem key={w.code} value={w.code}>{w.name}</MenuItem>))}
                  </Select>
                </FormControl>
              </div>
            </div>
          )}
        </section>
      </div>

      <AvatarCropper open={cropOpen} src={cropSrc} onClose={() => setCropOpen(false)} onConfirm={onCropConfirm} />
    </div>
  );
}
