import { useEffect } from "react";
import { AlertCircle, CheckCircle, Info, X } from "lucide-react";

/**
 * Pop-up message dialog.
 * type: success / error / info
 */
export default function Modal({ type = "info", title, children, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const styles = {
    success: { icon: <CheckCircle size={20} />, tone: "bg-emerald-500/10 text-emerald-500" },
    error: { icon: <AlertCircle size={20} />, tone: "bg-red-500/10 text-red-500" },
    info: { icon: <Info size={20} />, tone: "bg-blue-500/10 text-blue-500" },
  }[type];

  return (
    <div className="fixed inset-0 z-50 !m-0 flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="card !p-0 w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-5 py-4">
          <span className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center ${styles.tone}`}>{styles.icon}</span>
          <h3 className="flex-1 min-w-0 text-base font-semibold text-ink break-words">{title}</h3>
          <button onClick={onClose} aria-label="Tutup" className="w-8 h-8 shrink-0 rounded-full text-gray-400 hover:text-ink hover:bg-dark-800 flex items-center justify-center">
            <X size={16} />
          </button>
        </div>
        <div className="px-5 pb-4 text-sm text-gray-300 max-h-[60vh] overflow-y-auto break-words">{children}</div>
        <div className="px-5 pb-5 flex justify-end">
          <button onClick={onClose} className="btn btn-secondary">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
