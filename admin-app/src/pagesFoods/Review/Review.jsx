import React, { useEffect, useState } from "react";
import { listFoods, approveFood, rejectFood } from "../../lib/api.js";
import "./Review.css";

export default function FoodsReview(){
  const [items, setItems] = useState([]);
  const load = async ()=> {
    const { items } = await listFoods({ status: "pending", limit: 100 });
    setItems(items || []);
  };
  useEffect(()=>{ load(); }, []);

  const onApprove = async (id)=>{ await approveFood(id); await load(); };
  const onReject  = async (id)=>{ await rejectFood(id); await load(); };

  return (
    <div>
      <h2>✅ Duyệt món người dùng</h2>
      {items.length===0 ? "Không có món pending" : items.map(x=>(
        <div key={x._id} className="fr-row">
          <div className="fr-name">{x.name}</div>
          <div>{x.massG}{x.unit}</div>
          <div className="fr-actions">
            <button onClick={()=>onApprove(x._id)}>Duyệt</button>
            <button onClick={()=>onReject(x._id)}>Từ chối</button>
          </div>
        </div>
      ))}
    </div>
  );
}
