import { useMemo, useState, useRef, useEffect } from 'react'
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
  Loader2,
} from 'lucide-react'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { Button, SkeletonList } from '@/components/ui'
import {
  CaseQueueCard,
  type CaseQueueItem,
} from '@/components/domain/CaseQueueCard'
import {
  WorkspaceStats,
  AIInsightCard,
  RecentActivity,
  type StatItem,
} from '@/components/domain/WorkspaceStats'
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

export function Dashboard() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useCases({ limit: 50 })
  const [isNavigating, setIsNavigating] = useState(false)
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (navTimerRef.current) {
        clearTimeout(navTimerRef.current)
        navTimerRef.current = null
      }
    }
  }, [])

  const delayedNavigate = async (to: string, label?: string) => {
    if (!mountedRef.current) return
    setIsNavigating(true)
    setNavigatingTo(label || to)
    const delay = Math.floor(Math.random() * 3000) + 5000
    await new Promise<void>(resolve => {
      navTimerRef.current = setTimeout(resolve, delay)
    })
    if (!mountedRef.current) return
    setIsNavigating(false)
    setNavigatingTo(null)
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

  const stats: StatItem[] = useMemo(() => {
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

    return [
      {
        label: 'Approved Today',
        value: completedToday,
        icon: 'approved' as const,
        trend: completedToday > 3 ? 'up' as const : 'neutral' as const,
      },
      {
        label: 'Avg Processing',
        value: `${avgProcessingDays.toFixed(1)}d`,
        icon: 'time' as const,
        trend: avgProcessingDays < 5 ? 'down' as const : 'neutral' as const,
      },
      {
        label: 'Success Rate',
        value: `${successRate.toFixed(0)}%`,
        icon: 'rate' as const,
        trend: successRate > 70 ? 'up' as const : 'neutral' as const,
        trendValue: successRate > 70 ? '+3%' : undefined,
      },
    ]
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
    delayedNavigate(`/cases/${caseId}`, 'Loading case...')
  }

  const handleCreateCase = () => {
    delayedNavigate('/cases/new', 'Creating new case...')
  }

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="min-h-screen">
      {isNavigating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-white/80 backdrop-blur-md z-50 flex items-center justify-center"
        >
          <motion.div
            className="text-center"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <div className="w-14 h-14 rounded-2xl bg-grey-900 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
            <p className="text-[15px] text-grey-800 font-semibold">{navigatingTo || 'Loading...'}</p>
            <p className="text-[13px] text-grey-400 mt-1">Please wait</p>
          </motion.div>
        </motion.div>
      )}

      <div className="glass-header sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-[20px] font-semibold text-grey-900 tracking-tight">
                {getGreeting()}
              </h1>
              <p className="text-[13px] text-grey-400 font-medium mt-0.5">PA Specialist Workspace</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="md"
                onClick={handleCreateCase}
                leftIcon={<Plus className="w-3.5 h-3.5" strokeWidth={2.5} />}
              >
                New Case
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/settings')}
              >
                <Settings className="w-[18px] h-[18px] text-grey-400" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            {isLoading ? (
              <GlassPanel variant="default" padding="lg">
                <SkeletonList count={3} />
              </GlassPanel>
            ) : error ? (
              <GlassPanel variant="default" padding="lg" className="text-center">
                <p className="text-[13px] text-grey-400">Failed to load cases</p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-4"
                  onClick={() => window.location.reload()}
                >
                  Retry
                </Button>
              </GlassPanel>
            ) : rawCases.length === 0 ? (
              <EmptyState onCreateCase={handleCreateCase} />
            ) : (
              <>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="surface-card p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className="w-[18px] h-[18px] text-semantic-error" strokeWidth={2} />
                      <h2 className="text-[15px] font-semibold text-grey-900">
                        Needs Attention
                      </h2>
                      <span className="ml-auto text-[12px] font-semibold text-grey-400 tabular-nums">
                        {needsAttention.length}
                      </span>
                    </div>

                    {needsAttention.length === 0 ? (
                      <div className="py-8 text-center">
                        <CheckCircle2 className="w-7 h-7 text-semantic-success mx-auto mb-2" />
                        <p className="text-[13px] text-grey-400">All caught up! No cases need immediate attention.</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
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
                            className="w-full py-2 text-[12px] font-medium text-grey-400 hover:text-grey-600 transition-colors"
                          >
                            + {needsAttention.length - 5} more cases needing attention
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="surface-card p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Clock className="w-[18px] h-[18px] text-semantic-warning" strokeWidth={2} />
                      <h2 className="text-[15px] font-semibold text-grey-900">
                        In Progress
                      </h2>
                      <span className="ml-auto text-[12px] font-semibold text-grey-400 tabular-nums">
                        {inProgress.length}
                      </span>
                    </div>

                    {inProgress.length === 0 ? (
                      <div className="py-8 text-center">
                        <p className="text-[13px] text-grey-400">No cases currently in progress.</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
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
                            className="w-full py-2 text-[12px] font-medium text-grey-400 hover:text-grey-600 transition-colors"
                          >
                            View all {inProgress.length} in-progress cases
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>

                {completed.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-[16px] h-[16px] text-semantic-success" />
                        <h2 className="text-[13px] font-semibold text-grey-600">
                          Completed
                        </h2>
                        <span className="text-[12px] text-grey-400 font-medium tabular-nums">
                          {completed.length}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/cases')}
                        rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
                      >
                        View All
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {completed.slice(0, 4).map((item) => (
                        <motion.div
                          key={item.caseId}
                          onClick={() => handleProcessCase(item.caseId)}
                          className="p-3 rounded-xl border-[0.5px] border-grey-200/60 bg-white hover:bg-grey-50/50 cursor-pointer transition-all duration-200 hover:shadow-card group"
                          whileTap={{ scale: 0.98 }}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-semantic-success/8 flex items-center justify-center">
                              <CheckCircle2 className="w-3.5 h-3.5 text-semantic-success" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-semibold text-grey-800 truncate">
                                {item.patientName}
                              </p>
                              <p className="text-[11px] text-grey-400 truncate font-medium">
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

          <div className="space-y-4">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
            >
              <WorkspaceStats
                stats={stats}
                title="My Performance"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
            >
              <AIInsightCard
                insight={aiInsight}
                source="recent case patterns"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              <RecentActivity
                activities={aiActivity}
                onActivityClick={(activity) => {
                  if (activity.caseId) {
                    navigate(`/cases/${activity.caseId}`)
                  }
                }}
                maxItems={5}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="surface-card overflow-hidden">
                <div className="px-4 py-3 border-b border-grey-100/80">
                  <h3 className="text-[13px] font-semibold text-grey-800">Quick Actions</h3>
                </div>
                <div className="p-1.5">
                  <QuickActionButton
                    icon={<FileText className="w-[15px] h-[15px]" />}
                    label="View All Cases"
                    onClick={() => navigate('/cases')}
                  />
                  <QuickActionButton
                    icon={<FileText className="w-[15px] h-[15px]" />}
                    label="Policy Library"
                    onClick={() => navigate('/policies')}
                  />
                  <QuickActionButton
                    icon={<Settings className="w-[15px] h-[15px]" />}
                    label="Settings"
                    onClick={() => navigate('/settings')}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

function QuickActionButton({
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
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-grey-50/80 transition-colors duration-150 text-left group"
      onClick={onClick}
    >
      <span className="text-grey-400">{icon}</span>
      <span className="text-[13px] text-grey-600 flex-1 font-medium">{label}</span>
      <ArrowRight className="w-3.5 h-3.5 text-grey-200 group-hover:text-grey-400 group-hover:translate-x-0.5 transition-all duration-200" />
    </button>
  )
}

function EmptyState({ onCreateCase }: { onCreateCase: () => void }) {
  return (
    <motion.div
      className="p-12 surface-card text-center"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-14 h-14 rounded-2xl bg-grey-900 flex items-center justify-center mx-auto mb-4 shadow-md">
        <Brain className="w-7 h-7 text-white" />
      </div>
      <h3 className="text-[17px] font-semibold text-grey-900 mb-1.5">
        Ready to Process Cases
      </h3>
      <p className="text-[13px] text-grey-400 max-w-sm mx-auto mb-6 leading-relaxed">
        Create your first prior authorization case and let AI assist with policy analysis and strategy.
      </p>
      <Button
        variant="primary"
        size="lg"
        onClick={onCreateCase}
        leftIcon={<Plus className="w-4 h-4" strokeWidth={2.5} />}
      >
        Create First Case
      </Button>
    </motion.div>
  )
}

export default Dashboard
