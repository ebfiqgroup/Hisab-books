// Prevents amount fields (<input type="number">) from changing value accidentally
// via mouse-wheel / touchpad scroll or arrow keys while focused.
if (typeof window !== "undefined" && !(window as any).__ahNumGuard) {
  (window as any).__ahNumGuard = true;
  document.addEventListener(
    "wheel",
    (e) => {
      const el = document.activeElement as HTMLInputElement | null;
      if (el && el.tagName === "INPUT" && el.type === "number" && e.target === el) {
        el.blur();
      }
    },
    { passive: true, capture: true },
  );
  document.addEventListener(
    "keydown",
    (e) => {
      const el = e.target as HTMLInputElement | null;
      if (el && el.tagName === "INPUT" && el.type === "number" && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
        e.preventDefault();
      }
    },
    true,
  );
}
export {};
