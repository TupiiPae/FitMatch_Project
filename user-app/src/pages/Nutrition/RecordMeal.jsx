import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  searchFoods, toggleFavoriteFood, addLog, getFood, viewFood
} from "../../api/foods";
import "./RecordMeal.css";
import { toast } from "react-toastify";

const HOUR_OPTIONS = Array.from({length: 18}, (_,i)=> 6+i); // 6..23


export default function RecordMeal(){
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [favorites, setFavorites] = useState(false);
  const [items, setItems] = useState([]);
  const [skip, setSkip] = useState(0);
  const [limit, setLimit] = useState(30);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  // popups
  const [showAdd, setShowAdd] = useState(false);
  const [addFood, setAddFood] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [massG, setMassG] = useState("");
  const [date, setDate] = useState(()=> new Date().toISOString().slice(0,10));
  const [hour, setHour] = useState(12);

  const [showDetail, setShowDetail] = useState(false);
  const [detail, setDetail] = useState(null);

  async function load(reset=false){
    setLoading(true);
    try{
      const params = {
        q: q || undefined,
        scope: (!q && !onlyMine && !favorites) ? "recent" : "all",
        onlyMine: onlyMine || undefined,
        favorites: favorites || undefined,
        limit,
        skip: reset ? 0 : skip
      };
      const { data } = await searchFoods(params);
      const list = data?.items || [];
      setHasMore(!!data?.hasMore);
      setItems(reset ? list : [...items, ...list]);
      setSkip(reset ? list.length : skip + list.length);
    } finally { setLoading(false); }
  }

  useEffect(()=>{ load(true); /* eslint-disable-next-line */ },[]);
  useEffect(()=>{ const t = setTimeout(()=> load(true), 250); return ()=>clearTimeout(t); },[q, onlyMine, favorites]);

  function kcalStr(x){ return (x ?? "-") }
  function gStr(x){ return (x ?? "-") }

  async function onFav(id){
    const { data } = await toggleFavoriteFood(id);
    setItems(items.map(it => it._id===id ? { ...it, isFavorite: data.isFavorite } : it));
  }

  async function openAdd(it){
    setAddFood(it);
    setQuantity(1); setMassG(it.massG ?? ""); setHour(12); setDate(new Date().toISOString().slice(0,10));
    setShowAdd(true);
  }

    async function confirmAdd(){
    try{
        await addLog({ foodId: addFood._id, date, hour, quantity, massG: massG===""? null : Number(massG) });
        setShowAdd(false);
        toast.success("Thêm vào nhật ký thành công");
    }catch(err){
        toast.error(err?.response?.data?.message || "Thêm vào nhật ký thất bại");
    }
    }

  async function openDetail(it){
    const { data } = await getFood(it._id);
    setDetail(data);
    setShowDetail(true);
    // ghi nhận "vừa xem"
    viewFood(it._id).catch(()=>{});
  }

  return (
    <div className="nm-wrap">
      <div className="nm-head">
        <div className="search">
          <i className="fa-solid fa-magnifying-glass"></i>
          <input
            placeholder="Tìm kiếm thực phẩm hoặc món ăn"
            value={q} onChange={e=>{ setQ(e.target.value); }}
          />
        </div>

        <button className="scan" onClick={()=> nav("/dinh-duong/ghi-lai/tinh-calo-ai")}>
          <i className="fa-solid fa-border-all"></i>
        </button>

        <div className="filter">
          <button className="filter-btn">
            Lọc <i className="fa-solid fa-caret-down"></i>
          </button>
          <div className="filter-dd">
            <label><input type="checkbox" checked={onlyMine} onChange={e=>setOnlyMine(e.target.checked)} /> Tạo bởi tôi</label>
            <label><input type="checkbox" checked={favorites} onChange={e=>setFavorites(e.target.checked)} /> Yêu thích</label>
          </div>
        </div>

        <Link to="/dinh-duong/ghi-lai/tao-mon" className="create-btn">Tạo món ăn mới</Link>
      </div>

      <div className="nm-list">
        {items.map(it=>(
          <div key={it._id} className="nm-item" onClick={()=>openDetail(it)}>
            <img src={it.imageUrl || "/images/food-placeholder.jpg"} alt={it.name}/>
            <div className="info">
              <div className="title">{it.name}</div>
              <div className="sub">
                {it.portionName || "Khẩu phần tiêu chuẩn"} · {it.massG ?? "-"} g · {kcalStr(it.kcal)} cal
              </div>
              <div className="macro">
                <span><i className="fa-solid fa-drumstick-bite"></i> Đạm {gStr(it.proteinG)} g</span>
                <span><i className="fa-solid fa-bread-slice"></i> Carb {gStr(it.carbG)} g</span>
                <span><i className="fa-solid fa-bacon"></i> Béo {gStr(it.fatG)} g</span>
              </div>
            </div>
            <div className="act" onClick={(e)=> e.stopPropagation()}>
              <button className={`heart ${it.isFavorite ? "on":""}`} onClick={()=>onFav(it._id)}>
                <i className="fa-solid fa-heart"></i>
              </button>
              <button className="add" onClick={()=>openAdd(it)}>Thêm</button>
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="more">
          <button disabled={loading} onClick={()=>load(false)}>{loading? "Đang tải..." : "Xem thêm"}</button>
        </div>
      )}

      {/* Popup thêm vào nhật ký */}
      {showAdd && (
        <div className="modal" onClick={()=>setShowAdd(false)}>
          <div className="modal-card" onClick={e=>e.stopPropagation()}>
            <h3>Thêm vào nhật ký</h3>
            <p className="muted">{addFood?.name}</p>
            <div className="row">
              <label>Ngày</label>
              <input type="date" value={date} onChange={e=>setDate(e.target.value)} />
            </div>
            <div className="row">
              <label>Giờ</label>
              <select value={hour} onChange={e=>setHour(+e.target.value)}>
                {HOUR_OPTIONS.map(h=> <option key={h} value={h}>{`${h}:00`}</option>)}
              </select>
            </div>
            <div className="row">
              <label>Số lượng khẩu phần</label>
              <input type="number" min="0.1" step="0.1" value={quantity} onChange={e=>setQuantity(+e.target.value)} />
            </div>
            <div className="row">
              <label>Khối lượng (g)</label>
              <input type="number" min="0" step="1" placeholder="mặc định theo món" value={massG} onChange={e=>setMassG(e.target.value)} />
            </div>
            <div className="actions">
              <button onClick={()=>setShowAdd(false)}>Hủy</button>
              <button className="primary" onClick={confirmAdd}>Thêm</button>
            </div>
          </div>
        </div>
      )}

      {/* Popup chi tiết món */}
      {showDetail && !!detail && (
        <div className="modal" onClick={()=>setShowDetail(false)}>
          <div className="modal-card" onClick={e=>e.stopPropagation()}>
            <h3>{detail.name}</h3>
            <div className="grid2">
              <img className="bigimg" src={detail.imageUrl || "/images/food-placeholder.jpg"} alt={detail.name}/>
              <div className="kv">
                <div><b>Khối lượng:</b> {detail.massG ?? "-"} g ({detail.unit || "g"})</div>
                <div><b>Calo:</b> {detail.kcal ?? "-"} cal</div>
                <div><b>Đạm:</b> {detail.proteinG ?? "-"} g</div>
                <div><b>Carb:</b> {detail.carbG ?? "-"} g</div>
                <div><b>Béo:</b> {detail.fatG ?? "-"} g</div>
                <div><b>Muối (NaCl):</b> {detail.saltG ?? "-"} g</div>
                <div><b>Đường:</b> {detail.sugarG ?? "-"} g</div>
                <div><b>Chất xơ:</b> {detail.fiberG ?? "-"} g</div>
                <div><b>Nguồn:</b> {detail.sourceType || "khác"}</div>
              </div>
            </div>
            <div className="muted small">
              * Logic nguồn: <i>thực phẩm tươi</i> (khối lượng linh hoạt, thường không có đường/naCl sẵn) ·
              <i>đóng gói</i> (có label dinh dưỡng — nên nhập đủ macro, đường, muối) ·
              <i>món nấu chín</i> (macro ước lượng theo khẩu phần; massG là khối lượng sau nấu).
            </div>
            <div className="actions">
              <button onClick={()=>setShowDetail(false)}>Đóng</button>
              <button className="primary" onClick={()=>{ setShowDetail(false); openAdd(detail); }}>Thêm vào nhật ký</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
