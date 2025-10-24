import React, { useEffect, useMemo, useState } from "react";
import { listFoods, deleteFood, updateFood } from "../../lib/api.js";
import "./List.css";

export default function FoodsList(){
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { items: docs } = await listFoods({ q, status, limit: 100, skip: 0 });
      setItems(docs || []);
    } finally { setLoading(false); }
  };
  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, []);

  const onSearch = (e) => { e.preventDefault(); load(); };
  const onDelete = async (id) => { if(!confirm("Xoá món này?")) return; await deleteFood(id); await load(); };
  const onQuickApprove = async (id) => { await updateFood(id, { status: "approved" }); await load(); };

  const csv = useMemo(()=>{
    const head = ["name","massG","unit","kcal","proteinG","carbG","fatG","saltG","sugarG","fiberG","status"].join(",");
    const rows = items.map(x => [
      x.name, x.massG, x.unit, x.kcal??"", x.proteinG??"", x.carbG??"", x.fatG??"", x.saltG??"", x.sugarG??"", x.fiberG??"", x.status
    ].join(","));
    return [head, ...rows].join("\n");
  }, [items]);

  const downloadCSV = () => {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "foods.csv";
    a.click();
  };

  return (
    <div>
      <h2>🍱 Danh sách món ăn</h2>
      <form onSubmit={onSearch} className="fl-row">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Tìm theo tên..." />
        <select value={status} onChange={e=>setStatus(e.target.value)}>
          <option value="">Tất cả trạng thái</option>
          <option value="pending">pending</option>
          <option value="approved">approved</option>
          <option value="rejected">rejected</option>
        </select>
        <button type="submit">Tìm</button>
        <button type="button" onClick={downloadCSV}>Export CSV</button>
      </form>

      {loading ? "Đang tải..." : (
        <div className="fl-table">
          <div className="fl-thead">
            <div>Tên</div><div>Khối lượng</div><div>Kcal</div><div>P/C/F</div><div>Trạng thái</div><div>Thao tác</div>
          </div>
          {items.map(it=>(
            <div className="fl-trow" key={it._id}>
              <div>{it.name}</div>
              <div>{it.massG}{it.unit}</div>
              <div>{it.kcal ?? "—"}</div>
              <div>{it.proteinG ?? "—"}/{it.carbG ?? "—"}/{it.fatG ?? "—"}</div>
              <div>{it.status}</div>
              <div className="fl-actions">
                {it.status==="pending" && <button onClick={()=>onQuickApprove(it._id)}>Duyệt</button>}
                <button onClick={()=>onDelete(it._id)}>Xoá</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
