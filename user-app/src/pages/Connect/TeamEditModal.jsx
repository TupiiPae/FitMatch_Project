// user-app/src/pages/Connect/TeamEditModal.jsx
import React,{useEffect,useMemo,useRef,useState} from "react";
import "./CreateTeam.css";
import { toast } from "react-toastify";

function getInitials(name){if(!name)return"FM";return String(name).trim().split(/\s+/).map(p=>p?.[0]).join("").slice(0,2).toUpperCase();}
function getGenderLabel(g){if(g==="male")return"Nam";if(g==="female")return"Nữ";if(!g)return"Chưa cập nhật";return"Khác";}
function calcAge(dob){
  if(!dob) return null;
  const d=new Date(dob); if(Number.isNaN(d.getTime())) return null;
  const t=new Date(); let a=t.getFullYear()-d.getFullYear();
  const md=t.getMonth()-d.getMonth(); if(md<0||(md===0&&t.getDate()<d.getDate())) a--;
  return a;
}

export default function TeamEditModal({ open, onClose, saving, form, setForm, onSave, AGE_LABELS, GENDER_LABELS, FREQ_LABELS, ownerUser, goalLabel, baseLocationLabel }){
  const fileRef=useRef(null);
  const [preview,setPreview]=useState("");
  const set=(k,v)=>setForm(s=>({...s,[k]:v}));

  const cover=(form?.coverImageUrl||"").trim();
  const name=(form?.name||"").trim();
  const desc=(form?.description||"");
  const ageKey=form?.ageRange||"all";
  const genderKey=form?.gender||"all";
  const freqKey=form?.trainingFrequency||"1-2";
  const maxMembers=Number(form?.maxMembers||5);

  const ageLabel=(AGE_LABELS?.[ageKey]??ageKey??"Tất cả");
  const genderLabel=(GENDER_LABELS?.[genderKey]??(genderKey==="male"?"Nam":genderKey==="female"?"Nữ":"Tất cả"));
  const freqLabel=(FREQ_LABELS?.[freqKey]??freqKey??"1-2 buổi/tuần");

  const imgSrc=preview||cover;

  const pickImage=()=>!saving&&fileRef.current?.click();
  const onPickFile=(e)=>{
    const f=e.target.files?.[0];
    if(!f) return;
    if(!f.type?.startsWith("image/")){toast.error("Vui lòng chọn file ảnh.");e.target.value="";return;}
    if(f.size>5*1024*1024){toast.error("Ảnh tối đa 5MB.");e.target.value="";return;}
    if(preview) URL.revokeObjectURL(preview);
    const url=URL.createObjectURL(f);
    setPreview(url);
    set("coverFile",f);
  };

  useEffect(()=>()=>{ if(preview) URL.revokeObjectURL(preview); },[preview]);

  const canSave=useMemo(()=>{
    const okName=name.length>0&&name.length<=50;
    const okDesc=String(desc).trim().length>0&&String(desc).trim().length<=300;
    const okCover=!!imgSrc; // có ảnh cũ hoặc preview mới
    return okName&&okDesc&&okCover&&!saving;
  },[name,desc,imgSrc,saving]);

  useEffect(()=>{
    if(!open) return;
    const prev=document.body.style.overflow;
    document.body.style.overflow="hidden";
    const onKey=(e)=>{ if(e.key==="Escape" && !saving) onClose?.(); };
    window.addEventListener("keydown",onKey);
    return()=>{ document.body.style.overflow=prev; window.removeEventListener("keydown",onKey); };
  },[open,saving,onClose]);

  const ownerName=ownerUser?.name||"Chủ nhóm";
  const ownerAvatar=ownerUser?.avatarUrl||null;
  const ownerSex=ownerUser?.sex||ownerUser?.gender||null;
  const ownerDob=ownerUser?.dob||ownerUser?.dateOfBirth||null;
  const ownerAge=calcAge(ownerDob);
  const ownerSub=`${getGenderLabel(ownerSex)}${typeof ownerAge==="number"?` ~ ${ownerAge} tuổi`:""}`;

  const fixedGoal=String(goalLabel||"Chưa thiết lập").trim();
  const fixedLoc=String(baseLocationLabel||"Chưa cập nhật địa chỉ").trim();

  if(!open) return null;

  return (
    <div className="tc-modal-backdrop tc-edit-backdrop" onClick={()=>!saving&&onClose?.()}>
      <div className="tc-edit-surface" onClick={(e)=>e.stopPropagation()}>
        <div className="ct-head ct-head--modal">
          <div><h1 className="ct-title">Chỉnh sửa nhóm</h1></div>
          <button type="button" className="ct-close" onClick={()=>!saving&&onClose?.()} disabled={saving} title="Đóng">×</button>
        </div>

        <section className="ct-card">
          <div className="ct-prefhdr"><div className="ct-preftitle">Thông tin nhóm</div></div>

          <form onSubmit={(e)=>{e.preventDefault(); if(canSave) onSave?.();}}>
            <div className="ct-grid">
              {/* LEFT */}
              <div className="ct-leftbox">
                <div className="ct-leftbody">
                  <div className="ct-row-top">
                    <div className="ct-uploader" onClick={pickImage} role="button" tabIndex={0} onKeyDown={(e)=>{if(e.key==="Enter"||e.key===" ") pickImage();}}>
                      {imgSrc
                        ? <img src={imgSrc} alt="cover" onError={(e)=>{e.currentTarget.src="/images/avatar.png";}} />
                        : <div className="ct-up-empty"><i className="fa-regular fa-image" /><span>Chọn ảnh nhóm</span><small>PNG/JPG · ≤ 5MB</small></div>
                      }
                      <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} style={{display:"none"}} disabled={saving}/>
                    </div>

                    <div className="ct-field ct-grow ct-name">
                      <label>Tên nhóm *</label>
                      <input value={form?.name||""} onChange={(e)=>set("name",e.target.value)} maxLength={50} placeholder="Tên nhóm của bạn là?" required disabled={saving}/>
                    </div>
                  </div>

                  {/* ✅ BỎ CHỈNH SỬA VỊ TRÍ (giữ nguyên gốc khi tạo nhóm) */}

                  <div className="ct-row-2">
                    <div className="ct-field">
                      <label>Độ tuổi *</label>
                      <select value={ageKey} onChange={(e)=>set("ageRange",e.target.value)} required disabled={saving}>
                        {Object.keys(AGE_LABELS||{}).map(k=><option key={k} value={k}>{AGE_LABELS[k]}</option>)}
                      </select>
                    </div>
                    <div className="ct-field">
                      <label>Giới tính *</label>
                      <select value={genderKey} onChange={(e)=>set("gender",e.target.value)} required disabled={saving}>
                        {Object.keys(GENDER_LABELS||{}).map(k=><option key={k} value={k}>{GENDER_LABELS[k]}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="ct-row-2">
                    <div className="ct-field">
                      <label>Mức độ tập luyện *</label>
                      <select value={freqKey} onChange={(e)=>set("trainingFrequency",e.target.value)} required disabled={saving}>
                        {Object.keys(FREQ_LABELS||{}).map(k=><option key={k} value={k}>{FREQ_LABELS[k]}</option>)}
                      </select>
                    </div>
                    <div className="ct-field">
                      <label>Số thành viên tối đa *</label>
                      <select value={maxMembers} onChange={(e)=>set("maxMembers",Number(e.target.value))} required disabled={saving}>
                        {[2,3,4,5].map(n=><option key={n} value={n}>{n} người</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="ct-field ct-desc">
                    <label>Mô tả nhóm *</label>
                    <textarea value={form?.description||""} onChange={(e)=>set("description",e.target.value)} maxLength={300} placeholder="Hãy chia sẻ những gì bạn tìm kiếm ở các thành viên nhóm..." required disabled={saving}/>
                    <div className="ct-counter ct-counter-in">{String(desc||"").length}/300</div>
                  </div>
                </div>
              </div>

              {/* RIGHT */}
              <aside className="ct-right">
                <div className="ct-rightbox">
                  {/* ✅ usercard giống CreateTeam: hiển thị CHỦ PHÒNG HIỆN TẠI */}
                  <div className="ct-sidecard ct-usercard">
                    <div className="ct-sidehead">
                      <div className="ct-sideava">{ownerAvatar?<img src={ownerAvatar} alt={ownerName} onError={(e)=>{e.currentTarget.src="/images/avatar.png";}}/>:<span>{getInitials(ownerName)}</span>}</div>
                      <div className="ct-sidename">
                        <div className="ct-sidenick">{ownerName}</div>
                        <div className="ct-sidesub">{ownerSub}</div>
                      </div>
                    </div>
                    <div className="ct-sidehint">Đây là chủ phòng hiện tại của nhóm.</div>
                  </div>

                  {/* ✅ mục tiêu gốc của nhóm (không chỉnh sửa) */}
                  <div className="ct-sidecard ct-highlight">
                    <div className="ct-hl-head">
                      <span className="ct-hl-ico"><i className="fa-solid fa-bullseye" /></span>
                      <span className="ct-hl-label">Mục tiêu tập luyện</span>
                    </div>
                    <div className="ct-hl-value">{fixedGoal?fixedGoal.toUpperCase():"CHƯA THIẾT LẬP"}</div>
                    <div className="ct-hl-hint">Mục tiêu này là dữ liệu gốc của nhóm (không thể chỉnh sửa).</div>
                  </div>

                  {/* ✅ vị trí gốc của nhóm (không chỉnh sửa) */}
                  <div className="ct-sidecard ct-highlight">
                    <div className="ct-hl-head">
                      <span className="ct-hl-ico"><i className="fa-solid fa-location-dot" /></span>
                      <span className="ct-hl-label">Vị trí của nhóm</span>
                    </div>
                    <div className="ct-hl-value ct-hl-value--small">{fixedLoc||"Chưa cập nhật địa chỉ"}</div>
                    <div className="ct-hl-hint">Vị trí này là dữ liệu gốc của nhóm (không thể chỉnh sửa).</div>
                  </div>

                  <div className="ct-tip"><div className="ct-tip-text">Mẹo: Click vào ảnh để đổi ảnh nhóm.</div></div>
                </div>
              </aside>
            </div>

            <div className="ct-actionsbar">
              <button type="button" className="ct-btn ct-btn-cancel" onClick={()=>!saving&&onClose?.()} disabled={saving}>Hủy</button>
              <button type="submit" className={"ct-btn ct-btn-create"+(canSave?" is-ready":"")} disabled={!canSave}>{saving?"Đang lưu...":"Lưu thay đổi"}</button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
