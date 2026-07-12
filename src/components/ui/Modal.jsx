import { useEffect, useId } from "react";

function Modal({
  open,
  onClose,
  title,
  children,
  size = "md",
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseButton = true,
  ariaLabel,
  className = "",
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event) => {
      if (closeOnEscape && event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, closeOnEscape, onClose]);

  if (!open) {
    return null;
  }

  const handleOverlayClick = (event) => {
    if (closeOnBackdrop && event.target === event.currentTarget) {
      onClose();
    }
  };

  const panelClassName = ["modal-panel", `modal-panel--${size}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div
        className={panelClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : ariaLabel}
      >
        {showCloseButton && (
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Kapat"
          >
            ✕
          </button>
        )}

        {title && <h2 id={titleId}>{title}</h2>}

        {children}
      </div>
    </div>
  );
}

export default Modal;
