import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Plus,
  FileText,
  Settings,
  ArrowRight,
  Brain,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Sparkles,
  Activity,
  BookOpen,
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

function categorizeCases(cases: CaseState[]): {
  needsAttention: CaseQueueItem[]
  inProgress: CaseQueueItem[]
  completed: CaseQueueItem[]
} {
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

const ease = [0.16, 1, 0.3, 1]

export function Dashboard() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useCases({ limit: 50 })
  const handleNavigate = (to: string) => {
    navigate(to)
  }

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

    return { completedToday, avgProcessingDays, successRate }
  }, [rawCases])

  const aiInsight = useMemo(() => {
    if (needsAttention.length > 3) {
      return `You have ${needsAttention.length} cases that need attention. Consider prioritizing human decision gates first.`
    }
    if (completed.length > 0) {
      return `Great progress! ${completed.length} cases completed. The AI has analyzed patterns showing higher approval rates for cases with complete documentation.`
    }
    return 'AI is ready to assist with policy analysis. Create a new case to get started with AI-powered prior authorization.'
  }, [needsAttention, completed])

  const handleProcessCase = (caseId: string) => {
    handleNavigate(`/cases/${caseId}`)
  }

  const handleCreateCase = () => {
    handleNavigate('/cases/new')
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const statusColors: Record<string, string> = {
    success: 'bg-semantic-success',
    pending: 'bg-semantic-warning',
    info: 'bg-grey-300',
  }

  return (
    <div className="min-h-screen" style={{ background: '#fafafa' }}>
      <header
        className="sticky top-0 z-10"
        style={{
          background: 'rgba(250, 250, 250, 0.8)',
          backdropFilter: 'saturate(180%) blur(20px)',
          WebkitBackdropFilter: 'saturate(180%) blur(20px)',
          borderBottom: '0.5px solid rgba(0, 0, 0, 0.06)',
        }}
      >
        <div className="max-w-[1200px] mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1
                style={{
                  fontSize: 'clamp(1.25rem, 2vw, 1.5rem)',
                  fontWeight: 600,
                  color: '#1d1d1f',
                  letterSpacing: '-0.025em',
                  lineHeight: 1.2,
                }}
              >
                {getGreeting()}
              </h1>
              <p style={{ fontSize: '0.8125rem', color: '#86868b', marginTop: '2px', letterSpacing: '-0.006em' }}>
                Access Strategy Workspace
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/settings')}
                className="transition-colors duration-200"
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(0, 0, 0, 0.03)',
                  border: '0.5px solid rgba(0, 0, 0, 0.06)',
                }}
              >
                <Settings className="w-[16px] h-[16px]" style={{ color: '#86868b' }} />
              </button>
              <button
                onClick={handleCreateCase}
                className="transition-all duration-200 hover:shadow-md active:scale-[0.97]"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  background: '#1d1d1f',
                  color: '#ffffff',
                  borderRadius: '10px',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  letterSpacing: '-0.006em',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                New Case
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-[1200px] mx-auto px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-6">
            {isLoading ? (
              <LoadingSkeleton />
            ) : error ? (
              <ErrorState />
            ) : rawCases.length === 0 ? (
              <EmptyState onCreateCase={handleCreateCase} />
            ) : (
              <>
                {needsAttention.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease }}
                  >
                    <SectionCard
                      icon={<AlertTriangle className="w-4 h-4" style={{ color: '#ff3b30' }} strokeWidth={2} />}
                      title="Needs Attention"
                      count={needsAttention.length}
                    >
                      <div className="space-y-1">
                        {needsAttention.slice(0, 5).map((item) => (
                          <CaseQueueCard
                            key={item.caseId}
                            item={item}
                            onProcess={handleProcessCase}
                            variant="compact"
                          />
                        ))}
                        {needsAttention.length > 5 && (
                          <button
                            type="button"
                            onClick={() => navigate('/cases')}
                            className="w-full py-2.5 transition-colors duration-200"
                            style={{ fontSize: '0.75rem', fontWeight: 500, color: '#86868b', letterSpacing: '-0.003em' }}
                          >
                            + {needsAttention.length - 5} more cases needing attention
                          </button>
                        )}
                      </div>
                    </SectionCard>
                  </motion.div>
                )}

                {needsAttention.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease }}
                  >
                    <SectionCard
                      icon={<CheckCircle2 className="w-4 h-4" style={{ color: '#34c759' }} strokeWidth={2} />}
                      title="All Clear"
                    >
                      <div className="py-6 text-center">
                        <p style={{ fontSize: '0.8125rem', color: '#86868b' }}>
                          No cases need immediate attention. You're all caught up.
                        </p>
                      </div>
                    </SectionCard>
                  </motion.div>
                )}

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1, ease }}
                >
                  <SectionCard
                    icon={<Clock className="w-4 h-4" style={{ color: '#ff9500' }} strokeWidth={2} />}
                    title="In Progress"
                    count={inProgress.length}
                  >
                    {inProgress.length === 0 ? (
                      <div className="py-6 text-center">
                        <p style={{ fontSize: '0.8125rem', color: '#86868b' }}>
                          No cases currently in progress.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {inProgress.slice(0, 5).map((item) => (
                          <CaseQueueCard
                            key={item.caseId}
                            item={item}
                            onProcess={handleProcessCase}
                            variant="compact"
                          />
                        ))}
                        {inProgress.length > 5 && (
                          <button
                            type="button"
                            onClick={() => navigate('/cases')}
                            className="w-full py-2.5 transition-colors duration-200"
                            style={{ fontSize: '0.75rem', fontWeight: 500, color: '#86868b' }}
                          >
                            View all {inProgress.length} in-progress cases
                          </button>
                        )}
                      </div>
                    )}
                  </SectionCard>
                </motion.div>

                {completed.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.2, ease }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#34c759' }} />
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#6e6e73', letterSpacing: '-0.01em' }}>
                          Completed
                        </span>
                        <span
                          style={{
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            color: '#aeaeb2',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {completed.length}
                        </span>
                      </div>
                      <button
                        onClick={() => navigate('/cases')}
                        className="flex items-center gap-1 transition-colors duration-200 hover:opacity-70"
                        style={{ fontSize: '0.75rem', fontWeight: 500, color: '#86868b' }}
                      >
                        View All
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {completed.slice(0, 4).map((item) => (
                        <motion.div
                          key={item.caseId}
                          onClick={() => handleProcessCase(item.caseId)}
                          className="cursor-pointer group transition-all duration-300"
                          style={{
                            padding: '14px 16px',
                            borderRadius: '14px',
                            background: '#ffffff',
                            border: '0.5px solid rgba(0, 0, 0, 0.06)',
                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.02)',
                          }}
                          whileTap={{ scale: 0.98 }}
                          whileHover={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)' }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center"
                              style={{ background: 'rgba(52, 199, 89, 0.08)' }}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#34c759' }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className="truncate"
                                style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.01em' }}
                              >
                                {item.patientName}
                              </p>
                              <p
                                className="truncate"
                                style={{ fontSize: '0.6875rem', color: '#aeaeb2', fontWeight: 500 }}
                              >
                                {item.medication}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </div>

          <div className="lg:col-span-4 space-y-5">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08, ease }}
            >
              <SidebarCard title="Overview">
                <div className="space-y-4">
                  <StatRow
                    icon={<CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#34c759' }} />}
                    label="Approved Today"
                    value={stats.completedToday}
                  />
                  <StatRow
                    icon={<Clock className="w-3.5 h-3.5" style={{ color: '#ff9500' }} />}
                    label="Avg Processing"
                    value={`${stats.avgProcessingDays.toFixed(1)}d`}
                  />
                  <StatRow
                    icon={<Activity className="w-3.5 h-3.5" style={{ color: '#007aff' }} />}
                    label="Success Rate"
                    value={`${stats.successRate.toFixed(0)}%`}
                  />
                </div>
              </SidebarCard>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.16, ease }}
            >
              <SidebarCard
                title="AI Insight"
                icon={<Sparkles className="w-3 h-3" style={{ color: '#af52de' }} />}
              >
                <p style={{ fontSize: '0.8125rem', color: '#6e6e73', lineHeight: 1.6, letterSpacing: '-0.006em' }}>
                  "{aiInsight}"
                </p>
                <p style={{ fontSize: '0.6875rem', color: '#aeaeb2', marginTop: '10px', fontWeight: 500 }}>
                  Based on recent case patterns
                </p>
              </SidebarCard>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.24, ease }}
            >
              <SidebarCard
                title="Recent Activity"
                icon={<Clock className="w-3 h-3" style={{ color: '#86868b' }} />}
              >
                {aiActivity.length === 0 ? (
                  <p style={{ fontSize: '0.8125rem', color: '#aeaeb2', textAlign: 'center', padding: '12px 0' }}>
                    No recent activity
                  </p>
                ) : (
                  <div className="space-y-0">
                    {aiActivity.slice(0, 5).map((activity) => (
                      <button
                        key={activity.id}
                        type="button"
                        onClick={() => activity.caseId && navigate(`/cases/${activity.caseId}`)}
                        className="w-full flex items-start gap-2.5 text-left transition-colors duration-150 rounded-lg"
                        style={{ padding: '8px 4px' }}
                      >
                        <div
                          className={`flex-shrink-0 rounded-full ${statusColors[activity.status || 'info']}`}
                          style={{
                            width: '6px',
                            height: '6px',
                            marginTop: '6px',
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="truncate" style={{ fontSize: '0.8125rem', color: '#6e6e73' }}>
                            {activity.action}
                          </p>
                          <p style={{ fontSize: '0.6875rem', color: '#aeaeb2', marginTop: '1px', fontWeight: 500 }}>
                            {new Date(activity.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </SidebarCard>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.32, ease }}
            >
              <SidebarCard title="Quick Actions">
                <div className="space-y-0.5">
                  <QuickActionRow
                    icon={<FileText className="w-[14px] h-[14px]" />}
                    label="View All Cases"
                    onClick={() => navigate('/cases')}
                  />
                  <QuickActionRow
                    icon={<BookOpen className="w-[14px] h-[14px]" />}
                    label="Policy Library"
                    onClick={() => navigate('/policies')}
                  />
                  <QuickActionRow
                    icon={<Settings className="w-[14px] h-[14px]" />}
                    label="Settings"
                    onClick={() => navigate('/settings')}
                  />
                </div>
              </SidebarCard>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

function SectionCard({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode
  title: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '0.5px solid rgba(0, 0, 0, 0.06)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
        overflow: 'hidden',
      }}
    >
      <div
        className="flex items-center gap-2.5"
        style={{
          padding: '14px 20px',
          borderBottom: '0.5px solid rgba(0, 0, 0, 0.04)',
        }}
      >
        {icon}
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.01em' }}>
          {title}
        </span>
        {count !== undefined && (
          <span
            style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              color: '#aeaeb2',
              marginLeft: 'auto',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {count}
          </span>
        )}
      </div>
      <div style={{ padding: '12px 16px' }}>
        {children}
      </div>
    </div>
  )
}

function SidebarCard({
  title,
  icon,
  children,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: '16px',
        border: '0.5px solid rgba(0, 0, 0, 0.06)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
        overflow: 'hidden',
      }}
    >
      <div
        className="flex items-center gap-2"
        style={{
          padding: '12px 16px',
          borderBottom: '0.5px solid rgba(0, 0, 0, 0.04)',
        }}
      >
        {icon}
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.01em' }}>
          {title}
        </span>
      </div>
      <div style={{ padding: '14px 16px' }}>
        {children}
      </div>
    </div>
  )
}

function StatRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div
          className="flex items-center justify-center"
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '8px',
            background: 'rgba(0, 0, 0, 0.03)',
          }}
        >
          {icon}
        </div>
        <span style={{ fontSize: '0.8125rem', color: '#6e6e73', letterSpacing: '-0.006em' }}>{label}</span>
      </div>
      <span
        style={{
          fontSize: '1.0625rem',
          fontWeight: 600,
          color: '#1d1d1f',
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  )
}

function QuickActionRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      className="w-full flex items-center gap-3 rounded-xl group transition-colors duration-150"
      style={{ padding: '10px 8px' }}
      onClick={onClick}
    >
      <span style={{ color: '#aeaeb2' }}>{icon}</span>
      <span
        className="flex-1 text-left"
        style={{ fontSize: '0.8125rem', color: '#6e6e73', fontWeight: 500, letterSpacing: '-0.006em' }}
      >
        {label}
      </span>
      <ArrowRight
        className="w-3 h-3 transition-all duration-200 group-hover:translate-x-0.5"
        style={{ color: '#d1d1d6' }}
      />
    </button>
  )
}

function EmptyState({ onCreateCase }: { onCreateCase: () => void }) {
  return (
    <motion.div
      className="text-center"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease }}
      style={{
        padding: '64px 32px',
        background: '#ffffff',
        borderRadius: '16px',
        border: '0.5px solid rgba(0, 0, 0, 0.06)',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
      }}
    >
      <div
        className="flex items-center justify-center mx-auto mb-5"
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '16px',
          background: '#1d1d1f',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        }}
      >
        <Brain className="w-6 h-6 text-white" />
      </div>
      <h3 style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.02em', marginBottom: '6px' }}>
        Ready to Process Cases
      </h3>
      <p style={{ fontSize: '0.8125rem', color: '#86868b', maxWidth: '360px', margin: '0 auto 24px', lineHeight: 1.6, letterSpacing: '-0.006em' }}>
        Create your first case and let AI assist with policy analysis and access strategy.
      </p>
      <button
        onClick={onCreateCase}
        className="inline-flex items-center gap-2 transition-all duration-200 hover:shadow-md active:scale-[0.97]"
        style={{
          padding: '10px 24px',
          background: '#1d1d1f',
          color: '#ffffff',
          borderRadius: '12px',
          fontSize: '0.875rem',
          fontWeight: 600,
          letterSpacing: '-0.01em',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        <Plus className="w-4 h-4" strokeWidth={2.5} />
        Create First Case
      </button>
    </motion.div>
  )
}

function LoadingSkeleton() {
  return (
    <div
      style={{
        padding: '32px',
        background: '#ffffff',
        borderRadius: '16px',
        border: '0.5px solid rgba(0, 0, 0, 0.06)',
      }}
    >
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl animate-pulse" style={{ background: 'rgba(0, 0, 0, 0.04)' }} />
            <div className="flex-1 space-y-2">
              <div className="h-3 rounded-full animate-pulse" style={{ width: '60%', background: 'rgba(0, 0, 0, 0.04)' }} />
              <div className="h-2.5 rounded-full animate-pulse" style={{ width: '40%', background: 'rgba(0, 0, 0, 0.03)' }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ErrorState() {
  return (
    <div
      className="text-center"
      style={{
        padding: '48px 32px',
        background: '#ffffff',
        borderRadius: '16px',
        border: '0.5px solid rgba(0, 0, 0, 0.06)',
      }}
    >
      <p style={{ fontSize: '0.8125rem', color: '#aeaeb2', marginBottom: '16px' }}>Failed to load cases</p>
      <button
        onClick={() => window.location.reload()}
        className="transition-colors duration-200"
        style={{
          padding: '8px 16px',
          background: 'rgba(0, 0, 0, 0.04)',
          borderRadius: '10px',
          fontSize: '0.8125rem',
          fontWeight: 500,
          color: '#6e6e73',
          border: '0.5px solid rgba(0, 0, 0, 0.06)',
          cursor: 'pointer',
        }}
      >
        Retry
      </button>
    </div>
  )
}

export default Dashboard
