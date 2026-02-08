/**
 * PolicyDiffViewer — visual policy version comparison.
 *
 * Design: Impact-first layout with severity meter, grouped changes
 * (New / Modified / Removed), and Before→After split cards.
 * Apple HIG: greyscale palette, muted semantic accents, glass panels.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GitCompareArrows,
  Plus,
  Minus,
  Edit3,
  AlertTriangle,
  Shield,
  Loader2,
  ChevronDown,
  Sparkles,
  ArrowRight,
  Zap,
} from 'lucide-react'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { ENDPOINTS, QUERY_KEYS } from '@/lib/constants'
import { fadeInUp, appleEase } from '@/lib/animations'
import { cn } from '@/lib/utils'

/* ─── Types ─── */

interface PolicyDiffViewerProps {
  payer: string
  medication: string
  oldVersion: string
  newVersion: string
  onAssessImpact?: () => void
}

interface DiffSummaryResponse {
  diff: {
    summary: {
      total_criteria_old: number
      total_criteria_new: number
      added: number
      removed: number
      modified: number
      unchanged: number
      breaking_changes: number
      material_changes: number
      severity_assessment: string
    }
    changes: {
      criteria: Array<RawChange>
      indications?: Array<Record<string, unknown>>
      step_therapy?: Array<RawChange>
      exclusions?: Array<RawChange>
    }
  }
  summary: {
    executive_summary: string
    breaking_changes_summary?: string[]
    material_changes_summary?: string[]
    minor_changes_summary?: string[]
    recommended_actions?: string[]
  }
}

interface RawChange {
  criterion_id?: string
  criterion_name?: string
  indication_id?: string
  indication_name?: string
  change_type: string
  severity: string
  old_value?: Record<string, unknown>
  new_value?: Record<string, unknown>
  field_changes?: Array<{ field: string; old: unknown; new: unknown }>
  human_summary?: string
}

interface UnifiedChange {
  id: string
  name: string
  category: string
  changeType: 'added' | 'removed' | 'modified'
  severity: 'breaking' | 'material'
  summary: string
  fieldChanges: Array<{ field: string; old: unknown; new: unknown }>
  newValue?: Record<string, unknown>
  oldValue?: Record<string, unknown>
}

/* ─── Helpers ─── */

function normalizeChanges(diff: DiffSummaryResponse['diff']): UnifiedChange[] {
  const result: UnifiedChange[] = []
  const mapChange = (raw: RawChange, category: string): UnifiedChange | null => {
    const ct = raw.change_type as UnifiedChange['changeType']
    if (ct !== 'added' && ct !== 'removed' && ct !== 'modified') return null
    const sev = raw.severity as UnifiedChange['severity']
    if (sev !== 'breaking' && sev !== 'material') return null
    return {
      id: raw.criterion_id || raw.indication_id || Math.random().toString(36),
      name: raw.criterion_name || raw.indication_name || raw.criterion_id || 'Unknown',
      category,
      changeType: ct,
      severity: sev,
      summary: raw.human_summary || '',
      fieldChanges: raw.field_changes || [],
      newValue: raw.new_value,
      oldValue: raw.old_value,
    }
  }
  for (const c of diff.changes.criteria ?? []) { const item = mapChange(c, 'Criterion'); if (item) result.push(item) }
  for (const c of (diff.changes.indications ?? []) as unknown as RawChange[]) { const item = mapChange(c, 'Indication'); if (item) result.push(item) }
  for (const c of diff.changes.step_therapy ?? []) { const item = mapChange(c, 'Step Therapy'); if (item) result.push(item) }
  for (const c of diff.changes.exclusions ?? []) { const item = mapChange(c, 'Exclusion'); if (item) result.push(item) }
  // Within each group, critical first
  result.sort((a, b) => (a.severity === 'breaking' ? 0 : 1) - (b.severity === 'breaking' ? 0 : 1))
  return result
}

const impactLevels: Record<string, { label: string; score: number; accent: string; bg: string; text: string }> = {
  high_impact:     { label: 'High Impact',     score: 8, accent: 'bg-red-400',    bg: 'bg-red-50',    text: 'text-red-700' },
  moderate_impact: { label: 'Moderate Impact',  score: 5, accent: 'bg-amber-400',  bg: 'bg-amber-50',  text: 'text-amber-700' },
  low_impact:      { label: 'Low Impact',       score: 2, accent: 'bg-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-700' },
}

function fmtVal(val: unknown): string {
  if (val === null || val === undefined || val === 'None') return '\u2014'
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  if (typeof val === 'string') return val
  return JSON.stringify(val)
}

function friendlyField(f: string): string {
  return f.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

/* ─── Module-level cache (survives navigation, cleared on page reload) ─── */
const diffCache = new Map<string, DiffSummaryResponse>()

/* ─── Component ─── */

export function PolicyDiffViewer({ payer, medication, oldVersion, newVersion, onAssessImpact }: PolicyDiffViewerProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedOld, setSelectedOld] = useState(oldVersion)
  const [selectedNew, setSelectedNew] = useState(newVersion)

  const { data: versionsData } = useQuery({
    queryKey: QUERY_KEYS.policyVersions(payer, medication),
    queryFn: async () => {
      const { request } = await import('@/services/api')
      return request<{ versions: Array<{ version: string }> }>(ENDPOINTS.policyVersions(payer, medication))
    },
    staleTime: 30_000,
  })
  const versions = versionsData?.versions ?? []

  const [data, setData] = useState<DiffSummaryResponse | null>(null)
  const [isPending, setIsPending] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const cacheKey = `${payer}|${medication}|${selectedOld}|${selectedNew}`
    const cached = diffCache.get(cacheKey)
    if (cached) { setData(cached); setIsPending(false); setError(null); return }

    let cancelled = false
    setIsPending(true); setError(null); setData(null)
    import('@/services/api').then(({ request }) =>
      request<DiffSummaryResponse>(ENDPOINTS.policyDiffSummary(payer, medication), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_version: selectedOld, new_version: selectedNew }),
      }, 120000)
    ).then(r => { if (!cancelled) { diffCache.set(cacheKey, r); setData(r); setIsPending(false) } })
     .catch(e => { if (!cancelled) { setError(e instanceof Error ? e : new Error(String(e))); setIsPending(false) } })
    return () => { cancelled = true }
  }, [payer, medication, selectedOld, selectedNew])

  const handleVersionChange = useCallback((which: 'old' | 'new', v: string) => {
    if (which === 'old') setSelectedOld(v); else setSelectedNew(v)
  }, [])

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const changes = useMemo(() => data ? normalizeChanges(data.diff) : [], [data])
  const added = useMemo(() => changes.filter(c => c.changeType === 'added'), [changes])
  const modified = useMemo(() => changes.filter(c => c.changeType === 'modified'), [changes])
  const removed = useMemo(() => changes.filter(c => c.changeType === 'removed'), [changes])

  /* ─── Loading / Error ─── */

  if (isPending) {
    return (
      <GlassPanel variant="default" padding="lg">
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Loader2 className="w-5 h-5 text-grey-400 animate-spin" />
          <span className="text-[13px] text-grey-500">Analyzing policy changes...</span>
        </div>
      </GlassPanel>
    )
  }
  if (error) {
    return (
      <GlassPanel variant="default" padding="lg">
        <div className="text-center py-12">
          <AlertTriangle className="w-5 h-5 text-grey-400 mx-auto mb-3" />
          <p className="text-[13px] text-grey-600">Failed to generate diff</p>
          <p className="text-[11px] text-grey-400 mt-1">{error.message}</p>
        </div>
      </GlassPanel>
    )
  }
  if (!data) return null

  const { diff, summary } = data
  const impact = impactLevels[diff.summary.severity_assessment] || impactLevels.moderate_impact

  return (
    <motion.div variants={fadeInUp} initial="initial" animate="animate" className="space-y-4">
      {/* ── Header ── */}
      <GlassPanel variant="default" padding="md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-grey-100 flex items-center justify-center">
              <GitCompareArrows className="w-4.5 h-4.5 text-grey-500" />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold text-grey-900 tracking-tight">Version Comparison</h2>
              <div className="flex items-center gap-2 mt-1">
                <VSelect value={selectedOld} versions={versions} onChange={v => handleVersionChange('old', v)} />
                <ArrowRight className="w-3 h-3 text-grey-300" />
                <VSelect value={selectedNew} versions={versions} onChange={v => handleVersionChange('new', v)} />
                <span className="text-[10px] text-grey-300 ml-1">{payer} / {medication}</span>
              </div>
            </div>
          </div>
          {onAssessImpact && (
            <motion.button onClick={onAssessImpact} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={appleEase}
              className="px-4 py-2 text-[12px] font-semibold text-white bg-grey-900 hover:bg-grey-800 rounded-xl transition-colors flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" /> Assess Impact
            </motion.button>
          )}
        </div>
      </GlassPanel>

      {/* ── Impact Meter ── */}
      <GlassPanel variant="default" padding="md">
        <div className="flex items-center gap-4">
          <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', impact.bg)}>
            <Zap className={cn('w-5 h-5', impact.text)} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2.5 mb-2">
              <span className={cn('text-[13px] font-semibold tracking-tight', impact.text)}>{impact.label}</span>
              <span className="text-[11px] text-grey-400">{changes.length} actionable changes</span>
            </div>
            {/* Segmented meter */}
            <div className="flex gap-0.5">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors',
                  i < impact.score ? impact.accent : 'bg-grey-100'
                )} />
              ))}
            </div>
          </div>
          {/* Quick stats */}
          <div className="flex gap-4 text-center">
            {added.length > 0 && (
              <div>
                <p className="text-lg font-semibold text-grey-900 tabular-nums">{added.length}</p>
                <p className="text-[9px] font-medium text-grey-400 uppercase tracking-wider">New</p>
              </div>
            )}
            {modified.length > 0 && (
              <div>
                <p className="text-lg font-semibold text-grey-900 tabular-nums">{modified.length}</p>
                <p className="text-[9px] font-medium text-grey-400 uppercase tracking-wider">Changed</p>
              </div>
            )}
            {removed.length > 0 && (
              <div>
                <p className="text-lg font-semibold text-grey-900 tabular-nums">{removed.length}</p>
                <p className="text-[9px] font-medium text-grey-400 uppercase tracking-wider">Removed</p>
              </div>
            )}
          </div>
        </div>
      </GlassPanel>

      {/* ── AI Brief ── */}
      {summary?.executive_summary && (
        <GlassPanel variant="ai-active" padding="md">
          <div className="flex items-start gap-3">
            <div className="w-7 h-7 rounded-lg bg-accent/[0.08] flex items-center justify-center flex-shrink-0 mt-0.5">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
            </div>
            <div className="flex-1">
              <h3 className="text-[13px] font-semibold text-grey-900 tracking-tight">AI Summary</h3>
              <p className="text-[13px] text-grey-600 mt-1.5 leading-relaxed">{summary.executive_summary}</p>
              {summary.recommended_actions && summary.recommended_actions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-grey-100">
                  <p className="text-[10px] font-medium text-grey-400 uppercase tracking-wider mb-2">Action Items</p>
                  <ul className="space-y-1.5">
                    {summary.recommended_actions.map((a, i) => (
                      <li key={i} className="text-[12px] text-grey-600 flex items-start gap-2">
                        <span className="w-1 h-1 rounded-full bg-grey-300 mt-[7px] flex-shrink-0" />
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </GlassPanel>
      )}

      {/* ── New Requirements ── */}
      {added.length > 0 && (
        <ChangeGroup
          title="New Requirements"
          subtitle={`${added.length} criteria added to the policy`}
          icon={<Plus className="w-3.5 h-3.5" />}
          accentClass="bg-emerald-500"
          changes={added}
          expanded={expanded}
          onToggle={toggle}
        />
      )}

      {/* ── Modified Requirements ── */}
      {modified.length > 0 && (
        <ChangeGroup
          title="Modified Requirements"
          subtitle={`${modified.length} criteria updated`}
          icon={<Edit3 className="w-3.5 h-3.5" />}
          accentClass="bg-amber-400"
          changes={modified}
          expanded={expanded}
          onToggle={toggle}
        />
      )}

      {/* ── Removed Requirements ── */}
      {removed.length > 0 && (
        <ChangeGroup
          title="Removed Requirements"
          subtitle={`${removed.length} criteria no longer required`}
          icon={<Minus className="w-3.5 h-3.5" />}
          accentClass="bg-grey-400"
          changes={removed}
          expanded={expanded}
          onToggle={toggle}
        />
      )}
    </motion.div>
  )
}

/* ─── Sub-components ─── */

function VSelect({ value, versions, onChange }: { value: string; versions: Array<{ version: string }>; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="text-[11px] font-medium text-grey-600 bg-grey-50 border border-grey-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-grey-400">
      {versions.length > 0
        ? versions.map(v => <option key={v.version} value={v.version}>{v.version}</option>)
        : <option value={value}>{value}</option>}
    </select>
  )
}

function ChangeGroup({
  title, subtitle, icon, accentClass, changes, expanded, onToggle,
}: {
  title: string
  subtitle: string
  icon: React.ReactNode
  accentClass: string
  changes: UnifiedChange[]
  expanded: Set<string>
  onToggle: (id: string) => void
}) {
  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-2.5 mb-1.5 px-1">
        <div className={cn('w-5 h-5 rounded-md flex items-center justify-center text-white', accentClass)}>
          {icon}
        </div>
        <span className="text-[13px] font-semibold text-grey-900 tracking-tight">{title}</span>
        <span className="text-[11px] text-grey-400">{subtitle}</span>
      </div>

      <GlassPanel variant="default" padding="none">
        <div className="divide-y divide-grey-100">
          {changes.map(change => (
            <ChangeRow
              key={change.id}
              change={change}
              isExpanded={expanded.has(change.id)}
              onToggle={() => onToggle(change.id)}
            />
          ))}
        </div>
      </GlassPanel>
    </div>
  )
}

function ChangeRow({ change, isExpanded, onToggle }: { change: UnifiedChange; isExpanded: boolean; onToggle: () => void }) {
  const isCritical = change.severity === 'breaking'
  const props = getInlineProps(change)
  const hasExpandable = (change.changeType === 'modified' && change.fieldChanges.length > 0)
    || (change.changeType === 'added' && props.length > 2)
    || (change.changeType === 'removed' && props.length > 2)

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-3 px-3 py-2',
          hasExpandable && 'cursor-pointer hover:bg-grey-50/50',
          'transition-colors border-l-2',
          isCritical ? 'border-l-red-400' : 'border-l-amber-300',
        )}
        onClick={hasExpandable ? onToggle : undefined}
      >
        {/* Name + inline props */}
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-[12px] font-medium text-grey-900 truncate">{change.name}</span>
          {props.slice(0, 2).map(([label, val]) => (
            <span key={label} className="text-[10px] text-grey-400 flex-shrink-0">
              <span className="text-grey-300">{label}:</span> {val}
            </span>
          ))}
        </div>

        {/* Badges */}
        {isCritical && (
          <span className="text-[8px] font-semibold uppercase tracking-wider text-red-500 bg-red-50 px-1.5 py-0.5 rounded flex-shrink-0">
            Critical
          </span>
        )}
        <span className="text-[9px] text-grey-300 uppercase tracking-wider flex-shrink-0 w-16 text-right">{change.category}</span>

        {hasExpandable && (
          <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.15 }}>
            <ChevronDown className="w-3 h-3 text-grey-300" />
          </motion.div>
        )}
      </div>

      {/* Expandable detail — compact */}
      <AnimatePresence>
        {isExpanded && hasExpandable && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={appleEase}
            className="overflow-hidden"
          >
            <div className="px-4 pb-2.5 ml-[2px] border-l-2 border-l-transparent">
              {/* Before → After for modified — compact table */}
              {change.changeType === 'modified' && change.fieldChanges.length > 0 && (
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-[9px] text-grey-400 uppercase tracking-wider">
                      <th className="text-left font-semibold py-1 w-1/4">Field</th>
                      <th className="text-left font-semibold py-1 w-[37.5%]">Before</th>
                      <th className="text-left font-semibold py-1 w-[37.5%]">After</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grey-50">
                    {change.fieldChanges.map((fc, i) => (
                      <tr key={i}>
                        <td className="py-1 text-grey-400">{friendlyField(fc.field)}</td>
                        <td className="py-1 text-grey-500">{fmtVal(fc.old)}</td>
                        <td className="py-1 text-grey-900 font-medium">{fmtVal(fc.new)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Extra properties for added/removed beyond the 2 shown inline */}
              {(change.changeType === 'added' || change.changeType === 'removed') && props.length > 2 && (
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 pt-1">
                  {props.slice(2).map(([label, val]) => (
                    <span key={label} className="text-[10px] text-grey-400">
                      <span className="text-grey-300">{label}:</span> {val}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/** Extract key properties as [label, value] pairs for inline display */
function getInlineProps(change: UnifiedChange): Array<[string, string]> {
  const value = change.changeType === 'removed' ? change.oldValue : change.newValue
  if (!value) return []
  const rows: Array<[string, string]> = []
  if (value.criterion_type) rows.push(['Type', String(value.criterion_type).replace(/_/g, ' ')])
  if (value.is_required !== undefined) rows.push(['Required', value.is_required ? 'Yes' : 'No'])
  if (value.threshold_value != null) {
    const op = value.comparison_operator ? `${value.comparison_operator} ` : ''
    const unit = value.threshold_unit ? ` ${value.threshold_unit}` : ''
    rows.push(['Threshold', `${op}${value.threshold_value}${unit}`])
  }
  if (Array.isArray(value.drug_names) && value.drug_names.length > 0) rows.push(['Drugs', value.drug_names.join(', ')])
  if (Array.isArray(value.drug_classes) && value.drug_classes.length > 0) rows.push(['Classes', value.drug_classes.join(', ')])
  if (Array.isArray(value.clinical_codes) && value.clinical_codes.length > 0) {
    const codes = value.clinical_codes.map((c: Record<string, string>) => `${c.system || ''}:${c.code || ''}`).join(', ')
    if (codes) rows.push(['Codes', codes])
  }
  return rows
}
