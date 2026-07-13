import { useEffect, useState } from "react";

const ICONS = {
  success: "✓",
  info: "ℹ️",
  error: "⚠️",
};

// Tek, global, geçici bir bildirimi temsil eder. App.jsx `key={feedback.id}`
// ile mount ediyor — her yeni bildirim component'i baştan mount ettiği için
// zamanlayıcı her zaman SIFIRDAN başlar, App.jsx'in aralarındaki re-render'lar
// (contents state'i değiştiğinde vb.) süreyi yanlışlıkla uzatmaz/kısaltmaz.
function Snackbar({ type = "info", message, duration = 4000, onDismiss }) {
  const [isPaused, setIsPaused] = useState(false);

  // Süre sınırlı bir bildirimin fare/klavye ile üzerindeyken duraklaması,
  // WCAG "Timing Adjustable" ilkesiyle uyumlu küçük bir erişilebilirlik
  // önlemi — kullanıcı mesajı okurken kaybolmaz.
  useEffect(() => {
    if (!duration || isPaused) {
      return undefined;
    }

    const timer = setTimeout(() => {
      onDismiss?.();
    }, duration);

    return () => {
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, isPaused]);

  if (!message) {
    return null;
  }

  const isError = type === "error";

  return (
    <div className="ui-snackbar-viewport">
      <div
        className={`ui-snackbar ui-snackbar--${type}`}
        role={isError ? "alert" : "status"}
        aria-live={isError ? "assertive" : "polite"}
        aria-atomic="true"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onFocus={() => setIsPaused(true)}
        onBlur={() => setIsPaused(false)}
      >
        <span className="ui-snackbar__icon" aria-hidden="true">
          {ICONS[type] || ICONS.info}
        </span>

        <p className="ui-snackbar__message">{message}</p>

        <button
          type="button"
          className="ui-snackbar__close"
          onClick={onDismiss}
          aria-label="Bildirimi kapat"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default Snackbar;
