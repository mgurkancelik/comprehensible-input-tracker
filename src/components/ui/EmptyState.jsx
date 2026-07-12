function EmptyState({
  title,
  description,
  icon = null,
  action = null,
  className = "",
  children,
}) {
  const classNames = ["empty-text", "ui-empty-state", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classNames}>
      {icon && <span aria-hidden="true">{icon}</span>}
      {title && (
        <p>
          <strong>{title}</strong>
        </p>
      )}
      {description && <p>{description}</p>}
      {children}
      {action}
    </div>
  );
}

export default EmptyState;
