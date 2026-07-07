import React from 'react';

/**
 * Button — pill-radius button built on the project's .btn utilities.
 *
 * Variants: primary | secondary | ghost | danger | outline | tertiary
 * Sizes:    sm | md | lg
 */
const SIZE_CLASSES = {
  sm: { padding: '0.4rem 0.875rem', fontSize: '0.8125rem', minHeight: 34 },
  md: { padding: '0.625rem 1.125rem', fontSize: '0.9375rem', minHeight: 42 },
  lg: { padding: '0.75rem 1.5rem', fontSize: '1rem', minHeight: 50 },
};

const VARIANT_CLASSES = {
  primary: 'btn btn-primary',
  secondary: 'btn btn-secondary',
  ghost: 'btn btn-ghost',
  danger: 'btn btn-danger',
  outline: 'btn btn-secondary',
  tertiary: 'btn btn-tertiary',
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
  const v = VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary;
  const s = SIZE_CLASSES[size] || SIZE_CLASSES.md;
  const isInactive = disabled || isLoading;

  const computedStyle = {
    padding: s.padding,
    fontSize: s.fontSize,
    minHeight: s.minHeight,
    width: fullWidth ? '100%' : 'auto',
    ...style,
  };

  return (
    <button
      type={type}
      onClick={isInactive ? undefined : onClick}
      disabled={isInactive}
      className={v}
      style={computedStyle}
      {...rest}
    >
      {leftIcon ? <span aria-hidden="true" style={{ display: 'inline-flex' }}>{leftIcon}</span> : null}
      <span>{isLoading ? 'Loading…' : children}</span>
      {rightIcon ? <span aria-hidden="true" className="btn-arrow" style={{ display: 'inline-flex' }}>{rightIcon}</span> : null}
    </button>
  );
}