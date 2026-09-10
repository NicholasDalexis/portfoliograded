import { useEffect } from "react";
import { useLocation } from "wouter";

/** New pages start at their heading; direct lesson links wait for lazy content. */
export function RouteScroll() {
  const [location] = useLocation();
  useEffect(() => {
    let observer: MutationObserver | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    function position() {
      observer?.disconnect();
      clearTimeout(timeout);
      let id = "";
      try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { /* Invalid fragments use the page start. */ }
      if (!id) { window.scrollTo(0, 0); return; }
      const scroll = () => {
        const target = document.getElementById(id);
        if (!target) return false;
        target.scrollIntoView({ block: "start" });
        observer?.disconnect();
        clearTimeout(timeout);
        return true;
      };
      if (!scroll()) {
        observer = new MutationObserver(scroll);
        observer.observe(document.body, { childList: true, subtree: true });
        timeout = setTimeout(() => observer?.disconnect(), 2000);
      }
    }
    position();
    window.addEventListener("hashchange", position);
    return () => { observer?.disconnect(); clearTimeout(timeout); window.removeEventListener("hashchange", position); };
  }, [location]);
  return null;
}
