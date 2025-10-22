import { useState } from "react";
import { createFood } from "../../api/foods";
import { useNavigate } from "react-router-dom";

export default function CreateFood(){
  const nav = useNavigate();
  const [form, setForm] = useState({
    name:"", massG:"", unit:"g", kcal:"", proteinG:"", carbG:"", fatG:"",
    saltG:"", sugarG:"", fiberG:"", portionName:""
  });
  const [msg, setMsg] = useState("");

  function up(k,v){ setForm(s=>({...s,[k]:v})) }

  async function submit(e){
    e.preventDefault();
    setMsg("");
    if(!form.name || !form.massG){ setMsg("Tên món và Khối lượng là bắt buộc"); return; }
    await createFood({
      ...form,
      massG: Number(form.massG),
      kcal: form.kcal===""? null:Number(form.kcal),
      proteinG: form.proteinG===""? null:Number(form.proteinG),
      carbG: form.carbG===""? null:Number(form.carbG),
      fatG: form.fatG===""? null:Number(form.fatG),
      saltG: form.saltG===""? null:Number(form.saltG),
      sugarG: form.sugarG===""? null:Number(form.sugarG),
      fiberG: form.fiberG===""? null:Number(form.fiberG),
      sourceType: "user_submitted"
    });
    setMsg("Đã gửi yêu cầu. Vui lòng đợi admin duyệt.");
    setTimeout(()=> nav("/dinh-duong/ghi-lai"), 900);
  }

  return (
    <form onSubmit={submit} style={{padding:"12px 16px", maxWidth:640}}>
      <h2>Tạo món ăn mới</h2>
      {msg && <div style={{color:"#1A73E8", margin:"6px 0"}}>{msg}</div>}
      {[
        ["Tên món","name"],["Khối lượng (g)","massG"],["Đơn vị (g/ml)","unit"],["Khẩu phần (tùy chọn)","portionName"],
        ["Calo (cal)","kcal"],["Đạm (g)","proteinG"],["Carb (g)","carbG"],["Béo (g)","fatG"],
        ["Muối (g)","saltG"],["Đường (g)","sugarG"],["Chất xơ (g)","fiberG"]
      ].map(([lbl,key])=>(
        <div key={key} style={{display:"grid",gridTemplateColumns:"200px 1fr",gap:10,margin:"8px 0"}}>
          <label>{lbl}</label>
          <input value={form[key]} onChange={e=>up(key, e.target.value)} />
        </div>
      ))}
      <button className="material-btn btn-primary" type="submit">Gửi duyệt</button>
    </form>
  );
}
