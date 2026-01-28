import { useEffect, useState } from "react";
import "./ScrollTopButton.css";

export default function ScrollTopButton({ showAfter = 250 }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setShow(window.scrollY > showAfter);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [showAfter]);

  const goTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      type="button"
      className={`stb ${show ? "show" : ""}`}
      onClick={goTop}
      title="Lên đầu trang"
      aria-label="Lên đầu trang"
    >
      <i className="fa-solid fa-chevron-up"></i>
    </button>
  );
}