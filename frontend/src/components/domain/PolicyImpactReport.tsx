/**
 * PolicyImpactReport — impact of policy changes on active cases.
 * Apple HIG: greyscale-first metrics, tracking-tight/wider, muted accents,
 * glass panels, Apple spring animations.
 */

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Shield,
  Users,
  AlertTriangle,
  ArrowRight,
  Loader2,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { Badge } from '@/components/ui/Badge'
import { ENDPOINTS } from '@/lib/constants'
import { fadeInUp, appleEase } from '@/lib/animations'
import { cn } from '@/lib/utils'

interface PolicyImpactReportProps {
  payer: string
  medication: string
  oldVersion: string
  newVersion: string
}

interface PatientImpact {
  patient_id: string
  case_id: string
  patient_name: string
  current_verdict: string
  projected_verdict: string
  verdict_changed: boolean
  affected_criteria: string[]
  risk_level: string
  recommended_action: string
}

interface ImpactReportData {
  total_active_cases: number
  impacted_cases: number
  verdict_flips: number
  at_risk_cases: number
  patient_impacts: PatientImpact[]
  action_items: string[]
}

const riskBadge = (level: string) => {
  switch (level) {
    case 'verdict_flip': return <Badge variant="error" size="sm" dot pulse>Verdict Flip</Badge>
    case 'at_risk': return <Badge variant="warning" size="sm" dot>At Risk</Badge>
    case 'no_impact': return <Badge variant="success" size="sm">No Impact</Badge>
    default: return <Badge variant="neutral" size="sm">{level}</Badge>
  }
}

const impactCache = new Map<string, ImpactReportData>()

export function PolicyImpactReport({
  payer,
  medication,
  oldVersion,
  newVersion,
}: PolicyImpactReportProps) {
  const [expandedCase, setExpandedCase] = useState<string | null>(null)
  const [data, setData] = useState<ImpactReportData | null>(null)
  const [isPending, setIsPending] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const cacheKey = `${payer}|${medication}|${oldVersion}|${newVersion}`
    const cached = impactCache.get(cacheKey)
    if (cached) { setData(cached); setIsPending(false); setError(null); return }

    let cancelled = false
    setIsPending(true); setError(null); setData(null)
    import('@/services/api').then(({ request }) =>
      request<ImpactReportData>(ENDPOINTS.policyImpact(payer, medication), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_version: oldVersion, new_version: newVersion }),
      }, 120000)
    ).then(r => { if (!cancelled) { impactCache.set(cacheKey, r); setData(r); setIsPending(false) } })
     .catch(e => { if (!cancelled) { setError(e instanceof Error ? e : new Error(String(e))); setIsPending(false) } })
    return () => { cancelled = true }
  }, [payer, medication, oldVersion, newVersion])

  if (isPending) {
    return (
      <GlassPanel variant="default" padding="lg">
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-5 h-5 text-grey-400 animate-spin" />
          <span className="text-[13px] text-grey-500">Analyzing impact on active cases...</span>
        </div>
      </GlassPanel>
    )
  }

  if (error) {
    return (
      <GlassPanel variant="default" padding="lg">
        <div className="text-center py-12">
          <div className="w-10 h-10 rounded-xl bg-grey-100 flex items-center justify-center mx-auto mb-3">
            <AlertTriangle className="w-5 h-5 text-grey-400" />
          </div>
          <p className="text-[13px] text-grey-600">Failed to analyze impact</p>
          <p className="text-[11px] text-grey-400 mt-1">{error.message}</p>
        </div>
      </GlassPanel>
    )
  }

  if (!data) return null

  const metrics = [
    { label: 'Active Cases', value: data.total_active_cases, icon: Users },
    { label: 'Impacted', value: data.impacted_cases },
    { label: 'Verdict Flips', value: data.verdict_flips },
    { label: 'At Risk', value: data.at_risk_cases },
  ]

  return (
    <motion.div variants={fadeInUp} initial="initial" animate="animate" className="space-y-4">
      {/* Header */}
      <GlassPanel variant="default" padding="md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-grey-100 flex items-center justify-center">
            <Shield className="w-4.5 h-4.5 text-grey-500" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-grey-900 tracking-tight">Impact Analysis</h2>
            <p className="text-[11px] text-grey-400 mt-0.5 font-medium">
              {payer} / {medication}: {oldVersion} → {newVersion}
            </p>
          </div>
        </div>
      </GlassPanel>

      {/* Metric Cards — greyscale-first like StrategicIntelligence */}
      <div className="grid grid-cols-4 gap-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="p-4 bg-grey-50 rounded-xl text-center">
            {metric.icon && (
              <div className="flex items-center justify-center mb-1.5">
                <metric.icon className="w-4 h-4 text-grey-400" />
              </div>
            )}
            <p className="text-2xl font-semibold text-grey-900 tracking-tight tabular-nums">
              {metric.value}
            </p>
            <p className="text-[10px] font-medium text-grey-400 uppercase tracking-wider mt-1">
              {metric.label}
            </p>
          </div>
        ))}
      </div>

      {/* Per-case Breakdown */}
      {data.patient_impacts.length > 0 && (
        <GlassPanel variant="default" padding="none">
          <div className="px-5 py-3.5 border-b border-grey-100">
            <h3 className="text-[13px] font-semibold text-grey-900 tracking-tight">
              Per-Case Breakdown
            </h3>
          </div>
          <div className="divide-y divide-grey-100">
            {data.patient_impacts.map((pi) => {
              const isExpanded = expandedCase === pi.case_id
              return (
                <div key={pi.case_id}>
                  <div
                    className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:bg-grey-50/50 transition-colors"
                    onClick={() => setExpandedCase(isExpanded ? null : pi.case_id)}
                  >
                    <div className="flex items-center gap-3">
                      <motion.div
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.15 }}
                      >
                        <ChevronRight className="w-3.5 h-3.5 text-grey-400" />
                      </motion.div>
                      <div>
                        <span className="text-[13px] font-medium text-grey-900">{pi.patient_name}</span>
                        <span className="text-[11px] text-grey-400 ml-2 font-mono">{pi.case_id.slice(0, 8)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium">
                        <span className="text-grey-600">{pi.current_verdict}</span>
                        <ArrowRight className="w-3 h-3 text-grey-300" />
                        <span className={cn(
                          'text-grey-900',
                          pi.verdict_changed && 'font-semibold'
                        )}>
                          {pi.projected_verdict}
                        </span>
                      </div>
                      {riskBadge(pi.risk_level)}
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={appleEase}
                        className="overflow-hidden"
                      >
                        <div className="px-5 pb-4 pt-1 ml-7 space-y-3">
                          {pi.affected_criteria.length > 0 && (
                            <div>
                              <p className="text-[10px] font-medium text-grey-400 uppercase tracking-wider mb-1.5">
                                Affected Criteria
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {pi.affected_criteria.map((c, i) => (
                                  <span
                                    key={i}
                                    className="px-2 py-0.5 text-[10px] bg-grey-100 text-grey-600 rounded-md font-medium"
                                  >
                                    {c}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div>
                            <p className="text-[10px] font-medium text-grey-400 uppercase tracking-wider mb-1">
                              Recommended Action
                            </p>
                            <p className="text-[12px] text-grey-600 leading-relaxed">{pi.recommended_action}</p>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </GlassPanel>
      )}

      {/* No impacts */}
      {data.patient_impacts.length === 0 && (
        <GlassPanel variant="default" padding="lg">
          <div className="text-center py-6">
            <div className="w-10 h-10 rounded-xl bg-grey-100 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-5 h-5 text-grey-400" />
            </div>
            <p className="text-[13px] font-medium text-grey-700">No active cases impacted</p>
            <p className="text-[11px] text-grey-400 mt-1">These policy changes do not affect any current cases</p>
          </div>
        </GlassPanel>
      )}

      {/* Action Items */}
      {data.action_items && data.action_items.length > 0 && (
        <GlassPanel variant="default" padding="md">
          <div className="flex items-start gap-2.5">
            <div className="w-1.5 h-full min-h-[20px] rounded-full bg-semantic-warning/30 flex-shrink-0" />
            <div>
              <h3 className="text-[12px] font-semibold text-grey-800 mb-2.5">Action Items</h3>
              <ul className="space-y-2">
                {data.action_items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-grey-600">
                    <span className="w-1 h-1 rounded-full bg-grey-300 mt-[7px] flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </GlassPanel>
      )}
    </motion.div>
  )
}
