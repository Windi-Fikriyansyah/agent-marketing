import * as React from 'react'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className = '', ...props }, ref) => (
  <div
    ref={ref}
    className={`rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xs transition-all ${className}`}
    {...props}
  />
))
Card.displayName = 'Card'

export const CardHeader = React.forwardRef<HTMLDivElement, CardProps>(({ className = '', ...props }, ref) => (
  <div ref={ref} className={`flex flex-col space-y-1.5 p-5 pb-3 border-b border-slate-100 ${className}`} {...props} />
))
CardHeader.displayName = 'CardHeader'

export const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className = '', ...props }, ref) => (
    <h3 ref={ref} className={`font-bold leading-none tracking-tight text-slate-900 ${className}`} {...props} />
  )
)
CardTitle.displayName = 'CardTitle'

export const CardContent = React.forwardRef<HTMLDivElement, CardProps>(({ className = '', ...props }, ref) => (
  <div ref={ref} className={`p-5 pt-4 ${className}`} {...props} />
))
CardContent.displayName = 'CardContent'
