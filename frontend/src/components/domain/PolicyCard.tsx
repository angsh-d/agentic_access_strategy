/**
 * PolicyCard - Glassmorphism card for medication policies
 *
 * Displays a summary of a medication policy with:
 * - Medication name
 * - Indication count
 * - Step therapy badge
 * - Hover animation with quick stats
 */

import { motion } from 'framer-motion'
import { Pill, ListChecks, AlertCircle, ChevronRight } from 'lucide-react'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

export interface PolicyCardProps {
  policyId: string
  payer: string
  medication: string
  genericName?: string
  indicationCount?: number
  stepTherapyRequired?: boolean
  effectiveDate?: string
  onClick?: () => void
  isSelected?: boolean
  className?: string
}

export function PolicyCard({
  policyId,
  payer,
  medication,
  genericName,
  indicationCount,
  stepTherapyRequired,
  effectiveDate,
  onClick,
  isSelected = false,
  className,
}: PolicyCardProps) {
  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      <GlassPanel
        variant={isSelected ? 'ai-active' : 'interactive'}
        padding="md"
        className={cn(
          'cursor-pointer group',
          isSelected && 'ring-2 ring-blue-400',
          className
        )}
        onClick={onClick}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
              <Pill className="w-5 h-5 text-purple-600" />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-grey-900 truncate">
                {medication}
              </h3>
              {genericName && (
                <p className="text-sm text-grey-500 truncate">{genericName}</p>
              )}
              <p className="text-xs text-grey-400 mt-1">
                Policy: {policyId} | {payer}
              </p>
            </div>
          </div>

          {/* Arrow */}
          <ChevronRight
            className="w-5 h-5 text-grey-300 group-hover:text-grey-500 group-hover:translate-x-0.5 transition-all flex-shrink-0"
          />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-grey-200/50">
          {/* Indications */}
          {indicationCount != null && (
          <div className="flex items-center gap-1.5">
            <ListChecks className="w-4 h-4 text-grey-400" />
            <span className="text-sm text-grey-600">
              {indicationCount} indication{indicationCount !== 1 ? 's' : ''}
            </span>
          </div>
          )}

          {/* Step Therapy Badge */}
          {stepTherapyRequired && (
            <Badge variant="warning" size="sm" className="flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Step Therapy
            </Badge>
          )}
        </div>

        {/* Effective Date */}
        {effectiveDate && (
          <p className="text-xs text-grey-400 mt-2">
            Effective: {effectiveDate}
          </p>
        )}
      </GlassPanel>
    </motion.div>
  )
}

/**
 * PolicyCardSkeleton - Loading state for PolicyCard
 */
export function PolicyCardSkeleton() {
  return (
    <GlassPanel variant="default" padding="md">
      <div className="flex items-start gap-3 animate-pulse">
        <div className="w-10 h-10 rounded-xl bg-grey-200" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-grey-200 rounded w-3/4" />
          <div className="h-4 bg-grey-200 rounded w-1/2" />
          <div className="h-3 bg-grey-200 rounded w-2/3" />
        </div>
      </div>
      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-grey-200/50 animate-pulse">
        <div className="h-4 bg-grey-200 rounded w-24" />
        <div className="h-5 bg-grey-200 rounded w-20" />
      </div>
    </GlassPanel>
  )
}

/**
 * PolicyCardCompact - Smaller version for lists
 */
export function PolicyCardCompact({
  medication,
  payer,
  indicationCount,
  stepTherapyRequired,
  onClick,
  isSelected = false,
}: {
  medication: string
  payer: string
  indicationCount?: number
  stepTherapyRequired?: boolean
  onClick?: () => void
  isSelected?: boolean
}) {
  return (
    <motion.button
      className={cn(
        'w-full text-left px-4 py-3 rounded-xl border transition-all',
        'flex items-center justify-between gap-3',
        isSelected
          ? 'bg-purple-50 border-purple-200 text-purple-900'
          : 'bg-white border-grey-200 hover:border-grey-300 hover:bg-grey-50'
      )}
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Pill className={cn('w-4 h-4 flex-shrink-0', isSelected ? 'text-purple-600' : 'text-grey-400')} />
        <div className="min-w-0">
          <span className="text-sm font-medium truncate block">{medication}</span>
          <span className="text-xs text-grey-500">{payer}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {stepTherapyRequired && (
          <AlertCircle className="w-4 h-4 text-amber-500" />
        )}
        {indicationCount != null && (
        <Badge variant="neutral" size="sm">
          {indicationCount}
        </Badge>
        )}
      </div>
    </motion.button>
  )
}

export default PolicyCard
