import Button from "./Button";

function ErrorState({
  title,
  description,
  icon = "⚠️",
  retryLabel = "Tekrar Dene",
  onRetry,
  className = "",
  role = "alert",
  children,
}) {
  const classNames = ["ui-error-state", className].filter(Boolean).join(" ");

  return (
    <div className={classNames} role={role}>
      <div className="ui-error-state__content">
        {icon && (
          <span className="ui-error-state__icon" aria-hidden="true">
            {icon}
          </span>
        )}
        {title && (
          <p className="ui-error-state__title">
            <strong>{title}</strong>
          </p>
        )}
        {description && (
          <p className="ui-error-state__description">{description}</p>
        )}
        {children}
      </div>

      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
}

export default ErrorState;
