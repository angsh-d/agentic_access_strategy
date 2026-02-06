/**
 * CaseQueueCard - Dashboard queue item for PA Specialist Workspace
 *
 * Designed for the PA Specialist persona:
 * - Shows what needs immediate attention
 * - Clear "Process" action button
 * - AI insights visible at a glance
 * - Status-based visual priority
 */

import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  ArrowRight,
  Brain,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui'
import type { CaseStage, PayerStatus } from '@/types/case'

export interface CaseQueueItem {
  caseId: string
  patientName: string
  patientInitials: string
  medication: string
  payerName: string
  stage: CaseStage
  payerStatus: PayerStatus
  aiStatus?: string // e.g., "Ready for decision", "Analyzing policy"
  confidence?: number // 0-1
  updatedAt: string
  daysInQueue?: number
  priority?: 'high' | 'medium' | 'low'
}

interface CaseQueueCardProps {
  item: CaseQueueItem
  onProcess: (caseId: string) => void
  variant?: 'compact' | 'expanded'
  className?: string
}

const priorityConfig = {
  high: {
    icon: AlertTriangle,
    color: 'text-semantic-error',
    bg: 'bg-semantic-error/5',
    border: 'border-semantic-error/20',
    label: 'Urgent',
  },
  medium: {
    icon: Clock,
    color: 'text-semantic-warning',
    bg: 'bg-semantic-warning/5',
    border: 'border-semantic-warning/20',
    label: 'Pending',
  },
  low: {
    icon: CheckCircle2,
    color: 'text-grey-500',
    bg: 'bg-grey-50',
    border: 'border-grey-200',
    label: 'On Track',
  },
}

function getPriorityFromStage(stage: CaseStage, payerStatus: PayerStatus): 'high' | 'medium' | 'low' {
  // High priority: needs immediate action
  if (stage === 'awaiting_human_decision') return 'high'
  if (stage === 'strategy_selection') return 'high'
  if (payerStatus === 'pending_info') return 'high'

  // Medium priority: in progress
  if (stage === 'policy_analysis') return 'medium'
  if (stage === 'strategy_generation') return 'medium'
  if (payerStatus === 'under_review') return 'medium'

  // Low priority: automated or complete
  return 'low'
}

export function CaseQueueCard({
  item,
  onProcess,
  variant = 'compact',
  className,
}: CaseQueueCardProps) {
  const priority = item.priority ?? getPriorityFromStage(item.stage, item.payerStatus)
  const config = priorityConfig[priority]
  const PriorityIcon = config.icon

  if (variant === 'compact') {
    return (
      <motion.div
        className={cn(
          'flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all group',
          config.bg,
          config.border,
          'hover:shadow-md hover:scale-[1.01]',
          className
        )}
        onClick={() => onProcess(item.caseId)}
        whileHover={{ x: 4 }}
        whileTap={{ scale: 0.99 }}
      >
        {/* Priority indicator */}
        <div className={cn('flex-shrink-0', config.color)}>
          <PriorityIcon className="w-5 h-5" />
        </div>

        {/* Patient avatar */}
        <div className="w-10 h-10 rounded-full bg-grey-200 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-semibold text-grey-600">
            {item.patientInitials}
          </span>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-grey-900 truncate">
              {item.patientName}
            </span>
            <span className="text-grey-300">-</span>
            <span className="text-sm text-grey-600 truncate">
              {item.medication}
            </span>
          </div>
          {item.aiStatus && (
            <div className="flex items-center gap-1.5 mt-1">
              <Brain className="w-3 h-3 text-grey-400" />
              <span className="text-xs text-grey-500">{item.aiStatus}</span>
            </div>
          )}
        </div>

        {/* Action */}
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2 bg-grey-900 text-white text-sm font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation()
            onProcess(item.caseId)
          }}
        >
          Process
          <ArrowRight className="w-4 h-4" />
        </button>
      </motion.div>
    )
  }

  // Expanded variant with more details
  return (
    <motion.div
      className={cn(
        'rounded-xl border overflow-hidden cursor-pointer transition-all group',
        config.border,
        'hover:shadow-lg',
        className
      )}
      onClick={() => onProcess(item.caseId)}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.99 }}
    >
      {/* Header */}
      <div className={cn('px-4 py-3', config.bg)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PriorityIcon className={cn('w-4 h-4', config.color)} />
            <Badge
              variant={priority === 'high' ? 'error' : priority === 'medium' ? 'warning' : 'neutral'}
              size="sm"
            >
              {config.label}
            </Badge>
          </div>
          <span className="text-xs text-grey-500">{item.payerName}</span>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 bg-white">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-grey-100 flex items-center justify-center flex-shrink-0">
            <span className="text-lg font-semibold text-grey-600">
              {item.patientInitials}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-base font-semibold text-grey-900 truncate">
              {item.patientName}
            </h4>
            <p className="text-sm text-grey-600 truncate">{item.medication}</p>
          </div>
        </div>

        {/* AI Status */}
        {item.aiStatus && (
          <div className="mt-4 p-3 rounded-lg bg-grey-50">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-grey-500" />
              <span className="text-sm text-grey-700">{item.aiStatus}</span>
            </div>
            {item.confidence !== undefined && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-grey-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-grey-900 rounded-full"
                    style={{ width: `${item.confidence * 100}%` }}
                  />
                </div>
                <span className="text-xs text-grey-500">
                  {Math.round(item.confidence * 100)}%
                </span>
              </div>
            )}
          </div>
        )}

        {/* Action */}
        <button
          type="button"
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-grey-900 text-white text-sm font-medium rounded-lg hover:bg-grey-800 transition-colors"
          onClick={(e) => {
            e.stopPropagation()
            onProcess(item.caseId)
          }}
        >
          Process Case
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  )
}

/**
 * CaseQueueList - Groups cases by priority/status
 */
interface CaseQueueListProps {
  items: CaseQueueItem[]
  onProcess: (caseId: string) => void
  title?: string
  emptyMessage?: string
  maxItems?: number
  showViewAll?: boolean
  onViewAll?: () => void
}

export function CaseQueueList({
  items,
  onProcess,
  title,
  emptyMessage = 'No cases in queue',
  maxItems,
  showViewAll,
  onViewAll,
}: CaseQueueListProps) {
  const displayItems = maxItems ? items.slice(0, maxItems) : items
  const hasMore = maxItems && items.length > maxItems

  return (
    <div>
      {title && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-grey-700">{title}</h3>
          {showViewAll && onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="text-xs font-medium text-grey-500 hover:text-grey-700 transition-colors"
            >
              View all ({items.length})
            </button>
          )}
        </div>
      )}

      {displayItems.length === 0 ? (
        <div className="py-8 text-center text-sm text-grey-500">
          <User className="w-8 h-8 text-grey-300 mx-auto mb-2" />
          {emptyMessage}
        </div>
      ) : (
        <div className="space-y-2">
          {displayItems.map((item) => (
            <CaseQueueCard
              key={item.caseId}
              item={item}
              onProcess={onProcess}
              variant="compact"
            />
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={onViewAll}
              className="w-full py-2 text-sm text-grey-500 hover:text-grey-700 transition-colors"
            >
              + {items.length - displayItems.length} more cases
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default CaseQueueCard
