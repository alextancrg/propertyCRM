"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Thin top progress bar that appears the moment an internal link is clicked
 * and finishes when the new route mounts. Gives instant visual feedback while
 * the server-rendered page loads, so a slow response never feels like the
 * click did nothing.
 */
export function RouteProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A pathname change means the new page mounted → complete and hide.
  useEffect(() => {
    if (!visible) return;
    setProgress(100);
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    doneTimer.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 250);
  }, [pathname, visible]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href") ?? "";
      const target = anchor.getAttribute("target");
      const modifier = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
      if (modifier || target === "_blank" || !href.startsWith("/")) return;

      if (doneTimer.current) clearTimeout(doneTimer.current);
      setProgress(8);
      setVisible(true);
      if (timer.current) clearInterval(timer.current);
      timer.current = setInterval(() => {
        setProgress((p) => (p < 92 ? p + (92 - p) * 0.12 : p));
      }, 180);
    }

    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      if (timer.current) clearInterval(timer.current);
      if (doneTimer.current) clearTimeout(doneTimer.current);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-1 overflow-hidden">
      <div
        className="h-full rounded-r-full bg-primary transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
