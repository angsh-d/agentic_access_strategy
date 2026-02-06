import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Plus,
  ArrowRight,
  Brain,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Sparkles,
  Activity,
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
    return 'Ready to assist with policy analysis. Create a case to begin AI-powered prior authorization.'
  }, [needsAttention, completed])

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  if (isLoading) return <LoadingSkeleton />
  if (error) return <ErrorState />

  const hasCases = rawCases.length > 0

  return (
    <div className="min-h-screen" style={{ background: '#fff' }}>
      {/* ── Hero ── */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease }}
        style={{
          background: 'linear-gradient(180deg, #fbfbfd 0%, #f5f5f7 100%)',
          paddingBottom: hasCases ? '0' : undefined,
        }}
      >
        <div className="max-w-[980px] mx-auto px-6" style={{ paddingTop: '56px', paddingBottom: hasCases ? '48px' : '0' }}>
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease }}
            className="text-center"
          >
            <h1 style={{
              fontSize: 'clamp(2.5rem, 5vw, 3.5rem)',
              fontWeight: 700,
              color: '#1d1d1f',
              letterSpacing: '-0.04em',
              lineHeight: 1.07,
            }}>
              {getGreeting()}.
            </h1>
            <p style={{
              fontSize: 'clamp(1rem, 2vw, 1.3125rem)',
              color: '#86868b',
              marginTop: '12px',
              letterSpacing: '-0.016em',
              lineHeight: 1.4,
              fontWeight: 400,
            }}>
              {hasCases
                ? `${stats.totalCases} case${stats.totalCases !== 1 ? 's' : ''} in your workspace`
                : 'Your access strategy workspace'}
            </p>
          </motion.div>

          {hasCases && (
            <motion.div
              className="flex items-center justify-center gap-10 sm:gap-16"
              style={{ marginTop: '44px' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.25, ease }}
            >
              <StatMetric value={stats.totalCases} label="Cases" />
              <div style={{ width: '1px', height: '40px', background: 'rgba(0,0,0,0.08)' }} />
              <StatMetric value={stats.completedToday} label="Approved Today" accent="#34c759" />
              <div style={{ width: '1px', height: '40px', background: 'rgba(0,0,0,0.08)' }} />
              <StatMetric value={`${stats.avgProcessingDays.toFixed(1)}d`} label="Avg Time" accent="#ff9500" />
              <div style={{ width: '1px', height: '40px', background: 'rgba(0,0,0,0.08)' }} />
              <StatMetric value={`${stats.successRate.toFixed(0)}%`} label="Success" accent="#007aff" />
            </motion.div>
          )}

          {!hasCases && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.25, ease }}
              className="text-center"
              style={{ paddingTop: '60px', paddingBottom: '80px' }}
            >
              <div
                className="mx-auto mb-8"
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '24px',
                  background: 'linear-gradient(145deg, #1d1d1f 0%, #3a3a3c 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)',
                }}
              >
                <Brain className="w-9 h-9 text-white" style={{ opacity: 0.95 }} />
              </div>

              <h2 style={{
                fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)',
                fontWeight: 700,
                color: '#1d1d1f',
                letterSpacing: '-0.035em',
                lineHeight: 1.1,
              }}>
                Start with a single case.
              </h2>
              <p style={{
                fontSize: 'clamp(0.9375rem, 2vw, 1.125rem)',
                color: '#86868b',
                marginTop: '12px',
                maxWidth: '440px',
                marginLeft: 'auto',
                marginRight: 'auto',
                lineHeight: 1.55,
                letterSpacing: '-0.01em',
              }}>
                Create your first case and let AI navigate policy analysis, benefit verification, and access strategy.
              </p>

              <motion.button
                onClick={() => navigate('/cases/new')}
                className="inline-flex items-center gap-2"
                style={{
                  marginTop: '36px',
                  padding: '16px 32px',
                  background: '#0071e3',
                  color: '#ffffff',
                  borderRadius: '980px',
                  fontSize: '1.0625rem',
                  fontWeight: 400,
                  letterSpacing: '-0.01em',
                  border: 'none',
                  cursor: 'pointer',
                }}
                whileHover={{ background: '#0077ED', transform: 'scale(1.02)' }}
                whileTap={{ transform: 'scale(0.98)' }}
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </motion.button>
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  onClick={() => navigate('/cases/new')}
                  className="flex items-center gap-1"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#0071e3',
                    fontSize: '1.0625rem',
                    fontWeight: 400,
                    cursor: 'pointer',
                    letterSpacing: '-0.01em',
                  }}
                >
                  Create a case
                  <ArrowRight className="w-3.5 h-3.5" style={{ marginTop: '1px' }} />
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </motion.section>

      {!hasCases && (
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.45, ease }}
          style={{ background: '#fff' }}
        >
          <div className="max-w-[980px] mx-auto px-6" style={{ paddingTop: '80px', paddingBottom: '100px' }}>
            <div className="text-center mb-12">
              <h3 style={{
                fontSize: 'clamp(1.5rem, 3vw, 2rem)',
                fontWeight: 700,
                color: '#1d1d1f',
                letterSpacing: '-0.03em',
              }}>
                Built for the way access actually works.
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-0" style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
              {[
                {
                  icon: <Brain className="w-7 h-7" />,
                  title: 'Policy Intelligence',
                  desc: 'AI analyzes coverage criteria and matches clinical documentation to payer requirements automatically.',
                },
                {
                  icon: <Activity className="w-7 h-7" />,
                  title: 'Strategy Engine',
                  desc: 'Generates optimal access pathways based on payer patterns, medication, and clinical data.',
                },
                {
                  icon: <Sparkles className="w-7 h-7" />,
                  title: 'Adaptive Workflow',
                  desc: 'Orchestrates benefit verification, prior auth, and appeals — adjusting in real time.',
                },
              ].map((feature, i) => (
                <div
                  key={feature.title}
                  style={{
                    padding: '40px 32px',
                    borderBottom: '0.5px solid rgba(0,0,0,0.08)',
                    borderRight: i < 2 ? '0.5px solid rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  <div style={{ color: '#1d1d1f', marginBottom: '16px' }}>
                    {feature.icon}
                  </div>
                  <h4 style={{
                    fontSize: '1.0625rem',
                    fontWeight: 600,
                    color: '#1d1d1f',
                    letterSpacing: '-0.02em',
                    marginBottom: '8px',
                  }}>
                    {feature.title}
                  </h4>
                  <p style={{
                    fontSize: '0.9375rem',
                    color: '#86868b',
                    lineHeight: 1.58,
                    letterSpacing: '-0.008em',
                  }}>
                    {feature.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>
      )}

      {/* ── Case Queue (when cases exist) ── */}
      {hasCases && (
        <section style={{ background: '#fff' }}>
          <div className="max-w-[980px] mx-auto px-6" style={{ paddingTop: '8px', paddingBottom: '80px' }}>
            <div className="flex items-center justify-between mb-1" style={{ padding: '16px 0' }}>
              <motion.button
                onClick={() => navigate('/cases/new')}
                className="inline-flex items-center gap-2"
                style={{
                  padding: '10px 20px',
                  background: '#0071e3',
                  color: '#ffffff',
                  borderRadius: '980px',
                  fontSize: '0.875rem',
                  fontWeight: 400,
                  letterSpacing: '-0.008em',
                  border: 'none',
                  cursor: 'pointer',
                  marginLeft: 'auto',
                }}
                whileHover={{ background: '#0077ED' }}
                whileTap={{ scale: 0.97 }}
              >
                <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                New Case
              </motion.button>
            </div>

            {/* ── AI Insight Banner ── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease }}
              style={{
                padding: '20px 24px',
                background: '#f5f5f7',
                borderRadius: '16px',
                marginBottom: '40px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '14px',
              }}
            >
              <div
                className="flex-shrink-0 flex items-center justify-center"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, rgba(175,82,222,0.15), rgba(0,122,255,0.12))',
                }}
              >
                <Sparkles className="w-4 h-4" style={{ color: '#af52de' }} />
              </div>
              <div>
                <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.01em', marginBottom: '2px' }}>
                  Intelligence
                </p>
                <p style={{ fontSize: '0.875rem', color: '#6e6e73', lineHeight: 1.5, letterSpacing: '-0.006em' }}>
                  {aiInsight}
                </p>
              </div>
            </motion.div>

            {/* ── Needs Attention ── */}
            {needsAttention.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.35, ease }}
                style={{ marginBottom: '48px' }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4" style={{ color: '#ff3b30' }} strokeWidth={2.2} />
                  <span style={{ fontSize: '1.3125rem', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.025em' }}>
                    Needs Attention
                  </span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#86868b', marginLeft: '4px' }}>
                    {needsAttention.length}
                  </span>
                </div>
                <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
                  {needsAttention.slice(0, 5).map((item) => (
                    <CaseQueueCard
                      key={item.caseId}
                      item={item}
                      onProcess={(id) => navigate(`/cases/${id}`)}
                      variant="compact"
                    />
                  ))}
                </div>
                {needsAttention.length > 5 && (
                  <LinkButton onClick={() => navigate('/cases')} label={`View all ${needsAttention.length} cases`} />
                )}
              </motion.div>
            )}

            {needsAttention.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.35, ease }}
                className="flex items-center gap-3"
                style={{
                  marginBottom: '48px',
                  padding: '20px 0',
                  borderTop: '0.5px solid rgba(0,0,0,0.08)',
                  borderBottom: '0.5px solid rgba(0,0,0,0.08)',
                }}
              >
                <CheckCircle2 className="w-5 h-5" style={{ color: '#34c759' }} />
                <span style={{ fontSize: '1.0625rem', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.02em' }}>
                  All caught up.
                </span>
                <span style={{ fontSize: '0.9375rem', color: '#86868b', letterSpacing: '-0.008em' }}>
                  No cases need your attention right now.
                </span>
              </motion.div>
            )}

            {/* ── In Progress ── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4, ease }}
              style={{ marginBottom: '48px' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" style={{ color: '#ff9500' }} strokeWidth={2.2} />
                  <span style={{ fontSize: '1.3125rem', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.025em' }}>
                    In Progress
                  </span>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#86868b', marginLeft: '4px' }}>
                    {inProgress.length}
                  </span>
                </div>
                {inProgress.length > 0 && (
                  <LinkButton onClick={() => navigate('/cases')} label="View All" />
                )}
              </div>
              <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
                {inProgress.length === 0 ? (
                  <p style={{ fontSize: '0.9375rem', color: '#86868b', padding: '24px 0', letterSpacing: '-0.008em' }}>
                    No cases in progress.
                  </p>
                ) : (
                  inProgress.slice(0, 5).map((item) => (
                    <CaseQueueCard
                      key={item.caseId}
                      item={item}
                      onProcess={(id) => navigate(`/cases/${id}`)}
                      variant="compact"
                    />
                  ))
                )}
              </div>
              {inProgress.length > 5 && (
                <LinkButton onClick={() => navigate('/cases')} label={`View all ${inProgress.length} in-progress cases`} />
              )}
            </motion.div>

            {/* ── Completed ── */}
            {completed.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.45, ease }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" style={{ color: '#34c759' }} strokeWidth={2.2} />
                    <span style={{ fontSize: '1.3125rem', fontWeight: 700, color: '#1d1d1f', letterSpacing: '-0.025em' }}>
                      Completed
                    </span>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#86868b', marginLeft: '4px' }}>
                      {completed.length}
                    </span>
                  </div>
                  <LinkButton onClick={() => navigate('/cases')} label="View All" />
                </div>
                <div style={{ borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
                  {completed.slice(0, 4).map((item) => (
                    <button
                      key={item.caseId}
                      onClick={() => navigate(`/cases/${item.caseId}`)}
                      className="w-full flex items-center gap-4 text-left group transition-colors duration-200 hover:bg-black/[0.015]"
                      style={{
                        padding: '16px 4px',
                        borderBottom: '0.5px solid rgba(0,0,0,0.06)',
                        background: 'none',
                        border: 'none',
                        borderBottomWidth: '0.5px',
                        borderBottomStyle: 'solid',
                        borderBottomColor: 'rgba(0,0,0,0.06)',
                        cursor: 'pointer',
                        width: '100%',
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(52,199,89,0.08)' }}
                      >
                        <CheckCircle2 className="w-4 h-4" style={{ color: '#34c759' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="truncate block" style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.01em' }}>
                          {item.patientName}
                        </span>
                        <span className="truncate block" style={{ fontSize: '0.8125rem', color: '#86868b', marginTop: '1px' }}>
                          {item.medication}
                        </span>
                      </div>
                      <ArrowRight className="w-4 h-4 flex-shrink-0 transition-all duration-200 opacity-0 group-hover:opacity-60 group-hover:translate-x-0.5" style={{ color: '#86868b' }} />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Recent Activity ── */}
            {aiActivity.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.5, ease }}
                style={{ marginTop: '48px' }}
              >
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#86868b', letterSpacing: '-0.003em', textTransform: 'uppercase' as const }}>
                  Recent Activity
                </span>
                <div style={{ marginTop: '12px', borderTop: '0.5px solid rgba(0,0,0,0.08)' }}>
                  {aiActivity.slice(0, 4).map((activity) => (
                    <button
                      key={activity.id}
                      type="button"
                      onClick={() => activity.caseId && navigate(`/cases/${activity.caseId}`)}
                      className="w-full flex items-center gap-3 text-left transition-colors duration-150 hover:bg-black/[0.015]"
                      style={{
                        padding: '14px 4px',
                        borderBottom: '0.5px solid rgba(0,0,0,0.06)',
                        background: 'none',
                        border: 'none',
                        borderBottomWidth: '0.5px',
                        borderBottomStyle: 'solid',
                        borderBottomColor: 'rgba(0,0,0,0.06)',
                        cursor: 'pointer',
                        width: '100%',
                      }}
                    >
                      <div
                        className="flex-shrink-0 rounded-full"
                        style={{
                          width: '8px',
                          height: '8px',
                          background: activity.status === 'success' ? '#34c759' : activity.status === 'pending' ? '#ff9500' : '#d1d1d6',
                        }}
                      />
                      <span className="flex-1 truncate" style={{ fontSize: '0.9375rem', color: '#1d1d1f', fontWeight: 500, letterSpacing: '-0.008em' }}>
                        {activity.action}
                      </span>
                      <span style={{ fontSize: '0.8125rem', color: '#aeaeb2', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                        {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function StatMetric({ value, label, accent }: { value: string | number; label: string; accent?: string }) {
  return (
    <div className="text-center">
      <div style={{
        fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
        fontWeight: 700,
        color: accent || '#1d1d1f',
        letterSpacing: '-0.04em',
        lineHeight: 1,
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
      <div style={{
        fontSize: '0.75rem',
        color: '#86868b',
        marginTop: '6px',
        letterSpacing: '-0.003em',
        fontWeight: 500,
      }}>
        {label}
      </div>
    </div>
  )
}

function LinkButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 transition-colors duration-200 hover:underline"
      style={{
        fontSize: '0.9375rem',
        fontWeight: 400,
        color: '#0071e3',
        border: 'none',
        background: 'none',
        cursor: 'pointer',
        letterSpacing: '-0.008em',
      }}
    >
      {label}
      <ArrowRight className="w-3.5 h-3.5" style={{ marginTop: '1px' }} />
    </button>
  )
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen" style={{ background: '#fff' }}>
      <div className="max-w-[980px] mx-auto px-6" style={{ paddingTop: '80px' }}>
        <div className="text-center">
          <div className="animate-pulse mx-auto" style={{ width: '260px', height: '48px', borderRadius: '12px', background: '#f5f5f7' }} />
          <div className="animate-pulse mx-auto mt-4" style={{ width: '200px', height: '24px', borderRadius: '8px', background: '#f5f5f7' }} />
        </div>
        <div className="animate-pulse mt-16" style={{ height: '200px', borderRadius: '12px', background: '#f5f5f7' }} />
      </div>
    </div>
  )
}

function ErrorState() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#fff' }}>
      <div className="text-center">
        <p style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.02em' }}>
          Something went wrong.
        </p>
        <p style={{ fontSize: '0.9375rem', color: '#86868b', marginTop: '8px', letterSpacing: '-0.008em' }}>
          We couldn't load your cases. Please try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-1 mt-6"
          style={{
            padding: '10px 20px',
            background: '#0071e3',
            color: '#ffffff',
            borderRadius: '980px',
            fontSize: '0.875rem',
            fontWeight: 400,
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Try Again
        </button>
      </div>
    </div>
  )
}

export default Dashboard
