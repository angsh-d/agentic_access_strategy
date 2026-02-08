/**
 * PolicyNotificationBanner — glass-panel notification for policy update detection.
 * Apple HIG: greyscale-first, subtle semantic accent, premium typography.
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { appleSpring } from '@/lib/animations'
import type { PolicyUpdateNotification } from '@/types/api'

interface PolicyNotificationBannerProps {
  notification: PolicyUpdateNotification | null
  onViewChanges?: (payer: string, medication: string, version: string) => void
  onDismiss?: () => void
}

export function PolicyNotificationBanner({
  notification,
  onViewChanges,
  onDismiss,
}: PolicyNotificationBannerProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (notification) {
      setVisible(true)
      const timer = setTimeout(() => {
        setVisible(false)
        onDismiss?.()
      }, 30000)
      return () => clearTimeout(timer)
    }
  }, [notification, onDismiss])

  const handleDismiss = useCallback(() => {
    setVisible(false)
    onDismiss?.()
  }, [onDismiss])

  const handleViewChanges = useCallback(() => {
    if (notification) {
      onViewChanges?.(notification.payer, notification.medication, notification.version)
      setVisible(false)
    }
  }, [notification, onViewChanges])

  return (
    <AnimatePresence>
      {visible && notification && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.98 }}
          transition={appleSpring}
          className="surface-card px-5 py-3.5 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-8 h-8 rounded-xl bg-grey-100 flex items-center justify-center flex-shrink-0">
              <Bell className="w-4 h-4 text-grey-500" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-grey-900 tracking-tight">
                Policy update detected
              </p>
              <p className="text-[12px] text-grey-500 mt-0.5">
                <span className="font-medium text-grey-700">{notification.payer}</span>
                {' / '}
                <span className="font-medium text-grey-700">{notification.medication}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 ml-2">
              <Badge variant="info" size="sm">{notification.version}</Badge>
              {notification.criteria_count != null && (
                <span className="text-[11px] text-grey-400">
                  {notification.criteria_count} criteria
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <motion.button
              onClick={handleViewChanges}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-3.5 py-1.5 text-[12px] font-semibold text-white bg-grey-900 hover:bg-grey-800 rounded-lg transition-colors flex items-center gap-1.5"
            >
              View Changes
              <ArrowRight className="w-3 h-3" />
            </motion.button>
            <button
              onClick={handleDismiss}
              className="p-1.5 text-grey-300 hover:text-grey-500 transition-colors rounded-lg hover:bg-grey-100"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
