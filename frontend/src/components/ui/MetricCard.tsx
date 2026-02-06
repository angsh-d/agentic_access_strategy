import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MetricCardProps {
  label: string
  value: string | number
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  icon?: React.ReactNode
  variant?: 'default' | 'compact'
  className?: string
}

const MetricCard = forwardRef<HTMLDivElement, MetricCardProps>(
  (
    {
      className,
      label,
      value,
      trend,
      trendValue,
      icon,
      variant = 'default',
    },
    ref
  ) => {
    const trendIcons = {
      up: <TrendingUp className="w-3.5 h-3.5" />,
      down: <TrendingDown className="w-3.5 h-3.5" />,
      neutral: <Minus className="w-3.5 h-3.5" />,
    }

    const trendColors = {
      up: 'text-semantic-success',
      down: 'text-semantic-error',
      neutral: 'text-grey-400',
    }

    if (variant === 'compact') {
      return (
        <div
          ref={ref}
          className={cn(
            'flex items-center gap-3 p-3 rounded-xl bg-grey-100',
            className
          )}
        >
          {icon && (
            <div className="flex-shrink-0 text-grey-400">
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-grey-500 truncate">{label}</p>
            <p className="text-lg font-semibold text-grey-900">{value}</p>
          </div>
          {trend && (
            <div className={cn('flex items-center gap-1', trendColors[trend])}>
              {trendIcons[trend]}
              {trendValue && <span className="text-xs font-medium">{trendValue}</span>}
            </div>
          )}
        </div>
      )
    }

    return (
      <motion.div
        ref={ref}
        className={cn(
          'p-6 rounded-2xl bg-grey-100 border border-grey-200/50',
          className
        )}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-start justify-between mb-2">
          <span className="text-label">{label}</span>
          {icon && (
            <span className="text-grey-400">
              {icon}
            </span>
          )}
        </div>
        <div className="flex items-end gap-3">
          <span className="text-4xl font-semibold text-grey-900 tracking-tight">
            {value}
          </span>
          {trend && (
            <div className={cn('flex items-center gap-1 mb-1', trendColors[trend])}>
              {trendIcons[trend]}
              {trendValue && (
                <span className="text-sm font-medium">{trendValue}</span>
              )}
            </div>
          )}
        </div>
      </motion.div>
    )
  }
)

MetricCard.displayName = 'MetricCard'

export { MetricCard }
