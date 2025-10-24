import React, { useState } from "react";
import { createFood } from "../../lib/api.js";
import "./Create.css";

export default function FoodCreate(){
  const [form, setForm] = useState({ name:"", massG:100, unit:"g" });
  const [msg, setMsg] = useState("");

  const onChange = (k, v) => setForm(s => ({ ...s, [k]: v }));
  const onSubmit = async (e) => {
    e.preventDefault();
    setMsg("");
    const body = {
      ...form,
      kcal: num(form.kcal),
      proteinG: num(form.proteinG),
      carbG: num(form.carbG),
      fatG: num(form.fatG),
      saltG: num(form.saltG),
      sugarG: num(form.sugarG),
      fiberG: num(form.fiberG),
    };
    await createFood(body);
    setMsg("Tạo món thành công!");
  };

  return (
    <div>
      <h2>➕ Tạo món ăn</h2>
      <form onSubmit={onSubmit} className="fc-grid">
        <label>Tên<input value={form.name} onChange={e=>onChange("name", e.target.value)} required /></label>
        <label>Khối lượng chuẩn (g/ml)<input type="number" value={form.massG} onChange={e=>onChange("massG", Number(e.target.value))} required /></label>
        <label>Đơn vị<select value={form.unit} onChange={e=>onChange("unit", e.target.value)}><option>g</option><option>ml</option></select></label>
        <label>Kcal<input type="number" value={form.kcal||""} onChange={e=>onChange("kcal", e.target.value)} /></label>
        <label>Protein (g)<input type="number" value={form.proteinG||""} onChange={e=>onChange("proteinG", e.target.value)} /></label>
        <label>Carb (g)<input type="number" value={form.carbG||""} onChange={e=>onChange("carbG", e.target.value)} /></label>
        <label>Fat (g)<input type="number" value={form.fatG||""} onChange={e=>onChange("fatG", e.target.value)} /></label>
        <label>Salt (g)<input type="number" value={form.saltG||""} onChange={e=>onChange("saltG", e.target.value)} /></label>
        <label>Sugar (g)<input type="number" value={form.sugarG||""} onChange={e=>onChange("sugarG", e.target.value)} /></label>
        <label>Fiber (g)<input type="number" value={form.fiberG||""} onChange={e=>onChange("fiberG", e.target.value)} /></label>
        <button>Tạo</button>
      </form>
      {msg && <div className="fc-ok">{msg}</div>}
    </div>
  );
}
function num(v){ const n = Number(v); return Number.isFinite(n)? n : undefined; }
