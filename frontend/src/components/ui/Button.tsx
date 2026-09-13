import {
  forwardRef,
  cloneElement,
  isValidElement,
  Children,
  type ButtonHTMLAttributes,
} from 'react'
import { cn } from '../../utils/cn'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-indigo-600 text-white shadow-sm shadow-indigo-950/40 hover:bg-indigo-500 focus-visible:ring-indigo-400 active:bg-indigo-700',
  secondary:
    'text-slate-200 border border-slate-700/80 bg-slate-800/40 hover:bg-slate-700/50 hover:border-slate-600 focus-visible:ring-slate-500',
  ghost: 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-200',
  danger:
    'text-red-200 border border-red-500/25 bg-red-500/10 hover:bg-red-500/20 hover:border-red-500/40 focus-visible:ring-red-500',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-sm',
}

const baseClasses =
  'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-[#0b1120] disabled:pointer-events-none disabled:opacity-50'

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', type = 'button', asChild = false, ...props }, ref) => {
    const classes = cn(
      baseClasses,
      variantClasses[variant],
      sizeClasses[size],
      className,
    )

    if (asChild && isValidElement(props.children)) {
      const child = Children.only(props.children) as React.ReactElement<
        Record<string, unknown>
      >
      return cloneElement(child, {
        className: cn(classes, child.props.className as string | undefined),
      })
    }

    return (
      <button
        ref={ref}
        type={type}
        className={classes}
        {...props}
      />
    )
  },
)

Button.displayName = 'Button'