// src/pages/Account/AccountSettings/Account.jsx
import React, { useEffect, useRef, useState } from "react";
import "./Account.css";
import { getMe } from "../../../api/account";
import api from "../../../lib/api";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCamera, faXmark, faCalendarDays } from "@fortawesome/free-solid-svg-icons";
import { toast } from "react-toastify";
import AvatarCropper from "../../../components/AvatarCropper";

import countries from "../../../data/locations/countries.json";
import regionsVN from "../../../data/locations/vn/regions.json";
import regionCenters from "../../../data/locations/vn/region-centers.json";

import { validateNickname, validateEmailGmail, validatePhone } from "../../../lib/validators";

const API_ORIGIN = (api?.defaults?.baseURL || "").replace(/\/+$/, "");
const toAbs = (u) => {
  if (!u) return u;
  try { return new URL(u, API_ORIGIN).toString(); } catch { return u; }
};

export default function AccountInfo() {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const [form, setForm] = useState({
    nickname: "",
    sex: "male",
    dob: "",
    phone: "",
    email: "",
    bio: "",
  });

  const [errs, setErrs] = useState({
    nickname: "",
    email: "",
    phone: "",
  });

  const [addr, setAddr] = useState({
    country: "",
    countryCode: "",
    city: "",
    regionCode: "",
    district: "",
    districtCode: "",
    ward: "",
    wardCode: "",
  });

  const [geo, setGeo] = useState(null); // [lng,lat]
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);

  const [profileVisibility, setProfileVisibility] = useState("private"); // "public" | "private"
  const [chatRequestSetting, setChatRequestSetting] = useState("private"); // "all" | "matched" | "private"

  const [avatarPreview, setAvatarPreview] = useState("/images/avatar.png");
  const fileRef = useRef(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState(null);

  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  /* ----------------- LOAD USER ----------------- */
  useEffect(() => {
    (async () => {
      try {
        const me = await getMe();
        if (me && typeof me === "object") setUser(me);
      } catch {
        toast.error("Không thể tải tài khoản");
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    const p = user.profile || {};
    const a = p.address || {};

    setForm({
      nickname: p.nickname || "",
      sex: p.sex || "male",
      dob: p.dob || "",
      phone: user.phone || "",
      email: user.email || "",
      bio: p.bio || "",
    });

    setAddr({
      country: a.country || "",
      countryCode: a.countryCode || (a.country ? "VN" : ""),
      city: a.city || "",
      regionCode: a.regionCode || "",
      district: a.district || "",
      districtCode: a.districtCode || "",
      ward: a.ward || "",
      wardCode: a.wardCode || "",
    });

    setGeo(a.regionCode && regionCenters[a.regionCode] ? regionCenters[a.regionCode] : null);
    setAvatarPreview(p.avatarUrl ? toAbs(p.avatarUrl) : "/images/avatar.png");

    setProfileVisibility(p.visibility || "private");
    setChatRequestSetting(p.chatRequest || "private");

    setErrs({ nickname: "", email: "", phone: "" });
  }, [user]);

  /* ----------------- LOAD DISTRICTS / WARDS ----------------- */
  useEffect(() => {
    (async () => {
      if (!addr.regionCode) {
        setDistricts([]);
        return;
      }
      try {
        if (addr.regionCode === "HN") {
          const m = await import("../../../data/locations/vn/districts-HN.json");
          setDistricts(m.default || []);
        } else if (addr.regionCode === "HCM") {
          const m = await import("../../../data/locations/vn/districts-HCM.json");
          setDistricts(m.default || []);
        } else {
          setDistricts([]);
        }
      } catch {
        setDistricts([]);
      }
    })();

    setWards([]);
    setAddr((a) => ({ ...a, district: "", districtCode: "", ward: "", wardCode: "" }));
    setGeo(Array.isArray(regionCenters[addr.regionCode]) ? regionCenters[addr.regionCode] : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addr.regionCode]);

  useEffect(() => {
    (async () => {
      if (!addr.regionCode || !addr.districtCode) {
        setWards([]);
        setAddr((a) => ({ ...a, ward: "", wardCode: "" }));
        return;
      }
      try {
        if (addr.regionCode === "HN") {
          const m = await import("../../../data/locations/vn/wards-HN.json");
          const map = m.default || {};
          const list = Array.isArray(map[addr.districtCode]) ? map[addr.districtCode] : [];
          setWards(list.map((name, i) => ({ code: String(i + 1).padStart(2, "0"), name })));
        } else if (addr.regionCode === "HCM") {
          const m = await import("../../../data/locations/vn/wards-HCM.json");
          const map = m.default || {};
          const list = Array.isArray(map[addr.districtCode]) ? map[addr.districtCode] : [];
          setWards(list.map((name, i) => ({ code: String(i + 1).padStart(2, "0"), name })));
        } else {
          setWards([]);
        }
      } catch {
        setWards([]);
      }
    })();
  }, [addr.regionCode, addr.districtCode]);

  /* ----------------- CHANGE HANDLERS ----------------- */
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));

    setErrs((prev) => {
      const next = { ...prev };
      if (name === "nickname") next.nickname = validateNickname(value, { required: true });
      if (name === "phone") next.phone = validatePhone(value);
      return next;
    });
  };

  const handleCountryChange = (e) => {
    const code = e.target.value;
    const item = countries.find((c) => c.code === code) || {};
    setAddr({
      country: item.name || "",
      countryCode: code || "",
      city: "",
      regionCode: "",
      district: "",
      districtCode: "",
      ward: "",
      wardCode: "",
    });
    setGeo(null);
    setDistricts([]);
    setWards([]);
  };

  const handleRegionChange = (e) => {
    const code = e.target.value;
    const item = regionsVN.find((r) => r.code === code) || {};
    const center = regionCenters[code];

    setAddr((a) => ({
      ...a,
      regionCode: code || "",
      city: item.name || "",
      district: "",
      districtCode: "",
      ward: "",
      wardCode: "",
    }));
    setGeo(Array.isArray(center) ? center : null);
  };

  const handleDistrictChange = (e) => {
    const code = e.target.value;
    const item = districts.find((d) => d.code === code) || {};
    setAddr((a) => ({
      ...a,
      districtCode: code || "",
      district: item.name || "",
      ward: "",
      wardCode: "",
    }));
  };

  const handleWardChange = (e) => {
    const code = e.target.value;
    const item = wards.find((w) => w.code === code) || {};
    setAddr((a) => ({
      ...a,
      wardCode: code || "",
      ward: item.name || "",
    }));
  };

  /* ----------------- AVATAR ----------------- */
  const pickAvatar = () => fileRef.current?.click();

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Vui lòng chọn ảnh PNG/JPG");
    if (file.size > 2 * 1024 * 1024) return toast.error("Kích thước ảnh tối đa 2MB");
    const reader = new FileReader();
    reader.onload = () => {
      setCropSrc(reader.result?.toString() || null);
      setCropOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const uploadAvatarDirect = async (file) => {
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      const res = await api.post("/api/user/avatar", fd, { headers: { "Content-Type": "multipart/form-data" } });
      const updated = res?.data?.user;
      const url = res?.data?.avatarUrl;
      if (updated) setUser(updated);
      if (url) setAvatarPreview(toAbs(url));
      toast.success("Đã cập nhật ảnh đại diện!");
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Tải ảnh thất bại");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onCropConfirm = (fileCropped, previewUrl) => {
    setCropOpen(false);
    setAvatarPreview(previewUrl);
    uploadAvatarDirect(fileCropped);
  };

  const removeAvatar = async () => {
    try {
      const res = await api.patch("/api/user/account", { "profile.avatarUrl": "" });
      const updated = res?.data?.user;
      if (updated) setUser(updated);
      setAvatarPreview("/images/avatar.png");
      toast.success("Đã gỡ ảnh đại diện");
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Không thể gỡ avatar");
    }
  };

  /* ----------------- VALIDATE & DIRTY ----------------- */
  const validateInfoAll = () => {
    const eNick = validateNickname(form.nickname, { required: true });
    const eEmail = validateEmailGmail(form.email);
    const ePhone = validatePhone(form.phone);
    const next = { nickname: eNick, email: eEmail, phone: ePhone };
    setErrs(next);
    const hasErr = Object.values(next).some((x) => x);
    return !hasErr;
  };

  useEffect(() => {
    if (!user) {
      setDirty(false);
      return;
    }
    const p = user.profile || {};
    const a = p.address || {};

    const sameForm =
      (form.nickname || "") === (p.nickname || "") &&
      (form.sex || "male") === (p.sex || "male") &&
      (form.dob || "") === (p.dob || "") &&
      (form.phone || "") === (user.phone || "") &&
      (form.email || "") === (user.email || "") &&
      (form.bio || "") === (p.bio || "");

    const sameAddr =
      (addr.country || "") === (a.country || "") &&
      (addr.countryCode || "") === (a.countryCode || (a.country ? "VN" : "")) &&
      (addr.city || "") === (a.city || "") &&
      (addr.regionCode || "") === (a.regionCode || "") &&
      (addr.district || "") === (a.district || "") &&
      (addr.districtCode || "") === (a.districtCode || "") &&
      (addr.ward || "") === (a.ward || "") &&
      (addr.wardCode || "") === (a.wardCode || "");

    const samePref =
      (profileVisibility || "private") === (p.visibility || "private") &&
      (chatRequestSetting || "private") === (p.chatRequest || "private");

    setDirty(!(sameForm && sameAddr && samePref));
  }, [form, addr, profileVisibility, chatRequestSetting, user]);

  /* ----------------- SAVE / CANCEL ----------------- */
  const handleCancel = () => {
    if (!user) return;
    const p = user.profile || {};
    const a = p.address || {};
    setForm({
      nickname: p.nickname || "",
      sex: p.sex || "male",
      dob: p.dob || "",
      phone: user.phone || "",
      email: user.email || "",
      bio: p.bio || "",
    });
    setAddr({
      country: a.country || "",
      countryCode: a.countryCode || (a.country ? "VN" : ""),
      city: a.city || "",
      regionCode: a.regionCode || "",
      district: a.district || "",
      districtCode: a.districtCode || "",
      ward: a.ward || "",
      wardCode: a.wardCode || "",
    });
    setProfileVisibility(p.visibility || "private");
    setChatRequestSetting(p.chatRequest || "private");
    setGeo(a.regionCode && regionCenters[a.regionCode] ? regionCenters[a.regionCode] : null);
    setErrs({ nickname: "", email: "", phone: "" });
  };

  const handleSave = async () => {
    if (!dirty) return;
    if (!validateInfoAll()) {
      toast.error("Thông tin chưa hợp lệ. Vui lòng kiểm tra lại.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        email: form.email,
        phone: form.phone,
        "profile.nickname": form.nickname,
        "profile.dob": form.dob,
        "profile.sex": form.sex,
        "profile.bio": form.bio,
        "profile.address.country": addr.country,
        "profile.address.countryCode": addr.countryCode,
        "profile.address.city": addr.city,
        "profile.address.regionCode": addr.regionCode,
        "profile.address.district": addr.district,
        "profile.address.districtCode": addr.districtCode,
        "profile.address.ward": addr.ward,
        "profile.address.wardCode": addr.wardCode,
        ...(Array.isArray(geo) ? { "profile.location.coordinates": geo } : {}),
        "profile.visibility": profileVisibility,
        "profile.chatRequest": chatRequestSetting,
      };

      const res = await api.patch("/api/user/account", payload);
      const updated = res?.data?.user;
      if (updated) setUser(updated);
      toast.success("Cập nhật thông tin tài khoản thành công!");
    } catch (e) {
      toast.error(e?.response?.data?.message || e?.message || "Cập nhật thất bại");
    } finally {
      setSaving(false);
    }
  };

  /* ----------------- RENDER ----------------- */
  if (!loaded) {
    return (
      <div className="acc-page">
        <div className="acc-loading-text">Đang tải thông tin tài khoản…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="acc-page">
        <div className="acc-error-text">Không tìm thấy dữ liệu tài khoản</div>
      </div>
    );
  }

  return (
    <div className="acc-page">
      <div className="acc-layout">
        {/* LEFT COLUMN */}
        <div className="acc-left">
          <section className="acc-section">
            <h1 className="acc-title-main">Thông tin</h1>

            {/* Nickname */}
            <div className="acc-field-block">
              <label className="acc-label" htmlFor="acc-nickname">
                Nickname <span className="required">*</span>
              </label>
              <p className="acc-box-desc">
                Tên gọi hiển thị công khai trên hồ sơ của bạn.
              </p>
              <input
                id="acc-nickname"
                name="nickname"
                className="acc-input"
                value={form.nickname}
                onChange={handleFormChange}
                placeholder="Nhập nickname của bạn"
              />
              {errs.nickname && <div className="acc-error-text">{errs.nickname}</div>}
            </div>

            {/* Giới tính */}
            <div className="acc-field-block">
              <div className="acc-label">
                Giới tính <span className="required">*</span>
              </div>
              <div className="acc-radio-group">
                <label className="acc-radio">
                  <input
                    type="radio"
                    name="sex"
                    value="male"
                    checked={form.sex === "male"}
                    onChange={handleFormChange}
                  />
                  <span>Nam</span>
                </label>
                <label className="acc-radio">
                  <input
                    type="radio"
                    name="sex"
                    value="female"
                    checked={form.sex === "female"}
                    onChange={handleFormChange}
                  />
                  <span>Nữ</span>
                </label>
              </div>
            </div>

            {/* Ngày sinh */}
            <div className="acc-field-block">
              <label className="acc-label" htmlFor="acc-dob">
                Ngày sinh <span className="required">*</span>
              </label>
              <div className="acc-date-wrapper">
                <input
                  id="acc-dob"
                  type="date"
                  name="dob"
                  className="acc-input acc-input-date"
                  value={form.dob || ""}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={handleFormChange}
                />
                <FontAwesomeIcon icon={faCalendarDays} className="acc-date-icon" />
              </div>
            </div>

            {/* Số điện thoại */}
            <div className="acc-field-block">
              <label className="acc-label" htmlFor="acc-phone">
                Số điện thoại
              </label>
              <input
                id="acc-phone"
                name="phone"
                className="acc-input"
                value={form.phone}
                onChange={handleFormChange}
                placeholder="Nhập số điện thoại"
              />
              {errs.phone && <div className="acc-error-text">{errs.phone}</div>}
            </div>

            {/* Địa chỉ */}
            <div className="acc-field-block">
              <div className="acc-label">Địa chỉ</div>
              <p className="acc-box-desc">
                Bạn cần nhập địa chỉ để có thể sử dụng chức năng "Kết nối". Hệ thống sẽ định vị ví trí của bạn dựa
                trên địa chỉ này để tìm kiếm những người dùng khác gần bạn.
              </p>
              <div className="acc-row-2 acc-row-gap">
                <div>
                  <label className="acc-sub-label" htmlFor="acc-country">
                    Quốc gia
                  </label>
                  <select
                    id="acc-country"
                    className="acc-select"
                    value={addr.countryCode || ""}
                    onChange={handleCountryChange}
                  >
                    <option value="">-- Chọn quốc gia --</option>
                    {countries.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="acc-sub-label" htmlFor="acc-region">
                    Thành phố
                  </label>
                  <select
                    id="acc-region"
                    className="acc-select"
                    value={addr.regionCode || ""}
                    disabled={addr.countryCode !== "VN"}
                    onChange={handleRegionChange}
                  >
                    <option value="">-- Chọn thành phố --</option>
                    {regionsVN.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="acc-row-2 acc-row-gap acc-row-height">
                <div>
                  <label className="acc-sub-label" htmlFor="acc-district">
                    Quận
                  </label>
                  <select
                    id="acc-district"
                    className="acc-select"
                    value={addr.districtCode || ""}
                    disabled={!addr.regionCode}
                    onChange={handleDistrictChange}
                  >
                    <option value="">-- Chọn quận --</option>
                    {districts.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="acc-sub-label" htmlFor="acc-ward">
                    Phường
                  </label>
                  <select
                    id="acc-ward"
                    className="acc-select"
                    value={addr.wardCode || ""}
                    disabled={!addr.districtCode || wards.length === 0}
                    onChange={handleWardChange}
                  >
                    <option value="">
                      {wards.length ? "-- Chọn phường --" : "Không có dữ liệu"}
                    </option>
                    {wards.map((w) => (
                      <option key={w.code} value={w.code}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Bio */}
            <div className="acc-field-block">
              <label className="acc-label" htmlFor="acc-bio">
                Bio
              </label>
              <textarea
                id="acc-bio"
                name="bio"
                className="acc-input-bio"
                value={form.bio}
                onChange={handleFormChange}
                placeholder="Giới thiệu ngắn về bạn"
              />
            </div>
          </section>

          <hr className="acct-divider" />

          {/* Email */}
          <section className="acc-section">
            <h2 className="acc-title-sub">Email</h2>
            <div className="acc-field-block">
              <div className="acc-row-inline">
                <label className="acc-label-inline">Email</label>
                <input className="acc-input acc-input-email" value={form.email} readOnly />
              </div>
              {errs.email && <div className="acc-error-text">{errs.email}</div>}
            </div>
          </section>

          <hr className="acct-divider" />

          {/* Hiển thị hồ sơ */}
          <section className="acc-section">
            <h2 className="acc-title-sub">Hiển thị hồ sơ</h2>

            <div className="acc-radio-block">
              <label className="acc-radio">
                <input
                  type="radio"
                  name="profileVisibility"
                  value="public"
                  checked={profileVisibility === "public"}
                  onChange={(e) => setProfileVisibility(e.target.value)}
                />
                <span>Mọi người ( hồ sơ công khai )</span>
              </label>
              <p className="acc-radio-desc">
                Bất kỳ ai trên Internet có liên kết đến trang cá nhân của bạn đều có thể xem được. Thông tin bạn
                chia sẻ trên trang cá nhân (chẳng hạn như tên và họ, thông tin mạng xã hội, ảnh công khai) sẽ hiển
                thị trên trang cá nhân, trong phần trò chuyện hoặc diễn đàn cộng đồng.
              </p>
            </div>

            <div className="acc-radio-block">
              <label className="acc-radio">
                <input
                  type="radio"
                  name="profileVisibility"
                  value="private"
                  checked={profileVisibility === "private"}
                  onChange={(e) => setProfileVisibility(e.target.value)}
                />
                <span>Chỉ mình tôi ( hồ sơ riêng tư )</span>
              </label>
              <p className="acc-radio-desc">
                ONLY your profile photo, first name and username is visible on your profile, and within chat or the
                community forums.
              </p>
            </div>
          </section>

          <hr className="acct-divider" />

          {/* Cài đặt yêu cầu trò chuyện */}
          <section className="acc-section">
            <h2 className="acc-title-sub">Cài đặt yêu cầu trò chuyện</h2>

            <div className="acc-radio-block">
              <label className="acc-radio">
                <input
                  type="radio"
                  name="chatRequest"
                  value="all"
                  checked={chatRequestSetting === "all"}
                  onChange={(e) => setChatRequestSetting(e.target.value)}
                />
                <span>Tất cả mọi người</span>
              </label>
            </div>

            <div className="acc-radio-block">
              <label className="acc-radio">
                <input
                  type="radio"
                  name="chatRequest"
                  value="matched"
                  checked={chatRequestSetting === "matched"}
                  onChange={(e) => setChatRequestSetting(e.target.value)}
                />
                <span>Chỉ những người dùng đã ghép đôi</span>
              </label>
            </div>

            <div className="acc-radio-block">
              <label className="acc-radio">
                <input
                  type="radio"
                  name="chatRequest"
                  value="private"
                  checked={chatRequestSetting === "private"}
                  onChange={(e) => setChatRequestSetting(e.target.value)}
                />
                <span>Riêng tư</span>
              </label>
            </div>
          </section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="acc-right">
          <div className="acc-avatar-panel">
            <div className="acc-avatar-large">
              <img src={avatarPreview} alt="avatar" />
            </div>
            <button type="button" className="acc-avatar-btn-main" onClick={pickAvatar}>
              <FontAwesomeIcon icon={faCamera} />
              <span>Thay đổi avatar</span>
            </button>
            <button type="button" className="acc-avatar-btn-remove" onClick={removeAvatar}>
              <FontAwesomeIcon icon={faXmark} />
              <span>Gỡ avatar</span>
            </button>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="acc-file"
              onChange={onFile}
            />
          </div>

          {/* Nút Hủy / Lưu cố định cuối màn hình */}
          <div className="acc-actions-bar">
            <button
              type="button"
              className="acc-btn acc-btn-cancel"
              disabled={!dirty || saving}
              onClick={handleCancel}
            >
              Hủy
            </button>
            <button
              type="button"
              className="acc-btn acc-btn-save"
              disabled={!dirty || saving}
              onClick={handleSave}
            >
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        </div>
      </div>

      <AvatarCropper
        open={cropOpen}
        src={cropSrc}
        onClose={() => setCropOpen(false)}
        onConfirm={onCropConfirm}
      />
    </div>
  );
}
