import type { ButtonHTMLAttributes, ReactNode } from 'react'
import './Button.css'

type Variant = 'primary' | 'ghost' | 'outline' | 'danger'
type Size = 'sm' | 'md' | 'lg'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Optional accent color (CSS color) to tint a primary button. */
  accent?: string
  icon?: ReactNode
  block?: boolean
}

/** Shared button. Sleek, gradient primary, glass ghost, smooth press. */
export function Button({
  variant = 'primary',
  size = 'md',
  accent,
  icon,
  block,
  children,
  className = '',
  style,
  ...rest
}: Props) {
  const accentStyle =
    accent && variant === 'primary'
      ? ({ '--btn-accent': accent } as React.CSSProperties)
      : undefined
  return (
    <button
      className={`rg-btn rg-btn--${variant} rg-btn--${size} ${block ? 'rg-btn--block' : ''} ${className}`}
      style={{ ...accentStyle, ...style }}
      {...rest}
    >
      {icon && <span className="rg-btn__icon">{icon}</span>}
      {children && <span className="rg-btn__label">{children}</span>}
    </button>
  )
}
