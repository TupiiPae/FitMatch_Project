import React, { useEffect, useState } from "react";
import './Home.css';

const helloImg = (typeof import.meta !== "undefined" && import.meta.env?.BASE_URL ? import.meta.env.BASE_URL : "/") + "images/home-bg.png";

export default function Home() {
  return (
    // .home-container-fill sẽ là wrapper 1700px
    <div className="home-container-fill">
      {/* .home-image-banner sẽ là card chứa ảnh */}
      <div className="home-image-banner">
        <img 
          src={helloImg} 
          alt="Chào mừng đến với FitMatch" 
          onError={(e) => { e.currentTarget.src = "https://placehold.co/1700x500/f4f6ea/002C3E?text=Xin+Ch%C3%A0o!"; }}
        />
      </div>
    </div>
  );
}

