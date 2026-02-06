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
  aiStatus?: string
  confidence?: number
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
    bg: 'bg-semantic-error/[0.03]',
    border: 'border-semantic-error/10',
    label: 'Urgent',
  },
  medium: {
    icon: Clock,
    color: 'text-semantic-warning',
    bg: 'bg-semantic-warning/[0.03]',
    border: 'border-semantic-warning/10',
    label: 'Pending',
  },
  low: {
    icon: CheckCircle2,
    color: 'text-grey-400',
    bg: 'bg-grey-50/50',
    border: 'border-grey-200/50',
    label: 'On Track',
  },
}

function getPriorityFromStage(stage: CaseStage, payerStatus: PayerStatus): 'high' | 'medium' | 'low' {
  if (stage === 'awaiting_human_decision') return 'high'
  if (stage === 'strategy_selection') return 'high'
  if (payerStatus === 'pending_info') return 'high'

  if (stage === 'policy_analysis') return 'medium'
  if (stage === 'strategy_generation') return 'medium'
  if (payerStatus === 'under_review') return 'medium'

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
          'flex items-center gap-3.5 p-3.5 rounded-xl border-[0.5px] cursor-pointer group',
          'transition-all duration-200 ease-out-expo',
          config.bg,
          config.border,
          'hover:shadow-card hover:bg-white',
          className
        )}
        onClick={() => onProcess(item.caseId)}
        whileTap={{ scale: 0.99 }}
      >
        <div className={cn('flex-shrink-0', config.color)}>
          <PriorityIcon className="w-[18px] h-[18px]" strokeWidth={2} />
        </div>

        <div className="w-9 h-9 rounded-full bg-grey-100 flex items-center justify-center flex-shrink-0">
          <span className="text-[12px] font-semibold text-grey-500">
            {item.patientInitials}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-grey-900 truncate">
              {item.patientName}
            </span>
            <span className="text-grey-300 text-[11px]">&middot;</span>
            <span className="text-[13px] text-grey-500 truncate">
              {item.medication}
            </span>
          </div>
          {item.aiStatus && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Brain className="w-3 h-3 text-grey-300" />
              <span className="text-[11px] text-grey-400 font-medium">{item.aiStatus}</span>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-grey-900 text-white text-[12px] font-semibold rounded-lg shadow-sm">
            Process
            <ArrowRight className="w-3 h-3" />
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className={cn(
        'rounded-xl border-[0.5px] overflow-hidden cursor-pointer group',
        'transition-all duration-200 ease-out-expo',
        config.border,
        'hover:shadow-elevated',
        className
      )}
      onClick={() => onProcess(item.caseId)}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.995 }}
    >
      <div className={cn('px-4 py-2.5', config.bg)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PriorityIcon className={cn('w-3.5 h-3.5', config.color)} />
            <Badge
              variant={priority === 'high' ? 'error' : priority === 'medium' ? 'warning' : 'neutral'}
              size="sm"
            >
              {config.label}
            </Badge>
          </div>
          <span className="text-[11px] text-grey-400 font-medium">{item.payerName}</span>
        </div>
      </div>

      <div className="px-4 py-4 bg-white">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-grey-100 flex items-center justify-center flex-shrink-0">
            <span className="text-[15px] font-semibold text-grey-500">
              {item.patientInitials}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-[15px] font-semibold text-grey-900 truncate">
              {item.patientName}
            </h4>
            <p className="text-[13px] text-grey-500 truncate">{item.medication}</p>
          </div>
        </div>

        {item.aiStatus && (
          <div className="mt-3 p-3 rounded-lg bg-grey-50/80">
            <div className="flex items-center gap-2">
              <Brain className="w-3.5 h-3.5 text-grey-400" />
              <span className="text-[13px] text-grey-600">{item.aiStatus}</span>
            </div>
            {item.confidence !== undefined && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-[3px] bg-grey-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-grey-800 rounded-full transition-all duration-500"
                    style={{ width: `${item.confidence * 100}%` }}
                  />
                </div>
                <span className="text-[11px] text-grey-400 font-medium tabular-nums">
                  {Math.round(item.confidence * 100)}%
                </span>
              </div>
            )}
          </div>
        )}

        <motion.button
          type="button"
          className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2 bg-grey-900 text-white text-[13px] font-semibold rounded-lg shadow-sm"
          whileTap={{ scale: 0.97 }}
          onClick={(e) => {
            e.stopPropagation()
            onProcess(item.caseId)
          }}
        >
          Process Case
          <ArrowRight className="w-3.5 h-3.5" />
        </motion.button>
      </div>
    </motion.div>
  )
}

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
          <h3 className="text-[13px] font-semibold text-grey-700">{title}</h3>
          {showViewAll && onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="text-[12px] font-medium text-grey-400 hover:text-grey-600 transition-colors"
            >
              View all ({items.length})
            </button>
          )}
        </div>
      )}

      {displayItems.length === 0 ? (
        <div className="py-8 text-center">
          <User className="w-7 h-7 text-grey-200 mx-auto mb-2" />
          <p className="text-[13px] text-grey-400">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-1.5">
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
              className="w-full py-2 text-[12px] font-medium text-grey-400 hover:text-grey-600 transition-colors"
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
