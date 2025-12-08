import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Cuộn lên toạ độ 0,0 (góc trên cùng) mỗi khi pathname thay đổi
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}