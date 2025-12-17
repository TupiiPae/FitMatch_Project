import { useEffect, useMemo, useState } from "react";
import "./TeamManageMembersModal.css";

const safeArr=(v)=>Array.isArray(v)?v:[];
const uniq=(arr)=>Array.from(new Set(safeArr(arr).map(x=>String(x||"")).filter(Boolean)));
const toAbsAva=(u)=>u||"/images/avatar.png";

export default function TeamManageMembersModal({ open, saving=false, members=[], myId=null, onClose, onApply }){
  const [makeOwnerId,setMakeOwnerId]=useState(null);
  const [removeIds,setRemoveIds]=useState([]);

  useEffect(()=>{ if(open){ setMakeOwnerId(null); setRemoveIds([]); } },[open]);

  const list=useMemo(()=>{
    const arr=safeArr(members).map(m=>({ id:String(m.id||""), name:m.name||"Người dùng FitMatch", avatarUrl:toAbsAva(m.avatarUrl), role:m.role||"member" }));
    const owner=arr.find(x=>x.role==="owner")||null;
    const rest=arr.filter(x=>x!==owner).sort((a,b)=>a.name.localeCompare(b.name,"vi"));
    return { owner, rest, all: owner?[owner,...rest]:rest };
  },[members]);

  const removeSet=useMemo(()=>new Set(uniq(removeIds)),[removeIds]);
  const dirty=!!makeOwnerId || removeSet.size>0;

  const toggleMakeOwner=(id)=>{
    id=String(id||""); if(!id) return;
    if(makeOwnerId && makeOwnerId!==id) return; // khóa chỉ 1 người
    setMakeOwnerId(prev=>prev===id?null:id);
    setRemoveIds(prev=>prev.filter(x=>String(x)!==id)); // không cho vừa remove vừa owner
  };

  const toggleRemove=(id)=>{
    id=String(id||""); if(!id) return;
    if(makeOwnerId===id) return; // không remove người đang được chọn làm chủ nhóm
    setRemoveIds(prev=>{
      const s=new Set(prev.map(x=>String(x)));
      if(s.has(id)) s.delete(id); else s.add(id);
      return Array.from(s);
    });
  };

  const undo=(id)=>{
    id=String(id||""); if(!id) return;
    if(makeOwnerId===id) setMakeOwnerId(null);
    setRemoveIds(prev=>prev.filter(x=>String(x)!==id));
  };

  const handleApply=()=>{ if(!dirty||saving) return; onApply?.({ makeOwnerId: makeOwnerId||null, removeIds: Array.from(removeSet) }); };

  if(!open) return null;

  return (
    <div className="tc-mm-backdrop" onClick={()=>{ if(!saving) onClose?.(); }}>
      <div className="tc-mm-modal" onClick={(e)=>e.stopPropagation()}>
        <div className="tc-mm-head">
          <div className="tc-mm-title">Quản lý thành viên</div>
          <button type="button" className="tc-mm-x" onClick={()=>{ if(!saving) onClose?.(); }} aria-label="Đóng">&times;</button>
        </div>

        <div className="tc-mm-body">
          {list.owner && (
            <div className="tc-mm-row is-owner">
              <div className="tc-mm-ava"><img src={list.owner.avatarUrl} alt={list.owner.name} onError={(e)=>{e.currentTarget.src="/images/avatar.png";}} /></div>
              <div className="tc-mm-info">
                <div className="tc-mm-badge">Chủ nhóm</div>
                <div className="tc-mm-name">{list.owner.name}{myId && String(myId)===String(list.owner.id)?" (Bạn)":""}</div>
              </div>
              <div className="tc-mm-actions" />
            </div>
          )}

          {list.rest.map(u=>{
            const isNewOwner=makeOwnerId===u.id;
            const willRemove=removeSet.has(u.id);
            const hasPending=isNewOwner||willRemove;
            const lockMakeOwner=!!makeOwnerId && makeOwnerId!==u.id;
            const disableMakeOwner=lockMakeOwner||willRemove;
            const disableRemove=isNewOwner;

            return (
              <div key={u.id} className={"tc-mm-row"+(hasPending?" is-pending":"")}>
                <div className="tc-mm-ava"><img src={u.avatarUrl} alt={u.name} onError={(e)=>{e.currentTarget.src="/images/avatar.png";}} /></div>

                <div className="tc-mm-info">
                  {isNewOwner && <div className="tc-mm-note is-owner">Chủ nhóm mới</div>}
                  {willRemove && <div className="tc-mm-note is-remove">Mời ra khỏi nhóm</div>}
                  <div className="tc-mm-name">{u.name}{myId && String(myId)===String(u.id)?" (Bạn)":""}</div>
                </div>

                <div className="tc-mm-actions">
                  {hasPending ? (
                    <button type="button" className="tc-mm-link" onClick={()=>undo(u.id)} disabled={saving}>Hoàn tác</button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={"tc-mm-link"+(disableMakeOwner?" is-disabled":"")}
                        onClick={()=>{ if(!disableMakeOwner) toggleMakeOwner(u.id); }}
                        title={lockMakeOwner?"Chỉ có thể chỉ định 1 chủ nhóm. Hoàn tác người đã chọn để chọn người khác.":(willRemove?"Đang chọn mời ra khỏi nhóm.":"")}
                        disabled={saving}
                      >
                        Chỉ định chủ nhóm
                      </button>
                      <span className="tc-mm-sep">|</span>
                      <button
                        type="button"
                        className={"tc-mm-link tc-mm-danger"+(disableRemove?" is-disabled":"")}
                        onClick={()=>{ if(!disableRemove) toggleRemove(u.id); }}
                        title={disableRemove?"Bạn đã chọn người này làm chủ nhóm.":""}
                        disabled={saving}
                      >
                        Mời ra khỏi nhóm
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="tc-mm-foot">
          <button type="button" className="tc-mm-btn tc-mm-ghost" onClick={()=>{ if(!saving) onClose?.(); }} disabled={saving}>Hủy</button>
          <button type="button" className="tc-mm-btn tc-mm-apply" onClick={handleApply} disabled={!dirty||saving}>{saving?"Đang xử lý...":"Áp dụng"}</button>
        </div>
      </div>
    </div>
  );
}
