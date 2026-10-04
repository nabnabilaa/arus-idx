"use client";

import * as Popover from "@radix-ui/react-popover";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { GLOSSARY } from "@/lib/glossary";
import { useLang } from "@/lib/i18n";

/** A term with a dotted underline that opens a plain-language explanation. */
export function Term({ k, children }: { k: keyof typeof GLOSSARY | string; children?: React.ReactNode }) {
  const { tx } = useLang();
  const [open, setOpen] = useState(false);
  const term = GLOSSARY[k];
  if (!term) return <>{children}</>;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        className="cursor-help underline decoration-dotted decoration-[1.5px] underline-offset-4 decoration-arus/60 hover:decoration-arus transition-[text-decoration-color] duration-150"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        {children ?? tx(term.title)}
      </Popover.Trigger>
      <AnimatePresence>
        {open && (
          <Popover.Portal forceMount>
            <Popover.Content
              asChild
              side="top"
              sideOffset={8}
              collisionPadding={16}
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <motion.div
                initial={{ opacity: 0, y: 4, scale: 0.97, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, y: 2, scale: 0.98, transition: { duration: 0.12 } }}
                transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
                style={{ transformOrigin: "var(--radix-popover-content-transform-origin)" }}
                className="z-50 max-w-80 rounded-xl border border-line-strong bg-raised/95 p-4 text-left shadow-[0_12px_40px_-8px_rgb(0_0_0/0.6)] backdrop-blur-md"
              >
                <div className="mb-1.5 text-sm font-semibold text-ink">{tx(term.title)}</div>
                <p className="text-[13px] leading-relaxed text-ink-2">{tx(term.body)}</p>
              </motion.div>
            </Popover.Content>
          </Popover.Portal>
        )}
      </AnimatePresence>
    </Popover.Root>
  );
}
