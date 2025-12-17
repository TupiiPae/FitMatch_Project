import React from "react";

export default function TeamEditModal({ open, onClose, saving, form, setForm, onSave, AGE_LABELS, GENDER_LABELS, FREQ_LABELS }) {
  if (!open) return null;
  const set=(k,v)=>setForm(s=>({...s,[k]:v}));
  return (
    <div className="tc-modal-backdrop" onClick={()=>!saving&&onClose?.()}>
      <div className="tc-modal tc-edit-modal" onClick={(e)=>e.stopPropagation()}>
        <h3 className="tc-modal-title">Chỉnh sửa nhóm</h3>

        <div className="tc-form">
          <div className="tc-field">
            <div className="tc-field-lbl">Tên nhóm</div>
            <input className="tc-input" value={form.name||""} onChange={(e)=>set("name",e.target.value)} maxLength={50}/>
          </div>

          <div className="tc-field">
            <div className="tc-field-lbl">Ảnh nhóm (URL)</div>
            <input className="tc-input" value={form.coverImageUrl||""} onChange={(e)=>set("coverImageUrl",e.target.value)} placeholder="https://..."/>
          </div>

          <div className="tc-field">
            <div className="tc-field-lbl">Vị trí hiển thị</div>
            <input className="tc-input" value={form.locationLabel||""} onChange={(e)=>set("locationLabel",e.target.value)}/>
          </div>

          <div className="tc-field-row">
            <div className="tc-field">
              <div className="tc-field-lbl">Nhóm độ tuổi</div>
              <select className="tc-input" value={form.ageRange||"all"} onChange={(e)=>set("ageRange",e.target.value)}>
                {Object.keys(AGE_LABELS||{}).map(k=><option key={k} value={k}>{AGE_LABELS[k]}</option>)}
              </select>
            </div>

            <div className="tc-field">
              <div className="tc-field-lbl">Giới tính</div>
              <select className="tc-input" value={form.gender||"all"} onChange={(e)=>set("gender",e.target.value)}>
                {Object.keys(GENDER_LABELS||{}).map(k=><option key={k} value={k}>{GENDER_LABELS[k]}</option>)}
              </select>
            </div>
          </div>

          <div className="tc-field-row">
            <div className="tc-field">
              <div className="tc-field-lbl">Mức độ tập luyện</div>
              <select className="tc-input" value={form.trainingFrequency||"1-2"} onChange={(e)=>set("trainingFrequency",e.target.value)}>
                {Object.keys(FREQ_LABELS||{}).map(k=><option key={k} value={k}>{FREQ_LABELS[k]}</option>)}
              </select>
            </div>

            <div className="tc-field">
              <div className="tc-field-lbl">Số thành viên tối đa</div>
              <select className="tc-input" value={Number(form.maxMembers||5)} onChange={(e)=>set("maxMembers",Number(e.target.value))}>
                {[2,3,4,5].map(n=><option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <div className="tc-field">
            <div className="tc-field-lbl">Mô tả</div>
            <textarea className="tc-textarea" value={form.description||""} onChange={(e)=>set("description",e.target.value)} rows={4} maxLength={300}/>
          </div>
        </div>

        <div className="tc-modal-actions">
          <button type="button" className="tc-btn-ghost" onClick={()=>!saving&&onClose?.()} disabled={saving}>Hủy</button>
          <button type="button" className="tc-btn-primary" onClick={onSave} disabled={saving}>{saving?"Đang lưu...":"Lưu"}</button>
        </div>
      </div>
    </div>
  );
}
