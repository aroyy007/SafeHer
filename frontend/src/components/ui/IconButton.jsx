import React from 'react';

/**
 * IconButton — square, accessibility-friendly icon-only button.
 * Renders a button with a 44×44 minimum tap target and proper aria-label.
 *
 * Required props:
 *   - ariaLabel (string) — required for accessibility
 *   - onClick (function)
 *
 * Optional: variant (default | danger | ghost), isActive (boolean).
 */
export function IconButton({
  children,
  ariaLabel,
  onClick,
  variant = 'default',
  isActive = false,
  size = 44,
  style,
  ...rest
}) {
  const [hovered, setHovered] = React.useState(false);

  const variantStyle = {
    default: {
      background: isActive ? 'var(--color-brand-soft)' : hovered ? 'var(--color-bg-secondary)' : 'transparent',
      color: isActive ? 'var(--color-brand)' : 'var(--color-text-secondary)',
      border: '1px solid transparent',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--color-text-muted)',
      border: '1px solid transparent',
    },
    danger: {
      background: isActive ? 'var(--color-danger)' : hovered ? 'rgba(239,68,68,0.18)' : 'transparent',
      color: isActive ? 'white' : 'var(--color-danger)',
      border: '1px solid transparent',
    },
    outline: {
      background: hovered ? 'var(--color-bg-secondary)' : 'transparent',
      color: 'var(--color-text-primary)',
      border: '1px solid var(--color-border-light)',
    },
  }[variant];

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'background var(--transition-fast), color var(--transition-fast)',
        ...variantStyle,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
