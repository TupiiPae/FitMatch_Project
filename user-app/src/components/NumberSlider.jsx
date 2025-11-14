import { useId } from "react";
import "./number-slider.css";

export default function NumberSlider({ label, value, setValue, min, max, step, suffix, marks = [] }) {
  const id = useId();
  return (
    <div className="ns-wrap">
      <label htmlFor={id} className="ns-label">{label}</label>
      <div className="ns-value">{value}{suffix}</div>
      <input
        id={id}
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="ns-range"
      />
      {marks?.length ? (
        <div className="ns-marks">
          {marks.map((m) => (
            <span key={m} style={{ left: `${(m-min)/(max-min)*100}%` }}>|</span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
