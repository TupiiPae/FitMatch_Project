import { useEffect, useRef } from "react";

const MODAL_SELECTOR = [
  ".modal",
  ".wc-picker-overlay",
  ".MuiModal-root",
  ".MuiDialog-root",
  ".ReactModal__Overlay",
  "[role='dialog'][aria-modal='true']",
  "[data-fm-modal='true']",
].join(",");

const getScrollY = () =>
  window.scrollY ||
  document.documentElement.scrollTop ||
  document.body.scrollTop ||
  0;

const isVisibleModal = (el) => {
  if (!el || typeof window === "undefined") return false;
  const style = window.getComputedStyle(el);
  if (!style) return false;
  if (style.display === "none" || style.visibility === "hidden") return false;
  if (el.getAttribute("aria-hidden") === "true") return false;

  const r = el.getBoundingClientRect();
  if ((r.width === 0 && r.height === 0) && el.getClientRects().length === 0) return false;

  return true;
};

export default function useGlobalModalScrollLock() {
  const stRef = useRef({ locked: false, y: 0 });

  useEffect(() => {
    const apply = () => {
      const nodes = Array.from(document.querySelectorAll(MODAL_SELECTOR));
      const hasModal = nodes.some(isVisibleModal);
      const st = stRef.current;

      if (hasModal && !st.locked) {
        st.locked = true;
        st.y = getScrollY();

        document.documentElement.classList.add("fm-noscroll");
        document.body.classList.add("fm-noscroll");

        const sbw = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.paddingRight = sbw > 0 ? `${sbw}px` : "";

        document.body.style.position = "fixed";
        document.body.style.top = `-${st.y}px`;
        document.body.style.left = "0";
        document.body.style.right = "0";
        document.body.style.width = "100%";
        return;
      }

      if (!hasModal && st.locked) {
        st.locked = false;

        document.documentElement.classList.remove("fm-noscroll");
        document.body.classList.remove("fm-noscroll");

        const y = st.y || 0;

        document.body.style.position = "";
        document.body.style.top = "";
        document.body.style.left = "";
        document.body.style.right = "";
        document.body.style.width = "";
        document.body.style.paddingRight = "";

        window.scrollTo({ top: y, behavior: "auto" });
        return;
      }

      if (hasModal && st.locked) {
        const sbw = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.paddingRight = sbw > 0 ? `${sbw}px` : "";
      }

      if (!hasModal && !st.locked) {
        document.body.style.paddingRight = "";
      }
    };

    apply();

    const obs = new MutationObserver(() => apply());
    obs.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("resize", apply);

    return () => {
      obs.disconnect();
      window.removeEventListener("resize", apply);

      const st = stRef.current;
      const y = st.y || 0;

      document.documentElement.classList.remove("fm-noscroll");
      document.body.classList.remove("fm-noscroll");

      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      document.body.style.paddingRight = "";

      if (st.locked) window.scrollTo({ top: y, behavior: "auto" });
      st.locked = false;
    };
  }, []);
}
