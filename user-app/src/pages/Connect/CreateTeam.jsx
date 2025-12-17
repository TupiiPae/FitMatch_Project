// user-app/src/pages/Connect/CreateTeam.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Connect.css";
import "./CreateTeam.css";
import { toast } from "react-toastify";
import { createTeamRoom } from "../../api/match";
import api from "../../lib/api";

const API_ORIGIN=(api?.defaults?.baseURL||"").replace(/\/+$/,"");
const toAbs=(u)=>{if(!u)return u;try{return new URL(u,API_ORIGIN).toString()}catch{return u}};
const AGE_OPTS=[{v:"all",l:"Tất cả"},{v:"18-21",l:"18-21"},{v:"22-27",l:"22-27"},{v:"28-35",l:"28-35"},{v:"36-45",l:"36-45"},{v:"45+",l:"Trên 45"}];
const GENDER_OPTS=[{v:"all",l:"Tất cả"},{v:"male",l:"Nam"},{v:"female",l:"Nữ"}];
const LV_OPTS=[{v:"1-2",l:"1-2 buổi/tuần"},{v:"2-3",l:"2-3 buổi/tuần"},{v:"3-5",l:"3-5 buổi/tuần"},{v:"5+",l:"Trên 5 buổi/tuần"}];
const MAX_OPTS=[2,3,4,5];
const GOAL_LABELS={giam_can:"Giảm cân",duy_tri:"Duy trì",tang_can:"Tăng cân",giam_mo:"Giảm mỡ",tang_co:"Tăng cơ"};

function getInitials(name){if(!name)return"FM";return name.split(" ").map(p=>p[0]).join("").slice(0,2).toUpperCase();}
function getGenderLabel(g){if(g==="male")return"Nam";if(g==="female")return"Nữ";if(!g)return"Chưa cập nhật";return"Khác";}
function calcAge(dob){
  if(!dob) return null;
  const [yStr,mStr,dStrRaw]=String(dob).split("-");
  const y=Number(yStr), m=Number(mStr||1), d=Number((dStrRaw||"1").slice(0,2));
  const b=new Date(y,m-1,d);
  if(Number.isNaN(b.getTime())) return null;
  const t=new Date();
  let a=t.getFullYear()-b.getFullYear();
  const md=t.getMonth()-b.getMonth();
  if(md<0||(md===0&&t.getDate()<b.getDate())) a--;
  return a;
}

export default function CreateTeam({ currentUser, hasAddressForConnect, onClose, onCreated }){
  const nav=useNavigate();
  const [teamName,setTeamName]=useState("");
  const [ageRange,setAgeRange]=useState("all");
  const [gender,setGender]=useState("all");
  const [trainingLevel,setTrainingLevel]=useState("1-2");
  const [maxMembers,setMaxMembers]=useState(5);
  const [description,setDescription]=useState("");
  const [joinPolicy,setJoinPolicy]=useState("request");
  const [imageFile,setImageFile]=useState(null);
  const [imagePreview,setImagePreview]=useState("");
  const [submitting,setSubmitting]=useState(false);
  const fileRef=useRef(null);

  useEffect(()=>{if(!imageFile){setImagePreview("");return;}const url=URL.createObjectURL(imageFile);setImagePreview(url);return()=>URL.revokeObjectURL(url);},[imageFile]);

  const p=currentUser?.profile||{};
  const avatarUrl=p.avatarUrl?toAbs(p.avatarUrl):null;
  const displayName=p.nickname||p.fullName||currentUser?.username||currentUser?.email||"Người dùng FitMatch";

  const addr=p.address||{};
  const addressText=useMemo(()=>[addr.city,addr.district,addr.ward].filter(Boolean).join(" - "),[addr.city,addr.district,addr.ward]);

  const goalKey=currentUser?.connectGoalKey||p.goal||null;
  const goalLabel=currentUser?.connectGoalLabel||(goalKey&&GOAL_LABELS[goalKey])||"";

  const ageVal=calcAge(p.dob||p.dateOfBirth);
  const sideSub=`${getGenderLabel(p.sex)}${typeof ageVal==="number" ? ` ~ ${ageVal} tuổi` : ""}`;

  const pickImage=()=>fileRef.current?.click();
  const onPickFile=(e)=>{
    const f=e.target.files?.[0];
    if(!f) return;
    if(!f.type?.startsWith("image/")){toast.error("Vui lòng chọn file ảnh.");e.target.value="";return;}
    if(f.size>5*1024*1024){toast.error("Ảnh tối đa 5MB.");e.target.value="";return;}
    setImageFile(f);
  };

  const canSubmit=useMemo(()=>{
    const okName=teamName.trim().length>0&&teamName.trim().length<=50;
    const okDesc=description.trim().length>0&&description.trim().length<=300;
    const okImage=!!imageFile;
    const okAddr=!!addressText;
    const okGoal=!!goalLabel;
    return okName&&okDesc&&okImage&&okAddr&&okGoal&&!!ageRange&&!!gender&&!!trainingLevel&&!!maxMembers&&!submitting;
  },[teamName,description,imageFile,addressText,goalLabel,ageRange,gender,trainingLevel,maxMembers,submitting]);

const submit=async(e)=>{
  e.preventDefault();
  if(!hasAddressForConnect||!addressText){toast.error("Bạn cần cập nhật địa chỉ trước khi tạo nhóm.");nav("/tai-khoan/tai-khoan");return;}
  if(!goalLabel){toast.error("Bạn cần thiết lập mục tiêu tập luyện trước khi tạo nhóm.");nav("/tai-khoan/ho-so");return;}
  if(!canSubmit){toast.error("Vui lòng nhập đầy đủ tất cả thông tin.");return;}
  try{
    setSubmitting(true);
    const fd=new FormData();
    fd.append("cover",imageFile);                 // ✅ BE nhận cover
    fd.append("name",teamName.trim());            // ✅ BE đọc body.name
    fd.append("ageRange",ageRange);
    fd.append("gender",gender);
    fd.append("trainingFrequency",trainingLevel); // ✅ BE đọc body.trainingFrequency
    fd.append("maxMembers",String(maxMembers));
    fd.append("description",description.trim());
    fd.append("joinPolicy",joinPolicy);
    await createTeamRoom(fd);
    toast.success("Tạo nhóm thành công!");
    onCreated?.();
  }catch(err){
    console.log("STATUS:", err?.response?.status);
    console.log("DATA:", err?.response?.data);
    console.log("MSG:", err?.response?.data?.message || err.message);
    toast.error(err?.response?.data?.message || "Không thể tạo nhóm.");
  }finally{
    setSubmitting(false);                         // ✅ tránh bị stuck nút
  }
};

  return (
    <div className="ct-wrap">
      <div className="ct-head">
        <div><h1 className="ct-title">Tạo nhóm</h1></div>
        <button type="button" className="ct-close" onClick={()=>onClose?.()} title="Đóng">×</button>
      </div>

      <section className="ct-card">
        <div className="ct-prefhdr"><div className="ct-preftitle">Thông tin nhóm</div></div>

        <form onSubmit={submit}>
          <div className="ct-grid">
            {/* LEFT */}
            <div className="ct-leftbox">
              <div className="ct-leftbody">
                <div className="ct-row-top">
                  <div className="ct-uploader" onClick={pickImage} role="button" tabIndex={0}>
                    {imagePreview ? <img src={imagePreview} alt="preview" /> : <div className="ct-up-empty"><i className="fa-regular fa-image" /><span>Chọn ảnh nhóm</span><small>PNG/JPG · ≤ 5MB</small></div>}
                    <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} />
                  </div>

                  <div className="ct-field ct-grow ct-name">
                    <label>Tên nhóm *</label>
                    <input value={teamName} onChange={(e)=>setTeamName(e.target.value)} maxLength={50} placeholder="Tên nhóm của bạn là?" required />
                  </div>
                </div>

                <div className="ct-row-2">
                  <div className="ct-field">
                    <label>Độ tuổi *</label>
                    <select value={ageRange} onChange={(e)=>setAgeRange(e.target.value)} required>
                      {AGE_OPTS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </div>
                  <div className="ct-field">
                    <label>Giới tính *</label>
                    <select value={gender} onChange={(e)=>setGender(e.target.value)} required>
                      {GENDER_OPTS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </div>
                </div>

                <div className="ct-row-2">
                  <div className="ct-field">
                    <label>Mức độ tập luyện *</label>
                    <select value={trainingLevel} onChange={(e)=>setTrainingLevel(e.target.value)} required>
                      {LV_OPTS.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                    </select>
                  </div>
                  <div className="ct-field">
                    <label>Số thành viên tối đa *</label>
                    <select value={maxMembers} onChange={(e)=>setMaxMembers(Number(e.target.value))} required>
                      {MAX_OPTS.map(n=><option key={n} value={n}>{n} người</option>)}
                    </select>
                  </div>
                </div>

                <div className="ct-field ct-desc">
                  <label>Mô tả nhóm *</label>
                  <textarea value={description} onChange={(e)=>setDescription(e.target.value)} maxLength={300} placeholder="Hãy chia sẻ những gì bạn tìm kiếm ở các thành viên nhóm, để thu hút những người dùng phù hợp yêu cầu tham gia nhóm của bạn." required />
                  <div className="ct-counter ct-counter-in">{description.length}/300</div>
                </div>

                <div className="ct-joinbox">
                  <div className="ct-join-title-row">
                    <div className="ct-join-title">{joinPolicy==="request"?"Yêu cầu gửi lời mời kết nối":"Không yêu cầu gửi lời mời"}</div>
                    <button type="button" className={"ct-switch"+(joinPolicy==="request"?" is-on":"")} onClick={()=>setJoinPolicy(v=>v==="request"?"open":"request")}><span className="ct-switch-knob"/></button>
                  </div>
                  <div className="ct-join-desc">
                    {joinPolicy==="request"
                      ? "Người dùng muốn tham gia sẽ gửi yêu cầu. Chủ nhóm duyệt thì mới vào nhóm."
                      : "Người dùng có thể tham gia trực tiếp ngay khi thấy nhóm."}
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <aside className="ct-right">
              <div className="ct-rightbox">
                <div className="ct-sidecard ct-usercard">
                  <div className="c">
                    <div className="ct-sideava">{avatarUrl?<img src={avatarUrl} alt={displayName}/>:<span>{getInitials(displayName)}</span>}</div>
                    <div className="ct-sidename">
                      <div className="ct-sidenick">{displayName}</div>
                      <div className="ct-sidesub">{sideSub}</div>
                    </div>
                  </div>
                  <div className="ct-sidehint">Thông tin bên trên sẽ được hiển thị cho người xem và xin tham gia nhóm.</div>
                </div>

                <div className="ct-sidecard ct-highlight">
                  <div className="ct-hl-head">
                    <span className="ct-hl-ico"><i className="fa-solid fa-bullseye" /></span>
                    <span className="ct-hl-label">Mục tiêu tập luyện</span>
                  </div>
                  <div className="ct-hl-value">{(goalLabel||"Chưa thiết lập").toUpperCase()}</div>
                  <div className="ct-hl-hint">Hệ thống sẽ sử dụng "Mục tiêu tập luyện" của bạn để làm mục tiêu cho nhóm.</div>
                </div>

                <div className="ct-sidecard ct-highlight">
                  <div className="ct-hl-head">
                    <span className="ct-hl-ico"><i className="fa-solid fa-location-dot" /></span>
                    <span className="ct-hl-label">Vị trí của nhóm</span>
                  </div>
                  <div className="ct-hl-value ct-hl-value--small">{addressText||"Chưa cập nhật địa chỉ"}</div>
                  <div className="ct-hl-hint">Hệ thống sẽ sử dụng "Địa chỉ" của bạn để chỉ định vị trí cho nhóm.</div>
                </div>

                <div className="ct-tip">
                  <div className="ct-tip-row">
                    <div><div className="ct-tip-text">Chúng tôi khuyên bạn nên xem qua Danh bạ nhóm trước khi tạo nhóm riêng. Có thể có một nhóm phù hợp với bạn.</div></div>
                  </div>
                </div>
              </div>
            </aside>
          </div>

          <div className="ct-actionsbar">
            <button type="button" className="ct-btn ct-btn-cancel" onClick={()=>onClose?.()}>Hủy</button>
            <button type="submit" className={"ct-btn ct-btn-create"+(canSubmit?" is-ready":"")} disabled={!canSubmit}>
              {submitting?"Đang tạo...":"Tạo nhóm"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
