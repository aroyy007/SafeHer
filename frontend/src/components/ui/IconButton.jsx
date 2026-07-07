import React from 'react';

/**
 * IconButton — square icon-only button with hover states.
 *
 * Required props:
 *   - ariaLabel (string) — required for accessibility
 *   - onClick (function)
 */
export function IconButton({
  children,
  ariaLabel,
  onClick,
  variant = 'default',
  isActive = false,
  size = 40,
  style,
  ...rest
}) {
  const variantStyle = {
    default: {
      background: isActive ? 'var(--color-brand-soft)' : 'transparent',
      color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
      border: '1px solid transparent',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--color-text-muted)',
      border: '1px solid transparent',
    },
    danger: {
      background: isActive ? 'var(--color-danger)' : 'var(--color-danger-bg)',
      color: 'var(--color-danger)',
      border: '1px solid transparent',
    },
    outline: {
      background: 'transparent',
      color: 'var(--color-text-primary)',
      border: '1px solid var(--color-border-strong)',
    },
  }[variant];

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: size,
        height: size,
        borderRadius: 'var(--radius-full)',
        cursor: 'pointer',
        transition: 'background var(--transition-fast), color var(--transition-fast), border-color var(--transition-fast), transform 90ms ease-out',
        ...variantStyle,
        ...style,
      }}
      onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.94)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
      {...rest}
    >
      {children}
    </button>
  );
}