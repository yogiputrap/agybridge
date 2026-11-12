import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Custom dropdown selector: custom rendered dropdown aligning with trigger,
 * automatically opening upward when vertical space below is limited.
 */
export default function Select({ value, onChange, options, className = "", disabled = false }) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState({ dropUp: false, maxHeight: 240 });
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    if (disabled) return;
    if (!open && rootRef.current) {
      const rect = rootRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      // Estimate dropdown height (max 240px)
      const desired = Math.min(options.length * 40 + 10, 240);
      if (spaceBelow >= desired || spaceBelow >= spaceAbove) {
        setPlacement({ dropUp: false, maxHeight: Math.min(spaceBelow - 8, desired) });
      } else {
        setPlacement({ dropUp: true, maxHeight: Math.min(spaceAbove - 8, desired) });
      }
    }
    setOpen((v) => !v);
  };

  const current = options.find((o) => o.value === value);

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        className={`w-full h-10 flex items-center justify-between gap-2 text-left bg-dark-800 border border-dark-700 rounded-xl px-3.5 text-ink text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 ${
          open ? "ring-2 ring-purple-500/30 border-purple-500/50" : ""
        } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:border-dark-600"}`}
      >
        <span className="truncate">{current ? current.label : ""}</span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div
          role="listbox"
          style={{ maxHeight: Math.max(placement.maxHeight, 96) }}
          className={`absolute left-0 right-0 z-30 overflow-y-auto rounded-2xl border border-dark-700 bg-dark-900 p-1.5 shadow-card ${
            placement.dropUp ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 sm:py-2 rounded-xl text-left text-sm ${
                o.value === value
                  ? "bg-purple-600/10 text-purple-500"
                  : "text-gray-200 hover:bg-dark-800"
              }`}
            >
              <span className="truncate">{o.label}</span>
              {o.value === value && <Check size={14} className="shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
