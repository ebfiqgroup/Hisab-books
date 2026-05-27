import { ReactNode, useState, useRef } from "react";

export function Tooltip({
  children,
  label,
  side = "bottom",
}: {
  children: ReactNode;
  label: string;
  side?: "top" | "bottom" | "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setOpen(true), 250);
  };
  const hide = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(false);
  };

  const sideClass =
    side === "top"
      ? "bottom-full left-1/2 -translate-x-1/2 mb-1.5"
      : side === "left"
        ? "right-full top-1/2 -translate-y-1/2 mr-1.5"
        : side === "right"
          ? "left-full top-1/2 -translate-y-1/2 ml-1.5"
          : "top-full left-1/2 -translate-x-1/2 mt-1.5";

  const arrowClass =
    side === "top"
      ? "top-full left-1/2 -translate-x-1/2 border-t-[var(--brand-ink)]"
      : side === "left"
        ? "right-0 top-1/2 -translate-y-1/2 translate-x-full border-l-[var(--brand-ink)]"
        : side === "right"
          ? "left-0 top-1/2 -translate-y-1/2 -translate-x-full border-r-[var(--brand-ink)]"
          : "bottom-full left-1/2 -translate-x-1/2 border-b-[var(--brand-ink)]";

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      {open && (
        <div
          className={`absolute z-[60] pointer-events-none whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-medium shadow-lg ${sideClass}`}
          style={{
            background: "var(--brand-ink)",
            color: "var(--brand-ivory)",
            fontFamily: "var(--font-body)",
            animation: "brand-fade-up 180ms ease-out",
          }}
        >
          {label}
          <span
            className={`absolute w-0 h-0 border-4 border-transparent ${arrowClass}`}
          />
        </div>
      )}
    </div>
  );
}
