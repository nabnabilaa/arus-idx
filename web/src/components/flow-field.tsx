"use client";

import { motion, useReducedMotion } from "motion/react";

/** Slow-drifting current lines behind the hero — the one decorative surface in the app. */
export function FlowField() {
  const reduce = useReducedMotion();
  const lines = Array.from({ length: 9 }, (_, i) => i);
  const wave = (y: number, amp: number) => {
    let d = `M -200 ${y}`;
    for (let x = -200; x <= 1800; x += 200) {
      d += ` Q ${x + 100} ${y + (Math.abs(x / 200) % 2 === 0 ? -amp : amp)} ${x + 200} ${y}`;
    }
    return d;
  };
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden [mask-image:radial-gradient(ellipse_70%_60%_at_60%_40%,black,transparent)]">
      <svg className="absolute -top-10 left-0 h-[130%] w-[140%]" viewBox="0 0 1600 600" preserveAspectRatio="none">
        <defs>
          <linearGradient id="flow" x1="0" x2="1">
            <stop offset="0" stopColor="#5cc8ff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#5cc8ff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#3987e5" stopOpacity="0" />
          </linearGradient>
        </defs>
        {lines.map((i) => (
          <motion.path
            key={i}
            d={wave(120 + i * 42, 18 + (i % 3) * 10)}
            stroke="url(#flow)"
            strokeWidth={i % 3 === 0 ? 1.4 : 0.8}
            fill="none"
            initial={{ x: 0, opacity: 0 }}
            animate={reduce ? { opacity: 0.5 } : { x: [-200, 0], opacity: 0.25 + (i % 4) * 0.12 }}
            transition={
              reduce
                ? { duration: 0 }
                : {
                    x: { duration: 18 + i * 3, repeat: Infinity, ease: "linear" },
                    opacity: { duration: 1.2, delay: i * 0.08 },
                  }
            }
          />
        ))}
      </svg>
    </div>
  );
}
