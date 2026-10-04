"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

export const C = {
  up: "#3987e5",
  down: "#e66767",
  current: "#5cc8ff",
  ink: "#e9eef6",
  ink2: "#aab5c7",
  muted: "#75839a",
  grid: "rgb(148 163 184 / 0.10)",
  axis: "rgb(148 163 184 / 0.28)",
  neutral: "#1c2638",
  warn: "#fab219",
};

/** Observe the container width so charts are crisp and responsive without a library. */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

export function Tooltip({ x, y, show, children }: { x: number; y: number; show: boolean; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.08 } }}
          transition={{ duration: 0.12, ease: [0.23, 1, 0.32, 1] }}
          className="pointer-events-none absolute z-20 min-w-36 -translate-x-1/2 -translate-y-full rounded-lg border border-line-strong bg-raised/95 px-3 py-2 text-xs text-ink-2 shadow-[0_10px_30px_-8px_rgb(0_0_0/0.7)] backdrop-blur-md"
          style={{ left: x, top: y - 10 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ChartTitle({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="mb-3">
      <h3 className="text-[15px] font-semibold tracking-tight text-ink">{children}</h3>
      {note && <p className="mt-1 max-w-[70ch] text-[13px] leading-relaxed text-muted">{note}</p>}
    </div>
  );
}
