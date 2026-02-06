import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Plus,
  FileText,
  ArrowRight,
  Brain,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Sparkles,
  Activity,
  BookOpen,
  Settings,
  Zap,
} from 'lucide-react'
import {
  CaseQueueCard,
  type CaseQueueItem,
} from '@/components/domain/CaseQueueCard'
import { useCases } from '@/hooks/useCases'
import { ENDPOINTS, QUERY_KEYS, CACHE_TIMES } from '@/lib/constants'
import { getInitials } from '@/lib/utils'
import type { CaseState, CaseStage, PayerStatus } from '@/types/case'

function toCaseQueueItem(caseState: CaseState): CaseQueueItem {
  const primaryPayerName = caseState.patient.primary_payer
  const primaryPayer = caseState.payer_states[primaryPayerName]
  const assessment = caseState.coverage_assessments?.[primaryPayerName]
  const confidence = assessment?.approval_likelihood ?? 0.5
  const patientName = `${caseState.patient.first_name} ${caseState.patient.last_name}`

  const aiStatusMap: Record<CaseStage, string> = {
    intake: 'Ready for review',
    policy_analysis: 'AI analyzing policy',
    awaiting_human_decision: 'Ready for decision',
    strategy_generation: 'Generating strategies',
    strategy_selection: 'Strategy ready',
    action_coordination: 'Executing strategy',
    monitoring: 'Monitoring payers',
    recovery: 'Recovery in progress',
    completed: 'Completed',
    failed: 'Failed - needs attention',
  }

  return {
    caseId: caseState.case_id,
    patientName,
    patientInitials: getInitials(patientName),
    medication: caseState.medication.medication_name,
    payerName: primaryPayerName,
    stage: caseState.stage,
    payerStatus: primaryPayer?.status ?? 'not_submitted',
    aiStatus: aiStatusMap[caseState.stage] || 'Processing',
    confidence,
    updatedAt: caseState.updated_at,
  }
}

function getCasePriority(stage: CaseStage, payerStatus: PayerStatus): 'high' | 'medium' | 'low' {
  if (stage === 'awaiting_human_decision') return 'high'
  if (stage === 'strategy_selection') return 'high'
  if (stage === 'failed') return 'high'
  if (payerStatus === 'pending_info') return 'high'
  if (stage === 'policy_analysis') return 'medium'
  if (stage === 'strategy_generation') return 'medium'
  if (stage === 'action_coordination') return 'medium'
  if (payerStatus === 'under_review') return 'medium'
  return 'low'
}

function categorizeCases(cases: CaseState[]) {
  const needsAttention: CaseQueueItem[] = []
  const inProgress: CaseQueueItem[] = []
  const completed: CaseQueueItem[] = []

  cases.forEach((caseState) => {
    const item = toCaseQueueItem(caseState)
    const priority = getCasePriority(caseState.stage, item.payerStatus)
    if (caseState.stage === 'completed') {
      completed.push(item)
    } else if (priority === 'high') {
      needsAttention.push({ ...item, priority: 'high' })
    } else {
      inProgress.push({ ...item, priority })
    }
  })

  return { needsAttention, inProgress, completed }
}

interface APIActivityItem {
  id: string
  agent_type: string
  action: string
  detail: string | null
  confidence: number | null
  timestamp: string
  case_id: string
  patient_name: string | null
  status: string
  reasoning: string | null
}

interface APIActivityResponse {
  activities: APIActivityItem[]
  total: number
}

async function fetchAIActivity() {
  const { request } = await import('@/services/api')
  const data: APIActivityResponse = await request(ENDPOINTS.recentActivity)
  return data.activities.map((item) => ({
    id: item.id,
    action: item.action,
    caseId: item.case_id,
    patientName: item.patient_name ?? undefined,
    timestamp: item.timestamp,
    status: item.status === 'success' ? 'success' as const : item.status === 'pending' ? 'pending' as const : 'info' as const,
  }))
}

const ease = [0.16, 1, 0.3, 1] as const

export function Dashboard() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useCases({ limit: 50 })

  const { data: aiActivity = [] } = useQuery({
    queryKey: QUERY_KEYS.aiActivity,
    queryFn: fetchAIActivity,
    staleTime: CACHE_TIMES.REALTIME,
    gcTime: CACHE_TIMES.GC_TIME,
    refetchInterval: 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const rawCases = data?.cases ?? []
  const { needsAttention, inProgress, completed } = useMemo(
    () => categorizeCases(rawCases),
    [rawCases]
  )

  const stats = useMemo(() => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const completedToday = rawCases.filter(
      (c) => c.stage === 'completed' && new Date(c.updated_at) >= todayStart
    ).length
    const avgProcessingDays = rawCases.length > 0
      ? rawCases.reduce((sum, c) => {
          const created = new Date(c.created_at).getTime()
          const updated = new Date(c.updated_at).getTime()
          return sum + (updated - created) / (1000 * 60 * 60 * 24)
        }, 0) / rawCases.length
      : 0
    const approvedCases = rawCases.filter((c) => {
      const primaryPayerName = c.patient.primary_payer
      const status = c.payer_states[primaryPayerName]?.status
      return status === 'approved' || status === 'appeal_approved'
    }).length
    const successRate = rawCases.length > 0 ? (approvedCases / rawCases.length) * 100 : 0
    return { completedToday, avgProcessingDays, successRate, totalCases: rawCases.length }
  }, [rawCases])

  const aiInsight = useMemo(() => {
    if (needsAttention.length > 3) {
      return `${needsAttention.length} cases need your attention. Prioritize human decision gates for fastest resolution.`
    }
    if (completed.length > 0) {
      return `${completed.length} cases completed. Cases with complete documentation show higher approval rates.`
    }
    return 'Ready to assist with policy analysis. Create a case to begin.'
  }, [needsAttention, completed])

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="min-h-screen" style={{ background: '#f5f5f7' }}>
      {/* ─── Hero Header ─── */}
      <div style={{ background: '#ffffff', borderBottom: '0.5px solid rgba(0,0,0,0.06)' }}>
        <div className="max-w-[980px] mx-auto px-6 pt-10 pb-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease }}
          >
            <div className="flex items-start justify-between mb-8">
              <div>
                <h1
                  style={{
                    fontSize: 'clamp(2rem, 4vw, 2.75rem)',
                    fontWeight: 700,
                    color: '#1d1d1f',
                    letterSpacing: '-0.035em',
                    lineHeight: 1.1,
                  }}
                >
                  {getGreeting()}.
                </h1>
                <p style={{
                  fontSize: '1.0625rem',
                  color: '#86868b',
                  marginTop: '8px',
                  letterSpacing: '-0.012em',
                  lineHeight: 1.5,
                }}>
                  Access Strategy Workspace
                </p>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => navigate('/settings')}
                  className="transition-all duration-200 hover:bg-black/[0.06]"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.03)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Settings className="w-[18px] h-[18px]" style={{ color: '#86868b' }} />
                </button>
                <motion.button
                  onClick={() => navigate('/cases/new')}
                  className="transition-all duration-200"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    background: '#1d1d1f',
                    color: '#ffffff',
                    borderRadius: '980px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    letterSpacing: '-0.01em',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                  whileHover={{ scale: 1.02, boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Plus className="w-4 h-4" strokeWidth={2.5} />
                  New Case
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* ─── Stat Tiles ─── */}
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease }}
          >
            <StatTile label="Total Cases" value={stats.totalCases} icon={<FileText className="w-4 h-4" />} />
            <StatTile label="Approved Today" value={stats.completedToday} icon={<CheckCircle2 className="w-4 h-4" />} accent="#34c759" />
            <StatTile label="Avg Processing" value={`${stats.avgProcessingDays.toFixed(1)}d`} icon={<Clock className="w-4 h-4" />} accent="#ff9500" />
            <StatTile label="Success Rate" value={`${stats.successRate.toFixed(0)}%`} icon={<Activity className="w-4 h-4" />} accent="#007aff" />
          </motion.div>
        </div>
      </div>

      {/* ─── Main Content ─── */}
      <div className="max-w-[980px] mx-auto px-6 py-10">
        {isLoading ? (
          <LoadingSkeleton />
        ) : error ? (
          <ErrorState />
        ) : rawCases.length === 0 ? (
          <EmptyState onCreateCase={() => navigate('/cases/new')} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* ─── Left: Case Queue ─── */}
            <div className="lg:col-span-2 space-y-8">
              {needsAttention.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease }}
                >
                  <SectionHeader
                    icon={<AlertTriangle className="w-[15px] h-[15px]" style={{ color: '#ff3b30' }} strokeWidth={2.2} />}
                    title="Needs Attention"
                    count={needsAttention.length}
                  />
                  <div
                    className="mt-4 space-y-2"
                    style={{
                      background: '#ffffff',
                      borderRadius: '20px',
                      padding: '8px',
                      border: '0.5px solid rgba(0,0,0,0.06)',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                    }}
                  >
                    {needsAttention.slice(0, 5).map((item) => (
                      <CaseQueueCard
                        key={item.caseId}
                        item={item}
                        onProcess={(id) => navigate(`/cases/${id}`)}
                        variant="compact"
                      />
                    ))}
                    {needsAttention.length > 5 && (
                      <ViewMoreButton onClick={() => navigate('/cases')} count={needsAttention.length - 5} />
                    )}
                  </div>
                </motion.div>
              )}

              {needsAttention.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease }}
                >
                  <div
                    className="text-center"
                    style={{
                      background: '#ffffff',
                      borderRadius: '20px',
                      padding: '40px 24px',
                      border: '0.5px solid rgba(0,0,0,0.06)',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                    }}
                  >
                    <div
                      className="mx-auto mb-4 flex items-center justify-center"
                      style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(52,199,89,0.1)' }}
                    >
                      <CheckCircle2 className="w-6 h-6" style={{ color: '#34c759' }} />
                    </div>
                    <p style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.02em' }}>
                      All clear
                    </p>
                    <p style={{ fontSize: '0.875rem', color: '#86868b', marginTop: '4px' }}>
                      No cases need your immediate attention.
                    </p>
                  </div>
                </motion.div>
              )}

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.12, ease }}
              >
                <SectionHeader
                  icon={<Clock className="w-[15px] h-[15px]" style={{ color: '#ff9500' }} strokeWidth={2.2} />}
                  title="In Progress"
                  count={inProgress.length}
                />
                <div
                  className="mt-4"
                  style={{
                    background: '#ffffff',
                    borderRadius: '20px',
                    padding: '8px',
                    border: '0.5px solid rgba(0,0,0,0.06)',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                  }}
                >
                  {inProgress.length === 0 ? (
                    <div className="text-center" style={{ padding: '32px 24px' }}>
                      <p style={{ fontSize: '0.875rem', color: '#86868b' }}>
                        No cases currently in progress.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {inProgress.slice(0, 5).map((item) => (
                        <CaseQueueCard
                          key={item.caseId}
                          item={item}
                          onProcess={(id) => navigate(`/cases/${id}`)}
                          variant="compact"
                        />
                      ))}
                      {inProgress.length > 5 && (
                        <ViewMoreButton onClick={() => navigate('/cases')} count={inProgress.length - 5} label="in-progress cases" />
                      )}
                    </div>
                  )}
                </div>
              </motion.div>

              {completed.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.24, ease }}
                >
                  <SectionHeader
                    icon={<CheckCircle2 className="w-[15px] h-[15px]" style={{ color: '#34c759' }} strokeWidth={2.2} />}
                    title="Completed"
                    count={completed.length}
                    action={{ label: 'View All', onClick: () => navigate('/cases') }}
                  />
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {completed.slice(0, 4).map((item) => (
                      <motion.div
                        key={item.caseId}
                        onClick={() => navigate(`/cases/${item.caseId}`)}
                        className="cursor-pointer group"
                        style={{
                          padding: '16px 18px',
                          background: '#ffffff',
                          borderRadius: '16px',
                          border: '0.5px solid rgba(0,0,0,0.06)',
                          boxShadow: '0 1px 4px rgba(0,0,0,0.02)',
                          transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
                        }}
                        whileTap={{ scale: 0.98 }}
                        whileHover={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)', y: -2 }}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(52,199,89,0.08)' }}
                          >
                            <CheckCircle2 className="w-4 h-4" style={{ color: '#34c759' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="truncate" style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                              {item.patientName}
                            </p>
                            <p className="truncate" style={{ fontSize: '0.75rem', color: '#aeaeb2', fontWeight: 500 }}>
                              {item.medication}
                            </p>
                          </div>
                          <ArrowRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200" style={{ color: '#aeaeb2' }} />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {/* ─── Right: Intelligence Sidebar ─── */}
            <div className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15, ease }}
              >
                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: '20px',
                    border: '0.5px solid rgba(0,0,0,0.06)',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    className="flex items-center gap-2"
                    style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.04)' }}
                  >
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, rgba(175,82,222,0.12), rgba(0,122,255,0.12))' }}
                    >
                      <Sparkles className="w-3.5 h-3.5" style={{ color: '#af52de' }} />
                    </div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.015em' }}>
                      AI Insight
                    </span>
                  </div>
                  <div style={{ padding: '16px 20px' }}>
                    <p style={{ fontSize: '0.875rem', color: '#6e6e73', lineHeight: 1.65, letterSpacing: '-0.006em' }}>
                      {aiInsight}
                    </p>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.22, ease }}
              >
                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: '20px',
                    border: '0.5px solid rgba(0,0,0,0.06)',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    className="flex items-center gap-2"
                    style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.04)' }}
                  >
                    <Zap className="w-4 h-4" style={{ color: '#86868b' }} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.015em' }}>
                      Recent Activity
                    </span>
                  </div>
                  <div style={{ padding: '8px 12px' }}>
                    {aiActivity.length === 0 ? (
                      <p style={{ fontSize: '0.875rem', color: '#aeaeb2', textAlign: 'center', padding: '20px 0' }}>
                        No recent activity
                      </p>
                    ) : (
                      aiActivity.slice(0, 5).map((activity) => (
                        <button
                          key={activity.id}
                          type="button"
                          onClick={() => activity.caseId && navigate(`/cases/${activity.caseId}`)}
                          className="w-full flex items-start gap-3 text-left rounded-xl transition-colors duration-150 hover:bg-black/[0.02]"
                          style={{ padding: '10px 8px' }}
                        >
                          <div
                            className="flex-shrink-0 rounded-full mt-[7px]"
                            style={{
                              width: '7px',
                              height: '7px',
                              background: activity.status === 'success' ? '#34c759' : activity.status === 'pending' ? '#ff9500' : '#aeaeb2',
                            }}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="truncate" style={{ fontSize: '0.8125rem', color: '#1d1d1f', fontWeight: 500 }}>
                              {activity.action}
                            </p>
                            <p style={{ fontSize: '0.6875rem', color: '#aeaeb2', marginTop: '2px' }}>
                              {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3, ease }}
              >
                <div
                  style={{
                    background: '#ffffff',
                    borderRadius: '20px',
                    border: '0.5px solid rgba(0,0,0,0.06)',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ padding: '16px 20px', borderBottom: '0.5px solid rgba(0,0,0,0.04)' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.015em' }}>
                      Quick Actions
                    </span>
                  </div>
                  <div style={{ padding: '6px 8px' }}>
                    <QuickAction
                      icon={<FileText className="w-[15px] h-[15px]" />}
                      label="View All Cases"
                      onClick={() => navigate('/cases')}
                    />
                    <QuickAction
                      icon={<BookOpen className="w-[15px] h-[15px]" />}
                      label="Policy Library"
                      onClick={() => navigate('/policies')}
                    />
                    <QuickAction
                      icon={<Settings className="w-[15px] h-[15px]" />}
                      label="Settings"
                      onClick={() => navigate('/settings')}
                    />
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function StatTile({ label, value, icon, accent }: { label: string; value: string | number; icon: React.ReactNode; accent?: string }) {
  return (
    <div
      style={{
        background: '#f5f5f7',
        borderRadius: '16px',
        padding: '20px',
        border: '0.5px solid rgba(0,0,0,0.04)',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: accent ? `${accent}14` : 'rgba(0,0,0,0.04)', color: accent || '#86868b' }}
        >
          {icon}
        </div>
      </div>
      <div
        style={{
          fontSize: 'clamp(1.5rem, 3vw, 2rem)',
          fontWeight: 700,
          color: '#1d1d1f',
          letterSpacing: '-0.035em',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: '0.75rem', color: '#86868b', marginTop: '6px', letterSpacing: '-0.003em', fontWeight: 500 }}>
        {label}
      </div>
    </div>
  )
}

function SectionHeader({ icon, title, count, action }: { icon: React.ReactNode; title: string; count?: number; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        {icon}
        <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.015em' }}>
          {title}
        </span>
        {count !== undefined && (
          <span
            className="flex items-center justify-center"
            style={{
              minWidth: '22px',
              height: '22px',
              padding: '0 6px',
              borderRadius: '7px',
              background: 'rgba(0,0,0,0.05)',
              fontSize: '0.6875rem',
              fontWeight: 600,
              color: '#6e6e73',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {count}
          </span>
        )}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-1 transition-colors duration-200 hover:opacity-70"
          style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#007aff', border: 'none', background: 'none', cursor: 'pointer' }}
        >
          {action.label}
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

function ViewMoreButton({ onClick, count, label = 'more' }: { onClick: () => void; count: number; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full transition-colors duration-200 hover:bg-black/[0.02] rounded-xl"
      style={{ padding: '12px', fontSize: '0.8125rem', fontWeight: 500, color: '#007aff', border: 'none', background: 'none', cursor: 'pointer' }}
    >
      +{count} {label}
    </button>
  )
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      className="w-full flex items-center gap-3 rounded-xl group transition-colors duration-150 hover:bg-black/[0.02]"
      style={{ padding: '12px', border: 'none', background: 'none', cursor: 'pointer' }}
      onClick={onClick}
    >
      <span style={{ color: '#aeaeb2' }}>{icon}</span>
      <span className="flex-1 text-left" style={{ fontSize: '0.875rem', color: '#1d1d1f', fontWeight: 500, letterSpacing: '-0.01em' }}>
        {label}
      </span>
      <ArrowRight className="w-3.5 h-3.5 transition-all duration-200 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5" style={{ color: '#d1d1d6' }} />
    </button>
  )
}

function EmptyState({ onCreateCase }: { onCreateCase: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease }}
    >
      <div
        className="text-center"
        style={{
          background: '#ffffff',
          borderRadius: '24px',
          padding: '80px 40px',
          border: '0.5px solid rgba(0,0,0,0.06)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
        }}
      >
        <div
          className="mx-auto mb-6 flex items-center justify-center"
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '22px',
            background: 'linear-gradient(135deg, #1d1d1f 0%, #48484a 100%)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
          }}
        >
          <Brain className="w-8 h-8 text-white" />
        </div>
        <h3 style={{
          fontSize: 'clamp(1.25rem, 3vw, 1.75rem)',
          fontWeight: 700,
          color: '#1d1d1f',
          letterSpacing: '-0.03em',
          marginBottom: '8px',
        }}>
          Ready to process cases.
        </h3>
        <p style={{
          fontSize: '1rem',
          color: '#86868b',
          maxWidth: '420px',
          margin: '0 auto 32px',
          lineHeight: 1.6,
          letterSpacing: '-0.01em',
        }}>
          Create your first case and let AI assist with policy analysis and access strategy.
        </p>
        <motion.button
          onClick={onCreateCase}
          className="inline-flex items-center gap-2"
          style={{
            padding: '14px 28px',
            background: '#1d1d1f',
            color: '#ffffff',
            borderRadius: '980px',
            fontSize: '0.9375rem',
            fontWeight: 600,
            letterSpacing: '-0.01em',
            border: 'none',
            cursor: 'pointer',
          }}
          whileHover={{ scale: 1.02, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}
          whileTap={{ scale: 0.97 }}
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          Create First Case
        </motion.button>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-12 max-w-[560px] mx-auto">
          {[
            { icon: <Brain className="w-5 h-5" />, title: 'AI Policy Analysis', desc: 'Automated clinical matching' },
            { icon: <Zap className="w-5 h-5" />, title: 'Strategy Engine', desc: 'Optimal access pathways' },
            { icon: <Activity className="w-5 h-5" />, title: 'Real-time Tracking', desc: 'End-to-end monitoring' },
          ].map((feature) => (
            <div key={feature.title} style={{ textAlign: 'center' }}>
              <div
                className="mx-auto mb-2 flex items-center justify-center"
                style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(0,0,0,0.03)', color: '#86868b' }}
              >
                {feature.icon}
              </div>
              <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                {feature.title}
              </p>
              <p style={{ fontSize: '0.75rem', color: '#aeaeb2', marginTop: '2px' }}>
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="animate-pulse"
            style={{ height: '100px', borderRadius: '16px', background: 'rgba(0,0,0,0.03)' }}
          />
        ))}
      </div>
      <div
        className="animate-pulse"
        style={{ height: '200px', borderRadius: '20px', background: '#ffffff', border: '0.5px solid rgba(0,0,0,0.06)' }}
      />
    </div>
  )
}

function ErrorState() {
  return (
    <div
      className="text-center"
      style={{
        padding: '60px 40px',
        background: '#ffffff',
        borderRadius: '24px',
        border: '0.5px solid rgba(0,0,0,0.06)',
      }}
    >
      <p style={{ fontSize: '0.9375rem', color: '#aeaeb2', marginBottom: '20px' }}>Something went wrong loading your cases.</p>
      <button
        onClick={() => window.location.reload()}
        className="transition-all duration-200 hover:bg-black/[0.08]"
        style={{
          padding: '10px 20px',
          background: 'rgba(0,0,0,0.04)',
          borderRadius: '980px',
          fontSize: '0.875rem',
          fontWeight: 500,
          color: '#1d1d1f',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Try Again
      </button>
    </div>
  )
}

export default Dashboard
