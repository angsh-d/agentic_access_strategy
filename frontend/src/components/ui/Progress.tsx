import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  variant?: 'default' | 'success' | 'warning' | 'error'
  size?: 'sm' | 'md' | 'lg'
  showValue?: boolean
  animated?: boolean
}

const Progress = forwardRef<HTMLDivElement, ProgressProps>(
  (
    {
      className,
      value,
      max = 100,
      variant = 'default',
      size = 'md',
      showValue = false,
      animated = true,
      ...props
    },
    ref
  ) => {
    const percentage = Math.min(Math.max((value / max) * 100, 0), 100)

    const sizes = {
      sm: 'h-1',
      md: 'h-1.5',
      lg: 'h-2',
    }

    const barColors = {
      default: 'bg-grey-900',
      success: 'bg-semantic-success',
      warning: 'bg-semantic-warning',
      error: 'bg-semantic-error',
    }

    return (
      <div
        ref={ref}
        className={cn('w-full', className)}
        {...props}
      >
        {showValue && (
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-grey-500">Progress</span>
            <span className="text-sm font-medium text-grey-700">
              {percentage.toFixed(0)}%
            </span>
          </div>
        )}
        <div
          className={cn(
            'w-full bg-grey-200 rounded-full overflow-hidden',
            sizes[size]
          )}
        >
          <motion.div
            className={cn('h-full rounded-full', barColors[variant])}
            initial={animated ? { width: 0 } : false}
            animate={{ width: `${percentage}%` }}
            transition={{
              duration: 0.5,
              ease: [0.16, 1, 0.3, 1],
            }}
          />
        </div>
      </div>
    )
  }
)

Progress.displayName = 'Progress'

// Circular progress variant
export interface CircularProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  size?: number
  strokeWidth?: number
  variant?: 'default' | 'success' | 'warning' | 'error'
  showValue?: boolean
}

const CircularProgress = forwardRef<HTMLDivElement, CircularProgressProps>(
  (
    {
      className,
      value,
      size = 48,
      strokeWidth = 4,
      variant = 'default',
      showValue = false,
      ...props
    },
    ref
  ) => {
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const percentage = Math.min(Math.max(value, 0), 100)
    const offset = circumference - (percentage / 100) * circumference

    const strokeColors = {
      default: 'stroke-grey-900',
      success: 'stroke-semantic-success',
      warning: 'stroke-semantic-warning',
      error: 'stroke-semantic-error',
    }

    return (
      <div
        ref={ref}
        className={cn('relative inline-flex items-center justify-center', className)}
        style={{ width: size, height: size }}
        {...props}
      >
        <svg
          className="transform -rotate-90"
          width={size}
          height={size}
        >
          {/* Background circle */}
          <circle
            className="stroke-grey-200"
            fill="none"
            strokeWidth={strokeWidth}
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          {/* Progress circle */}
          <motion.circle
            className={cn('transition-all', strokeColors[variant])}
            fill="none"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            r={radius}
            cx={size / 2}
            cy={size / 2}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            style={{ strokeDasharray: circumference }}
            transition={{
              duration: 0.5,
              ease: [0.16, 1, 0.3, 1],
            }}
          />
        </svg>
        {showValue && (
          <span className="absolute text-sm font-semibold text-grey-700">
            {percentage.toFixed(0)}
          </span>
        )}
      </div>
    )
  }
)

CircularProgress.displayName = 'CircularProgress'

export { Progress, CircularProgress }
