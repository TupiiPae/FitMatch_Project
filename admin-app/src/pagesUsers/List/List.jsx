import React, { useEffect, useState } from "react";
import { listUsers, blockUser, unblockUser } from "../../lib/api.js";
import "./List.css";

export default function UsersList(){
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { items } = await listUsers({ q, limit: 50 });
      setItems(items || []);
    } finally { setLoading(false); }
  };
  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, []);

  return (
    <div>
      <h2>👤 Danh sách người dùng</h2>
      <form onSubmit={(e)=>{e.preventDefault(); load();}} className="ul-row">
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Tên / email / SĐT / địa chỉ..." />
        <button>Tìm</button>
      </form>

      {loading ? "Đang tải..." : (
        <div className="ul-table">
          <div className="ul-thead">
            <div>Tên</div><div>Giới tính</div><div>Email</div><div>SĐT</div><div>Địa chỉ</div><div>Trạng thái</div><div>Thao tác</div>
          </div>
          {items.map(u=>(
            <div key={u._id} className="ul-trow">
              <div>{u.username || u.profile?.nickname || "—"}</div>
              <div>{u.profile?.sex ?? "—"}</div>
              <div>{u.email}</div>
              <div>{u.phone || "—"}</div>
              <div>{[u.profile?.address?.city,u.profile?.address?.district,u.profile?.address?.ward].filter(Boolean).join(", ") || "—"}</div>
              <div>{u.blocked ? "blocked" : "active"}</div>
              <div className="ul-actions">
                {!u.blocked ? (
                  <button onClick={async ()=>{ await blockUser(u._id); await load(); }}>Block</button>
                ) : (
                  <button onClick={async ()=>{ await unblockUser(u._id); await load(); }}>Mở</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
