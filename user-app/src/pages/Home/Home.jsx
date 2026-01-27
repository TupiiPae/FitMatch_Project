import React, { useState, useEffect } from "react";
import "./Home.css";

const heroImg =
  "images/gym_couple.png";

const slides = [
  {
    id: 1,
    titleLine1: "WHERE HARD",
    titleHighlight: "WORK",
    titleLine2: "MEETS SUCCESS",
    description:
      "Kỷ luật là cầu nối giữa mục tiêu và thành tựu. Đừng dừng lại khi mệt mỏi, hãy dừng lại khi đã xong.",
  },
  {
    id: 2,
    titleLine1: "YOUR BODY",
    titleHighlight: "YOUR",
    titleLine2: "RULES",
    description:
      "Sức khỏe là khoản đầu tư giá trị nhất. Hãy kiến tạo phiên bản tốt nhất của chính mình ngay hôm nay.",
  },
  {
    id: 3,
    titleLine1: "NO PAIN",
    titleHighlight: "NO",
    titleLine2: "GAIN",
    description: "Hôm nay đau đớn, ngày mai mạnh mẽ. Vượt qua giới hạn bản thân mỗi ngày.",
  },
];

function SlideDots({ total, activeIndex, onSelect }) {
  return (
    <div className="dots-container" aria-label="Slide dots">
      {Array.from({ length: total }).map((_, index) => (
        <span
          key={index}
          className={`dot ${index === activeIndex ? "active" : ""}`}
          onClick={() => onSelect(index)}
          role="button"
          tabIndex={0}
          aria-label={`Chuyển đến slide ${index + 1}`}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onSelect(index);
          }}
        />
      ))}
    </div>
  );
}

function SlideArrows({ onPrev, onNext }) {
  return (
    <div className="arrows-container" aria-label="Slide arrows">
      <button onClick={onPrev} className="nav-btn" aria-label="Slide trước">
        ❮
      </button>
      <button onClick={onNext} className="nav-btn" aria-label="Slide sau">
        ❯
      </button>
    </div>
  );
}

export default function Home() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      handleNext();
    }, 6000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSlide]);

  const handleNext = () => {
    setFade(false);
    setTimeout(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
      setFade(true);
    }, 1000);
  };

  const handlePrev = () => {
    setFade(false);
    setTimeout(() => {
      setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
      setFade(true);
    }, 1000);
  };

  const handleDotClick = (index) => {
    if (index === currentSlide) return;
    setFade(false);
    setTimeout(() => {
      setCurrentSlide(index);
      setFade(true);
    }, 1000);
  };

  const slide = slides[currentSlide];

  return (
    <div className="hero-section">
      <div className="hero-background">
        <div className="image-wrapper">
          <img src={heroImg} alt="Fitness Model" />
          <div className="fade-overlay"></div>
        </div>
      </div>

      <div className="hero-content">
        <div className="content-wrapper">
          {/* TEXT */}
          <div className={`text-container ${fade ? "fade-in" : "fade-out"}`}>
            <div className="typography-box">
              <h1>{slide.titleLine1}</h1>
              <h1>
                {slide.titleHighlight}{" "}
                <span className="text-red">{slide.titleLine2.split(" ")[0]}</span>
              </h1>
              <h1>{slide.titleLine2.split(" ").slice(1).join(" ")}</h1>
            </div>

            <p className="hero-desc">{slide.description}</p>
          </div>

          <div className="hero-dots">
            <SlideDots total={slides.length} activeIndex={currentSlide} onSelect={handleDotClick} />
          </div>

          <div className="hero-arrows">
            <SlideArrows onPrev={handlePrev} onNext={handleNext} />
          </div>
        </div>
      </div>
    </div>
  );
}