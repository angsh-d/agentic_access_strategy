/**
 * PayerStatusBadge - Greyscale-first status indicator
 *
 * Uses typography and fill weight instead of semantic colors
 * to indicate status while maintaining accessibility.
 */

import { cn } from '@/lib/utils'
import type { PayerStatus } from '@/types/case'

interface PayerStatusBadgeProps {
  status: PayerStatus
  showDot?: boolean
  pulse?: boolean
}

const statusConfig: Record<PayerStatus, {
  label: string
  weight: 'light' | 'medium' | 'heavy'
}> = {
  not_submitted: { label: 'Not Submitted', weight: 'light' },
  submitted: { label: 'Submitted', weight: 'medium' },
  pending_info: { label: 'Info Requested', weight: 'medium' },
  under_review: { label: 'Under Review', weight: 'medium' },
  approved: { label: 'Approved', weight: 'heavy' },
  denied: { label: 'Denied', weight: 'medium' },
  appeal_submitted: { label: 'Appeal Submitted', weight: 'medium' },
  appeal_approved: { label: 'Appeal Approved', weight: 'heavy' },
  appeal_denied: { label: 'Appeal Denied', weight: 'medium' },
}

export function PayerStatusBadge({
  status,
  showDot = true,
  pulse = false
}: PayerStatusBadgeProps) {
  const config = statusConfig[status]
  const shouldPulse = pulse || (status === 'submitted' || status === 'under_review' || status === 'appeal_submitted')
  const isApproved = status === 'approved' || status === 'appeal_approved'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs',
        // Background based on weight
        config.weight === 'heavy' && 'bg-grey-900 text-white',
        config.weight === 'medium' && 'bg-grey-200 text-grey-700',
        config.weight === 'light' && 'bg-grey-100 text-grey-500',
        // Pulse animation for in-progress states
        shouldPulse && 'animate-pulse'
      )}
    >
      {showDot && (
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            isApproved && 'bg-white',
            !isApproved && config.weight === 'medium' && 'bg-grey-500',
            !isApproved && config.weight === 'light' && 'bg-grey-400'
          )}
        />
      )}
      <span className={cn(
        config.weight === 'heavy' && 'font-medium',
        config.weight === 'medium' && 'font-medium',
        config.weight === 'light' && 'font-normal'
      )}>
        {config.label}
      </span>
    </span>
  )
}

export default PayerStatusBadge
