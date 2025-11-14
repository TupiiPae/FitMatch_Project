import React, { useEffect, useState } from "react";
import { getStats } from "../../lib/api.js";
import "./Dashboard.css";

export default function Dashboard(){
  const [s, setS] = useState({ users:0, scansToday:0, mergesToday:0, nutritionLogUsers:0 });
  useEffect(()=>{ (async()=>{ try{ const d = await getStats(); setS(d||{}); }catch{} })(); }, []);
  return (
    <div className="db-grid">
      <Box label="Số lượng người dùng" value={s.users}/>
      <Box label="Thời gian hoạt động (lượt truy cập)" value="—"/>
      <Box label="Số lần quét AI" value={s.scansToday}/>
      <Box label="User log nhật ký dinh dưỡng" value={s.nutritionLogUsers}/>
      <Box label="Số lần ghép cặp thành công" value={s.mergesToday}/>
    </div>
  );
}

function Box({label,value}) {
  return (
    <div className="db-box">
      <div className="db-muted">{label}</div>
      <div className="db-num">{value ?? "—"}</div>
    </div>
  );
}
