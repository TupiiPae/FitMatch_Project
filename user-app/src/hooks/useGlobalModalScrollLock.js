import { useEffect } from "react";

const MODAL_SELECTOR = [
  ".modal",
  ".wc-picker-overlay",
  ".MuiModal-root",
  ".MuiDialog-root",
  ".ReactModal__Overlay",
  "[role='dialog'][aria-modal='true']",
].join(",");

function applyLock() {
  const hasModal = !!document.querySelector(MODAL_SELECTOR);

  document.documentElement.classList.toggle("fm-noscroll", hasModal);
  document.body.classList.toggle("fm-noscroll", hasModal);

  if (hasModal) {
    const sbw = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.paddingRight = sbw > 0 ? `${sbw}px` : "";
  } else {
    document.body.style.paddingRight = "";
  }
}

export default function useGlobalModalScrollLock() {
  useEffect(() => {
    applyLock();

    const obs = new MutationObserver(() => applyLock());
    obs.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("resize", applyLock);

    return () => {
      obs.disconnect();
      window.removeEventListener("resize", applyLock);
      document.documentElement.classList.remove("fm-noscroll");
      document.body.classList.remove("fm-noscroll");
      document.body.style.paddingRight = "";
    };
  }, []);
}
