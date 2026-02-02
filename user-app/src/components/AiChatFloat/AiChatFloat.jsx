import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import AiChatBox from "../../pages/Chat/AiChatBox.jsx";
import "./AiChatFloat.css";

export default function AiChatFloat({ meId }) {
  const myId = String(meId || "").trim();
  const [open, setOpen] = useState(false);
  const [vp, setVp] = useState(() => ({
    w: window.innerWidth,
    h: Math.round(window.visualViewport?.height || window.innerHeight),
  }));

  const loc = useLocation();
  const pathname = String(loc?.pathname || "");
  const hideOnMessages = pathname === "/tin-nhan" || pathname.startsWith("/tin-nhan/");

  const canShow = !!myId && !hideOnMessages;

  const close = () => setOpen(false);
  const toggle = () => setOpen((v) => !v);

  useEffect(() => {
    if (hideOnMessages) setOpen(false);
  }, [hideOnMessages]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    const update = () => {
      setVp({
        w: window.innerWidth,
        h: Math.round(window.visualViewport?.height || window.innerHeight),
      });
    };

    update();
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);

    return () => {
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const b = document.body;
    const prev = b.style.overflow;
    b.style.overflow = "hidden";
    return () => {
      b.style.overflow = prev;
    };
  }, [open]);

  const isMobile = vp.w <= 768;
  const headerH = 52;

  const modalHeight = useMemo(() => {
    const h = vp.h || window.innerHeight;
    if (isMobile) return Math.max(320, h - headerH);
    return Math.max(420, Math.min(720, h - 120));
  }, [vp.h, isMobile]);

  if (!canShow) return null;

  return (
    <>
      <button
        type="button"
        className={"fm-ai-float-bubble" + (open ? " is-open" : "")}
        onClick={toggle}
        title="Chat với FitMatch AI"
        aria-label="Chat với FitMatch AI"
      >
        <img className="fm-ai-bb" src="/images/ai-chatbot.png" alt="FitMatch AI" />
      </button>

      {open
        ? createPortal(
            <div
              className="fm-ai-float-overlay"
              onMouseDown={(e) => {
                if (e.target === e.currentTarget) close();
              }}
            >
              <div className="fm-ai-float-modal" role="dialog" aria-modal="true">
                <div className="fm-ai-float-head">
                  <div className="fm-ai-float-title">
                    <img className="fm-ai-ava" src="/images/ai-chatbot.png" alt="FitMatch AI" />
                    <span>FitMatch AI</span>
                  </div>

                  <button
                    type="button"
                    className="fm-ai-float-iconbtn"
                    onClick={close}
                    title="Đóng"
                    aria-label="Đóng"
                  >
                    <i className="fa-solid fa-xmark" />
                  </button>
                </div>

                <div className="fm-ai-float-body">
                  <AiChatBox meId={myId} height={modalHeight} />
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
