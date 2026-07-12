function LoadingState({ label = "Yükleniyor...", icon = null, className = "", children }) {
  const classNames = ["empty-text", "ui-loading-state", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classNames} role="status" aria-atomic="true">
      {icon && (
        <span className="ui-loading-state__icon" aria-hidden="true">
          {icon}
        </span>
      )}

      {label && <span className="ui-loading-state__label">{label}</span>}

      {children}
    </div>
  );
}

export default LoadingState;
