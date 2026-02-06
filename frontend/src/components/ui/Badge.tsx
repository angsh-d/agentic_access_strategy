import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'success' | 'warning' | 'error' | 'info'
  size?: 'sm' | 'md'
  dot?: boolean
  pulse?: boolean
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      className,
      variant = 'neutral',
      size = 'md',
      dot = false,
      pulse = false,
      children,
      ...props
    },
    ref
  ) => {
    const baseStyles = cn(
      'inline-flex items-center font-medium rounded-full',
      'no-select'
    )

    const variants = {
      neutral: cn(
        'bg-grey-200 text-grey-700'
      ),
      success: cn(
        'bg-semantic-success/10 text-semantic-success'
      ),
      warning: cn(
        'bg-semantic-warning/10 text-semantic-warning'
      ),
      error: cn(
        'bg-semantic-error/10 text-semantic-error'
      ),
      info: cn(
        'bg-semantic-info/10 text-semantic-info'
      ),
    }

    const sizes = {
      sm: 'text-xs px-2 py-0.5 gap-1',
      md: 'text-sm px-2.5 py-1 gap-1.5',
    }

    const dotColors = {
      neutral: 'bg-grey-400',
      success: 'bg-semantic-success',
      warning: 'bg-semantic-warning',
      error: 'bg-semantic-error',
      info: 'bg-semantic-info',
    }

    return (
      <span
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {dot && (
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full',
              dotColors[variant],
              pulse && 'animate-pulse-subtle'
            )}
          />
        )}
        {children}
      </span>
    )
  }
)

Badge.displayName = 'Badge'

export { Badge }
