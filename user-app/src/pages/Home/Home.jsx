// src/pages/Home/Home.jsx
import React from "react";

export default function Home() {
  return (
    <div style={{
      textAlign: "center",
      padding: "60px 20px",
    }}>
      <h1>🎯 Chào mừng bạn đến với FitMatch!</h1>
      <p>Đây là trang chính của người dùng sau khi hoàn tất onboarding.</p>

      <div style={{ marginTop: "24px" }}>
        <button
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            border: "none",
            borderRadius: "6px",
            background: "#1976d2",
            color: "#fff",
            cursor: "pointer"
          }}
        >
          Bắt đầu hành trình!
        </button>
      </div>
    </div>
  );
}
