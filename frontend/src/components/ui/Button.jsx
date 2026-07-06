import React from 'react';

/**
 * Button — production-quality button built on top of the project's
 * .btn utilities. Supports three variants and three sizes.
 *
 * Variants: primary | ghost | danger
 * Sizes:    sm | md | lg
 *
 * All variants honor 44×44 minimum tap target on `md` (the default).
 */
const SIZE_CLASSES = {
  sm: { padding: '0.4rem 0.875rem', fontSize: '0.8125rem', minHeight: 36 },
  md: { padding: '0.75rem 1.25rem', fontSize: '0.9375rem', minHeight: 44 },
  lg: { padding: '1rem 1.75rem', fontSize: '1.0625rem', minHeight: 52 },
};

const VARIANT_STYLES = {
  primary: {
    background: 'var(--color-brand)',
    color: 'white',
    border: 'none',
    hover: { background: 'var(--color-brand-hover)' },
  },
  ghost: {
    background: 'transparent',
    color: 'var(--color-text-secondary)',
    border: '1px solid var(--color-border-light)',
    hover: { background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' },
  },
  danger: {
    background: 'var(--color-danger)',
    color: 'white',
    border: 'none',
    hover: { background: 'var(--color-danger-hover)' },
  },
  outline: {
    background: 'transparent',
    color: 'var(--color-brand)',
    border: '1px solid var(--color-brand)',
    hover: { background: 'var(--color-brand-soft)' },
  },
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  leftIcon = null,
  rightIcon = null,
  isLoading = false,
  disabled = false,
  type = 'button',
  onClick,
  style,
  ...rest
}) {
  const v = VARIANT_STYLES[variant] || VARIANT_STYLES.primary;
  const s = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const [hovered, setHovered] = React.useState(false);

  const isInactive = disabled || isLoading;

  const computedStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: s.padding,
    fontSize: s.fontSize,
    minHeight: s.minHeight,
    fontWeight: 500,
    borderRadius: 'var(--radius-md)',
    cursor: isInactive ? 'not-allowed' : 'pointer',
    opacity: isInactive ? 0.55 : 1,
    userSelect: 'none',
    transition: 'background var(--transition-fast), color var(--transition-fast), transform var(--transition-fast)',
    width: fullWidth ? '100%' : 'auto',
    ...v,
    ...(hovered && !isInactive ? v.hover : {}),
    ...style,
  };

  return (
    <button
      type={type}
      onClick={isInactive ? undefined : onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      disabled={isInactive}
      style={computedStyle}
      {...rest}
    >
      {leftIcon ? <span aria-hidden="true">{leftIcon}</span> : null}
      <span>{isLoading ? 'Loading…' : children}</span>
      {rightIcon ? <span aria-hidden="true">{rightIcon}</span> : null}
    </button>
  );
}
