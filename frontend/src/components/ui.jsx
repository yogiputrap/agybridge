import { Check, Copy, Loader2 } from "lucide-react";
import { forwardRef, useState } from "react";

/* Shared building blocks for every panel page. Keep pages free of ad-hoc
   styling: compose these, and use the `.input` / `.label` classes from index.css. */

const cx = (...parts) => parts.filter(Boolean).join(" ");

export function Card({ className = "", children, ...rest }) {
  return (
    <section className={cx("card min-w-0", className)} {...rest}>
      {children}
    </section>
  );
}

/** Title row of a card: optional round icon, title, subtitle and a right-aligned action area. */
export function CardHeader({ icon: Icon, title, subtitle, action, className = "" }) {
  return (
    <div className={cx("flex flex-wrap items-center justify-between gap-x-4 gap-y-3 mb-5", className)}>
      <div className="flex items-center gap-3 min-w-0">
        {Icon && (
          <span className="w-10 h-10 shrink-0 rounded-full bg-purple-600/10 text-purple-500 flex items-center justify-center">
            <Icon size={18} />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-ink leading-tight break-words">{title}</h2>
          {subtitle && <p className="text-sm text-gray-400 mt-0.5 break-words">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex flex-wrap items-center gap-2 min-w-0">{action}</div>}
    </div>
  );
}

const BUTTON_VARIANTS = {
  primary: "btn btn-primary",
  secondary: "btn btn-secondary",
  danger: "btn btn-danger",
  ghost: "btn btn-ghost",
};

const BUTTON_SIZES = {
  sm: "!px-3.5 !py-1.5 !text-xs",
  md: "",
  lg: "!px-6 !py-3 !text-base",
};

export const Button = forwardRef(function Button(
  { variant = "secondary", size = "md", icon: Icon, loading = false, className = "", children, type = "button", ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(BUTTON_VARIANTS[variant], BUTTON_SIZES[size], "inline-flex items-center justify-center gap-2 whitespace-nowrap", className)}
      disabled={rest.disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : Icon ? <Icon size={15} /> : null}
      {children}
    </button>
  );
});

/** Round icon-only button. `label` is required for accessibility. */
export function IconButton({ icon: Icon, label, className = "", tone = "default", ...rest }) {
  const tones = {
    default: "text-gray-400 hover:text-ink hover:bg-dark-700",
    danger: "text-gray-400 hover:text-red-500 hover:bg-red-500/10",
    accent: "text-purple-500 hover:bg-purple-500/10",
  };
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cx("w-9 h-9 shrink-0 rounded-full bg-dark-800 flex items-center justify-center transition-colors disabled:opacity-40", tones[tone], className)}
      {...rest}
    >
      <Icon size={16} />
    </button>
  );
}

export function Field({ label, hint, error, htmlFor, className = "", children }) {
  return (
    <div className={cx("min-w-0", className)}>
      {label && (
        <label htmlFor={htmlFor} className="label">
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 text-xs text-red-500 break-words">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-gray-500 break-words">{hint}</p>
      )}
    </div>
  );
}

export const Input = forwardRef(function Input({ className = "", ...rest }, ref) {
  return <input ref={ref} className={cx("input", className)} {...rest} />;
});

export const Textarea = forwardRef(function Textarea({ className = "", rows = 3, ...rest }, ref) {
  return <textarea ref={ref} rows={rows} className={cx("input !h-auto py-2.5 resize-y", className)} {...rest} />;
});

const BADGE_TONES = {
  neutral: "bg-dark-800 text-gray-300",
  accent: "bg-purple-600/10 text-purple-500",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  danger: "bg-red-500/10 text-red-600 dark:text-red-400",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

const DOT_TONES = {
  neutral: "bg-gray-500",
  accent: "bg-purple-500",
  success: "bg-emerald-500",
  danger: "bg-red-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
};

export function Badge({ tone = "neutral", dot = false, icon: Icon, className = "", children }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium max-w-full", BADGE_TONES[tone], className)}>
      {dot && <span className={cx("w-1.5 h-1.5 rounded-full shrink-0", DOT_TONES[tone])} />}
      {Icon && <Icon size={12} className="shrink-0" />}
      <span className="truncate">{children}</span>
    </span>
  );
}

export function Switch({ checked, onChange, label, disabled = false, id }) {
  return (
    <label className={cx("inline-flex items-center gap-3 select-none", disabled ? "opacity-50" : "cursor-pointer")}>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx("relative w-11 h-6 shrink-0 rounded-full transition-colors", checked ? "bg-purple-600" : "bg-dark-600")}
      >
        <span className={cx("absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform", checked ? "translate-x-5" : "")} />
      </button>
      {label && <span className="text-sm text-gray-300">{label}</span>}
    </label>
  );
}

/** Pill segmented control, like the top navigation. Scrolls horizontally instead of overflowing. */
export function Tabs({ tabs, value, onChange, className = "" }) {
  return (
    <div className={cx("max-w-full overflow-x-auto", className)}>
      <div className="inline-flex items-center gap-0.5 rounded-full bg-dark-900 border border-dark-700/60 shadow-pill p-1.5">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = t.id === value;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onChange(t.id)}
              className={cx(
                "px-3.5 py-2 text-sm font-medium rounded-full whitespace-nowrap flex items-center gap-1.5 transition-colors",
                active ? "bg-purple-600 text-white shadow-md shadow-purple-600/30" : "text-gray-400 hover:text-ink hover:bg-dark-800"
              )}
            >
              {Icon && <Icon size={14} />}
              {t.label}
              {t.badge != null && (
                <span className={cx("text-[11px] rounded-full px-1.5 py-0.5", active ? "bg-white/20" : "bg-dark-700")}>{t.badge}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const TILE_TONES = {
  accent: "bg-purple-600/10 text-purple-500",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  danger: "bg-red-500/10 text-red-600 dark:text-red-400",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  neutral: "bg-dark-800 text-gray-400",
};

export function StatCard({ icon: Icon, label, value, caption, tone = "accent" }) {
  return (
    <div className="card !p-4 sm:!p-5 flex items-center gap-4 min-w-0">
      {Icon && (
        <span className={cx("w-11 h-11 shrink-0 rounded-full flex items-center justify-center", TILE_TONES[tone])}>
          <Icon size={19} />
        </span>
      )}
      <div className="min-w-0">
        <div className="text-2xl font-semibold tracking-tight text-ink truncate">{value}</div>
        <div className="text-sm text-gray-400 truncate">{label}</div>
        {caption && <div className="text-xs text-gray-500 truncate">{caption}</div>}
      </div>
    </div>
  );
}

const NOTICE_TONES = {
  info: "bg-blue-500/10 border-blue-500/25 text-blue-700 dark:text-blue-300",
  success: "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300",
  danger: "bg-red-500/10 border-red-500/25 text-red-700 dark:text-red-300",
};

export function Notice({ tone = "info", icon: Icon, title, className = "", children }) {
  return (
    <div className={cx("rounded-2xl border px-4 py-3 text-sm flex gap-3 min-w-0", NOTICE_TONES[tone], className)}>
      {Icon && <Icon size={18} className="shrink-0 mt-0.5" />}
      <div className="min-w-0 break-words">
        {title && <div className="font-semibold mb-0.5">{title}</div>}
        <div className="opacity-90">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, hint, action, className = "" }) {
  return (
    <div className={cx("flex flex-col items-center justify-center text-center py-12 px-4", className)}>
      {Icon && (
        <span className="w-14 h-14 rounded-full bg-dark-800 text-gray-400 flex items-center justify-center mb-4">
          <Icon size={24} />
        </span>
      )}
      <div className="text-base font-medium text-ink">{title}</div>
      {hint && <p className="text-sm text-gray-400 mt-1 max-w-sm">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Scrollable table wrapper; the table itself never widens the page. */
export function TableShell({ children, className = "" }) {
  return <div className={cx("overflow-x-auto rounded-2xl border border-dark-700/60 max-w-full", className)}>{children}</div>;
}

export function CopyButton({ value, label = "Salin", className = "" }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable (insecure context): the text stays selectable */
    }
  };
  return (
    <Button size="sm" variant="secondary" onClick={copy} className={className} icon={copied ? Check : Copy}>
      {copied ? "Tersalin" : label}
    </Button>
  );
}

/** Monospace block: wraps long lines, scrolls when tall, never widens its container. */
export function CodeBlock({ children, maxHeight = 320, className = "" }) {
  return (
    <pre
      style={{ maxHeight }}
      className={cx(
        "max-w-full overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-dark-800 border border-dark-700/60 p-4 text-xs leading-relaxed font-mono text-gray-300",
        className
      )}
    >
      {children}
    </pre>
  );
}

export function Spinner({ size = 18, className = "" }) {
  return <Loader2 size={size} className={cx("animate-spin text-gray-400", className)} />;
}

/** Key/value line used in detail lists. */
export function InfoRow({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5 border-b border-dark-700/50 last:border-0 text-sm">
      <span className="text-gray-400 shrink-0">{label}</span>
      <span className="text-ink text-right min-w-0 break-words">{children}</span>
    </div>
  );
}
