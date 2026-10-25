import * as React from 'react'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'secondary' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'default', size = 'default', ...props }, ref) => {
    let variantStyles = 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
    if (variant === 'outline') {
      variantStyles = 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:scale-[0.98]'
    } else if (variant === 'secondary') {
      variantStyles = 'bg-slate-100 text-slate-800 hover:bg-slate-200 active:scale-[0.98]'
    } else if (variant === 'ghost') {
      variantStyles = 'bg-transparent text-slate-600 hover:bg-slate-100'
    }

    let sizeStyles = 'px-4 py-2 text-sm'
    if (size === 'sm') sizeStyles = 'px-2.5 py-1 text-xs'
    if (size === 'lg') sizeStyles = 'px-6 py-2.5 text-base'

    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center rounded-xl font-semibold transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles} ${sizeStyles} ${className}`}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'
