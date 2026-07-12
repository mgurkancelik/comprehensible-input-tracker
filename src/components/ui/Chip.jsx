function Chip({
  variant = "filter",
  selected = false,
  disabled = false,
  size = "md",
  icon = null,
  fullWidth = false,
  className = "",
  children,
  type = "button",
  "aria-pressed": ariaPressed,
  ...rest
}) {
  const classNames = [
    "ui-chip",
    `ui-chip--${variant}`,
    `ui-chip--${size}`,
    selected ? "ui-chip--selected" : "",
    fullWidth ? "ui-chip--full-width" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classNames}
      disabled={disabled}
      aria-pressed={ariaPressed !== undefined ? ariaPressed : selected}
      {...rest}
    >
      {icon && <span className="ui-chip__icon">{icon}</span>}
      {children}
    </button>
  );
}

export default Chip;
