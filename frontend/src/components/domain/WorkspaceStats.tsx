/**
 * WorkspaceStats - Compact performance stats for PA Specialist Workspace
 *
 * Shows "My Performance" metrics in the sidebar:
 * - Approved Today
 * - Avg Processing Time
 * - Success Rate
 *
 * Designed to be secondary to the main work queue.
 */

import { motion } from 'framer-motion'
import {
  CheckCircle2,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Lightbulb,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface StatItem {
  label: string
  value: string | number
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  icon?: 'approved' | 'time' | 'rate' | 'ai'
}

interface WorkspaceStatsProps {
  stats: StatItem[]
  className?: string
  title?: string
}

const iconMap = {
  approved: CheckCircle2,
  time: Clock,
  rate: TrendingUp,
  ai: Brain,
}

const trendConfig = {
  up: { icon: TrendingUp, color: 'text-semantic-success' },
  down: { icon: TrendingDown, color: 'text-semantic-error' },
  neutral: { icon: Minus, color: 'text-grey-400' },
}

export function WorkspaceStats({
  stats,
  className,
  title = 'My Performance',
}: WorkspaceStatsProps) {
  return (
    <div className={cn('rounded-xl border border-grey-200 bg-white overflow-hidden', className)}>
      <div className="px-4 py-3 border-b border-grey-100">
        <h3 className="text-sm font-semibold text-grey-900">{title}</h3>
      </div>

      <div className="p-4 space-y-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon ? iconMap[stat.icon] : null
          const trend = stat.trend ? trendConfig[stat.trend] : null
          const TrendIcon = trend?.icon

          return (
            <motion.div
              key={index}
              className="flex items-center justify-between"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="flex items-center gap-3">
                {Icon && (
                  <div className="w-8 h-8 rounded-lg bg-grey-100 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-grey-500" />
                  </div>
                )}
                <span className="text-sm text-grey-600">{stat.label}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-grey-900">{stat.value}</span>
                {trend && TrendIcon && (
                  <div className={cn('flex items-center gap-1', trend.color)}>
                    <TrendIcon className="w-3 h-3" />
                    {stat.trendValue && (
                      <span className="text-xs">{stat.trendValue}</span>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * AIInsightCard - Shows AI-generated insights in the sidebar
 */
interface AIInsightCardProps {
  insight: string
  source?: string
  className?: string
}

export function AIInsightCard({ insight, source, className }: AIInsightCardProps) {
  return (
    <div className={cn('rounded-xl border border-grey-200 bg-gradient-to-br from-grey-50 to-white overflow-hidden', className)}>
      <div className="px-4 py-3 border-b border-grey-100 flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-grey-500" />
        <h3 className="text-sm font-semibold text-grey-900">AI Insight</h3>
      </div>
      <div className="p-4">
        <p className="text-sm text-grey-700 leading-relaxed">"{insight}"</p>
        {source && (
          <p className="text-xs text-grey-400 mt-2">Based on {source}</p>
        )}
      </div>
    </div>
  )
}

/**
 * RecentActivityItem - Single activity in recent activity list
 */
interface ActivityItem {
  id: string
  action: string
  caseId?: string
  patientName?: string
  timestamp: string
  status?: 'success' | 'pending' | 'info'
}

interface RecentActivityProps {
  activities: ActivityItem[]
  onActivityClick?: (activity: ActivityItem) => void
  className?: string
  maxItems?: number
}

export function RecentActivity({
  activities,
  onActivityClick,
  className,
  maxItems = 5,
}: RecentActivityProps) {
  const displayActivities = activities.slice(0, maxItems)

  const statusColors = {
    success: 'bg-semantic-success',
    pending: 'bg-semantic-warning',
    info: 'bg-grey-400',
  }

  return (
    <div className={cn('rounded-xl border border-grey-200 bg-white overflow-hidden', className)}>
      <div className="px-4 py-3 border-b border-grey-100 flex items-center gap-2">
        <Clock className="w-4 h-4 text-grey-500" />
        <h3 className="text-sm font-semibold text-grey-900">Recent Activity</h3>
      </div>

      <div className="divide-y divide-grey-100">
        {displayActivities.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-grey-500">
            No recent activity
          </div>
        ) : (
          displayActivities.map((activity) => (
            <button
              key={activity.id}
              type="button"
              onClick={() => onActivityClick?.(activity)}
              className="w-full px-4 py-3 flex items-start gap-3 hover:bg-grey-50 transition-colors text-left"
              disabled={!onActivityClick}
            >
              <div
                className={cn(
                  'w-2 h-2 rounded-full mt-1.5 flex-shrink-0',
                  statusColors[activity.status || 'info']
                )}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-grey-700 truncate">{activity.action}</p>
                <p className="text-xs text-grey-400 mt-0.5">
                  {new Date(activity.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export default WorkspaceStats
