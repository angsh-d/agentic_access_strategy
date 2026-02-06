/**
 * Dashboard - PA Specialist Workspace
 *
 * REDESIGNED following persona-driven UX principles:
 * - "My Queue" is the hero - actionable cases front and center
 * - Cases grouped: Needs Attention -> In Progress -> Completed
 * - Direct "Process" action - one click to start working
 * - AI metrics in sidebar, not center stage
 * - Performance is secondary to the work queue
 *
 * Mental model: "I come to work, see my cases for the day, and process them one by one"
 */

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

// Transform CaseState to CaseQueueItem for display
function toCaseQueueItem(caseState: CaseState): CaseQueueItem {
  const primaryPayerName = caseState.patient.primary_payer
  const primaryPayer = caseState.payer_states[primaryPayerName]
  const assessment = caseState.coverage_assessments?.[primaryPayerName]
  const confidence = assessment?.approval_likelihood ?? 0.5
  const patientName = `${caseState.patient.first_name} ${caseState.patient.last_name}`

  // Determine AI status message based on stage
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

// Get priority based on stage and status
function getCasePriority(stage: CaseStage, payerStatus: PayerStatus): 'high' | 'medium' | 'low' {
  // High priority: needs immediate human action
  if (stage === 'awaiting_human_decision') return 'high'
  if (stage === 'strategy_selection') return 'high'
  if (stage === 'failed') return 'high'
  if (payerStatus === 'pending_info') return 'high'

  // Medium priority: in progress, automated
  if (stage === 'policy_analysis') return 'medium'
  if (stage === 'strategy_generation') return 'medium'
  if (stage === 'action_coordination') return 'medium'
  if (payerStatus === 'under_review') return 'medium'

  // Low priority: completed or early stage
  return 'low'
}

// Categorize cases for display
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

// Type for API activity response
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

// Fetch real AI activity from backend using central API client
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

  // Delayed navigation for simulating real-time processing
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

  // Fetch real AI activity from backend - uses polling for real-time updates
  const { data: aiActivity = [] } = useQuery({
    queryKey: QUERY_KEYS.aiActivity,
    queryFn: fetchAIActivity,
    staleTime: CACHE_TIMES.REALTIME, // 5 seconds - real-time data
    gcTime: CACHE_TIMES.GC_TIME,
    refetchInterval: 60 * 1000, // Poll every minute for updates
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  // Transform and categorize cases
  const rawCases = data?.cases ?? []
  const { needsAttention, inProgress, completed } = useMemo(
    () => categorizeCases(rawCases),
    [rawCases]
  )

  // Calculate performance stats
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

  // Generate AI insight based on data
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

  // Get current time greeting
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="min-h-screen bg-grey-50">
      {/* Full-page loading overlay */}
      {isNavigating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex items-center justify-center"
        >
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-grey-900 flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
            <p className="text-grey-700 font-medium">{navigatingTo || 'Loading...'}</p>
            <p className="text-sm text-grey-500 mt-1">Please wait</p>
          </div>
        </motion.div>
      )}

      {/* Header */}
      <div className="bg-white border-b border-grey-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-grey-900">
                {getGreeting()}
              </h1>
              <p className="text-sm text-grey-500">PA Specialist Workspace</p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                onClick={handleCreateCase}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                New Case
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/settings')}
              >
                <Settings className="w-5 h-5 text-grey-400" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Column - Case Queue */}
          <div className="lg:col-span-2 space-y-6">
            {/* Needs Attention - High Priority */}
            {isLoading ? (
              <GlassPanel variant="default" padding="lg">
                <SkeletonList count={3} />
              </GlassPanel>
            ) : error ? (
              <GlassPanel variant="default" padding="lg" className="text-center">
                <p className="text-grey-500">Failed to load cases</p>
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
                {/* Needs Attention Section */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <GlassPanel variant="default" padding="lg">
                    <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className="w-5 h-5 text-semantic-error" />
                      <h2 className="text-lg font-semibold text-grey-900">
                        Needs Attention
                      </h2>
                      <span className="ml-auto text-sm font-medium text-grey-500">
                        {needsAttention.length} cases
                      </span>
                    </div>

                    {needsAttention.length === 0 ? (
                      <div className="py-6 text-center text-sm text-grey-500">
                        <CheckCircle2 className="w-8 h-8 text-semantic-success mx-auto mb-2" />
                        All caught up! No cases need immediate attention.
                      </div>
                    ) : (
                      <div className="space-y-2">
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
                            className="w-full py-2 text-sm text-grey-500 hover:text-grey-700 transition-colors"
                          >
                            + {needsAttention.length - 5} more cases needing attention
                          </button>
                        )}
                      </div>
                    )}
                  </GlassPanel>
                </motion.div>

                {/* In Progress Section */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                >
                  <GlassPanel variant="light" padding="lg">
                    <div className="flex items-center gap-2 mb-4">
                      <Clock className="w-5 h-5 text-semantic-warning" />
                      <h2 className="text-lg font-semibold text-grey-900">
                        In Progress
                      </h2>
                      <span className="ml-auto text-sm font-medium text-grey-500">
                        {inProgress.length} cases
                      </span>
                    </div>

                    {inProgress.length === 0 ? (
                      <div className="py-6 text-center text-sm text-grey-500">
                        No cases currently in progress.
                      </div>
                    ) : (
                      <div className="space-y-2">
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
                            className="w-full py-2 text-sm text-grey-500 hover:text-grey-700 transition-colors"
                          >
                            View all {inProgress.length} in-progress cases
                          </button>
                        )}
                      </div>
                    )}
                  </GlassPanel>
                </motion.div>

                {/* Completed Today */}
                {completed.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-semantic-success" />
                        <h2 className="text-sm font-semibold text-grey-700">
                          Completed
                        </h2>
                        <span className="text-sm text-grey-500">
                          {completed.length} cases
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/cases')}
                        rightIcon={<ArrowRight className="w-4 h-4" />}
                      >
                        View All
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {completed.slice(0, 4).map((item) => (
                        <div
                          key={item.caseId}
                          onClick={() => handleProcessCase(item.caseId)}
                          className="p-3 rounded-lg border border-grey-200 bg-white hover:bg-grey-50 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-semantic-success/10 flex items-center justify-center">
                              <CheckCircle2 className="w-4 h-4 text-semantic-success" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-grey-900 truncate">
                                {item.patientName}
                              </p>
                              <p className="text-xs text-grey-500 truncate">
                                {item.medication}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </div>

          {/* Sidebar - Performance & Insights */}
          <div className="space-y-6">
            {/* Performance Stats */}
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <WorkspaceStats
                stats={stats}
                title="My Performance"
              />
            </motion.div>

            {/* AI Insight */}
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <AIInsightCard
                insight={aiInsight}
                source="recent case patterns"
              />
            </motion.div>

            {/* Recent Activity */}
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
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

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.4 }}
            >
              <div className="rounded-xl border border-grey-200 bg-white overflow-hidden">
                <div className="px-4 py-3 border-b border-grey-100">
                  <h3 className="text-sm font-semibold text-grey-900">Quick Actions</h3>
                </div>
                <div className="p-2">
                  <QuickActionButton
                    icon={<FileText className="w-4 h-4" />}
                    label="View All Cases"
                    onClick={() => navigate('/cases')}
                  />
                  <QuickActionButton
                    icon={<FileText className="w-4 h-4" />}
                    label="Policy Library"
                    onClick={() => navigate('/policies')}
                  />
                  <QuickActionButton
                    icon={<Settings className="w-4 h-4" />}
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

/**
 * Quick Action Button
 */
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
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-grey-100 transition-colors text-left group"
      onClick={onClick}
    >
      <span className="text-grey-400">{icon}</span>
      <span className="text-sm text-grey-700 flex-1">{label}</span>
      <ArrowRight className="w-4 h-4 text-grey-300 group-hover:text-grey-500 group-hover:translate-x-0.5 transition-all" />
    </button>
  )
}

/**
 * Empty State
 */
function EmptyState({ onCreateCase }: { onCreateCase: () => void }) {
  return (
    <motion.div
      className="p-12 rounded-2xl bg-white border border-grey-200 text-center"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="w-16 h-16 rounded-2xl bg-grey-900 flex items-center justify-center mx-auto mb-4 shadow-md">
        <Sparkles className="w-8 h-8 text-white" />
      </div>
      <h3 className="text-lg font-semibold text-grey-900 mb-2">Welcome to Your Workspace</h3>
      <p className="text-grey-500 mb-6 max-w-md mx-auto">
        Start processing prior authorization requests with AI assistance.
        Create your first case to get started.
      </p>
      <Button
        variant="primary"
        onClick={onCreateCase}
        leftIcon={<Brain className="w-4 h-4" />}
      >
        Create Your First Case
      </Button>
    </motion.div>
  )
}

export default Dashboard
