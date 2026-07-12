function Button({
  variant = "primary",
  size = "md",
  loading = false,
  loadingLabel,
  disabled = false,
  fullWidth = false,
  icon = null,
  type = "button",
  className = "",
  children,
  ...rest
}) {
  const isDisabled = disabled || loading;

  const classNames = [
    "ui-button",
    `ui-button--${variant}`,
    `ui-button--${size}`,
    fullWidth ? "ui-button--full-width" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classNames}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {icon && <span className="ui-button__icon">{icon}</span>}
      {loading ? loadingLabel || "Yükleniyor..." : children}
    </button>
  );
}

export default Button;
