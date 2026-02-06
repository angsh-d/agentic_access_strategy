import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, X, AlertCircle, HelpCircle, ChevronRight, ChevronDown, Brain } from 'lucide-react'
import { cn, formatPercent } from '@/lib/utils'
import { Card, Badge, Progress } from '@/components/ui'
import { ProvenanceIndicator } from './ChainOfThought'
import type { CoverageAssessment as CoverageAssessmentType, CriterionAssessment, CoverageStatus } from '@/types/coverage'

interface CoverageAssessmentProps {
  assessment: CoverageAssessmentType
  className?: string
}

export function CoverageAssessment({ assessment, className }: CoverageAssessmentProps) {
  // Handle both criteria and criteria_assessments (backend uses criteria_assessments)
  const criteria = assessment.criteria ?? assessment.criteria_assessments ?? []
  const overallStatus = assessment.overall_status ?? 'unknown'

  const statusCounts = criteria.reduce<Record<CoverageStatus, number>>(
    (acc, criterion) => {
      acc[criterion.status]++
      return acc
    },
    { met: 0, not_met: 0, partial: 0, unknown: 0 }
  )

  return (
    <div className={cn('space-y-6', className)}>
      {/* Summary Card */}
      <Card variant="elevated" padding="md">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-grey-900">
              {assessment.policy_name}
            </h3>
            <p className="text-sm text-grey-500">{assessment.payer_name}</p>
          </div>
          <CoverageStatusBadge status={overallStatus} large />
        </div>

        {/* Approval likelihood with reasoning */}
        <ApprovalLikelihoodSection assessment={assessment} />

        {/* Criteria summary */}
        <div className="grid grid-cols-4 gap-3">
          <CriteriaSummaryBox
            label="Met"
            count={statusCounts.met}
            color="success"
          />
          <CriteriaSummaryBox
            label="Partial"
            count={statusCounts.partial}
            color="warning"
          />
          <CriteriaSummaryBox
            label="Not Met"
            count={statusCounts.not_met}
            color="error"
          />
          <CriteriaSummaryBox
            label="Unknown"
            count={statusCounts.unknown}
            color="neutral"
          />
        </div>
      </Card>

      {/* Criteria List */}
      <div>
        <h4 className="text-sm font-medium text-grey-700 mb-3">
          Criteria Assessment
        </h4>
        <div className="space-y-2">
          {criteria.map((criterion, index) => (
            <CriterionCard key={criterion.id || index} criterion={criterion} index={index} />
          ))}
        </div>
      </div>

      {/* Recommendations */}
      {assessment.recommendations.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-grey-700 mb-3">
            Recommendations
          </h4>
          <Card variant="default" padding="md">
            <ul className="space-y-2">
              {assessment.recommendations.map((rec, index) => (
                <li key={index} className="flex items-start gap-2">
                  <ChevronRight className="w-4 h-4 text-grey-400 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-grey-600">{rec}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  )
}

interface CoverageStatusBadgeProps {
  status: CoverageStatus
  large?: boolean
}

function CoverageStatusBadge({ status, large }: CoverageStatusBadgeProps) {
  const config: Record<CoverageStatus, {
    variant: 'success' | 'warning' | 'error' | 'neutral',
    label: string
  }> = {
    met: { variant: 'success', label: 'Criteria Met' },
    partial: { variant: 'warning', label: 'Partially Met' },
    not_met: { variant: 'error', label: 'Not Met' },
    unknown: { variant: 'neutral', label: 'Unknown' },
  }

  return (
    <Badge
      variant={config[status].variant}
      size={large ? 'md' : 'sm'}
      dot
    >
      {config[status].label}
    </Badge>
  )
}

interface CriteriaSummaryBoxProps {
  label: string
  count: number
  color: 'success' | 'warning' | 'error' | 'neutral'
}

function CriteriaSummaryBox({ label, count, color }: CriteriaSummaryBoxProps) {
  const colorClasses = {
    success: 'text-semantic-success',
    warning: 'text-semantic-warning',
    error: 'text-semantic-error',
    neutral: 'text-grey-500',
  }

  return (
    <div className="p-3 rounded-xl bg-grey-50 text-center">
      <div className={cn('text-xl font-semibold', colorClasses[color])}>
        {count}
      </div>
      <div className="text-xs text-grey-500">{label}</div>
    </div>
  )
}

interface CriterionCardProps {
  criterion: CriterionAssessment
  index: number
}

function CriterionCard({ criterion, index }: CriterionCardProps) {
  const [showDetail, setShowDetail] = useState(false)

  const statusIcons: Record<CoverageStatus, React.ReactNode> = {
    met: <Check className="w-4 h-4 text-semantic-success" />,
    not_met: <X className="w-4 h-4 text-semantic-error" />,
    partial: <AlertCircle className="w-4 h-4 text-semantic-warning" />,
    unknown: <HelpCircle className="w-4 h-4 text-grey-400" />,
  }

  const statusBg: Record<CoverageStatus, string> = {
    met: 'bg-semantic-success/10',
    not_met: 'bg-semantic-error/10',
    partial: 'bg-semantic-warning/10',
    unknown: 'bg-grey-100',
  }

  // Determine provenance source based on criterion type
  const getProvenance = () => {
    const name = criterion.name.toLowerCase()
    if (name.includes('diagnosis')) {
      return { type: 'patient_record' as const, name: 'Patient Medical Record', reference: 'Diagnosis section' }
    }
    if (name.includes('treatment') || name.includes('prior') || name.includes('step')) {
      return { type: 'clinical' as const, name: 'Clinical Documentation', reference: 'Treatment history' }
    }
    if (name.includes('age') || name.includes('eligibility')) {
      return { type: 'patient_record' as const, name: 'Patient Demographics', reference: 'Demographics section' }
    }
    if (name.includes('safety') || name.includes('screen')) {
      return { type: 'clinical' as const, name: 'Lab Results', reference: 'Safety screenings' }
    }
    return { type: 'policy' as const, name: 'Policy Document', reference: 'Coverage criteria' }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.3,
        delay: index * 0.05,
        ease: [0.16, 1, 0.3, 1]
      }}
    >
      <Card variant="default" padding="sm" className="overflow-hidden">
        <button
          onClick={() => setShowDetail(!showDetail)}
          className="w-full flex items-start gap-3 text-left"
        >
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
            statusBg[criterion.status]
          )}>
            {statusIcons[criterion.status]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h5 className="text-sm font-medium text-grey-900 truncate">
                {criterion.name}
              </h5>
              <div className="flex items-center gap-2">
                <span className="text-xs text-grey-500">
                  {formatPercent(criterion.confidence)} confident
                </span>
                <ChevronDown className={cn(
                  'w-4 h-4 text-grey-400 transition-transform',
                  showDetail && 'rotate-180'
                )} />
              </div>
            </div>
            <p className="text-xs text-grey-500 line-clamp-2">
              {criterion.description}
            </p>
            {criterion.recommendation && !showDetail && (
              <p className="text-xs text-semantic-info mt-2">
                {criterion.recommendation}
              </p>
            )}
          </div>
        </button>

        {/* Expanded detail with provenance */}
        <AnimatePresence>
          {showDetail && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-grey-200 space-y-3">
                {/* Reasoning */}
                {criterion.recommendation && (
                  <div className="p-2 bg-grey-50 rounded-lg">
                    <div className="flex items-start gap-2">
                      <Brain className="w-4 h-4 text-grey-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-medium text-grey-700 mb-1">AI Assessment</p>
                        <p className="text-xs text-grey-600">{criterion.recommendation}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Provenance */}
                <div>
                  <p className="text-xs font-medium text-grey-500 mb-1">Evidence Source</p>
                  <ProvenanceIndicator source={getProvenance()} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  )
}

/**
 * ApprovalLikelihoodSection - Shows approval likelihood with expandable reasoning
 */
function ApprovalLikelihoodSection({ assessment }: { assessment: CoverageAssessmentType }) {
  const [showReasoning, setShowReasoning] = useState(false)

  // Generate reasoning based on likelihood
  const getReasoning = () => {
    const likelihood = assessment.approval_likelihood
    const criteriaMetRatio = (assessment as any).criteria_met_count / (assessment as any).criteria_total_count

    if (likelihood >= 0.7) {
      return {
        summary: 'High approval likelihood based on strong evidence alignment.',
        factors: [
          `${Math.round(criteriaMetRatio * 100)}% of policy criteria are met`,
          'Patient diagnosis matches covered indications',
          'Required documentation is substantially complete',
        ],
        confidence: 'Based on historical approval patterns for similar cases.'
      }
    } else if (likelihood >= 0.4) {
      return {
        summary: 'Moderate approval likelihood with some documentation gaps.',
        factors: [
          `${Math.round(criteriaMetRatio * 100)}% of policy criteria are met`,
          'Some criteria require additional documentation',
          'Step therapy requirements may need clarification',
        ],
        confidence: 'Recommend addressing gaps before submission.'
      }
    } else {
      return {
        summary: 'Lower approval likelihood due to significant gaps.',
        factors: [
          `Only ${Math.round(criteriaMetRatio * 100)}% of policy criteria are met`,
          'Multiple documentation gaps identified',
          'May require peer-to-peer review or appeal',
        ],
        confidence: 'Consider gathering additional evidence or alternative approaches.'
      }
    }
  }

  const reasoning = getReasoning()

  return (
    <div className="mb-6">
      <button
        onClick={() => setShowReasoning(!showReasoning)}
        className="w-full text-left"
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm text-grey-600">Approval Likelihood</span>
            <Badge variant="neutral" size="sm" className="text-xs">
              Why?
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-lg font-semibold',
              assessment.approval_likelihood >= 0.7 ? 'text-semantic-success' :
              assessment.approval_likelihood >= 0.4 ? 'text-semantic-warning' :
              'text-semantic-error'
            )}>
              {formatPercent(assessment.approval_likelihood)}
            </span>
            <ChevronDown className={cn(
              'w-4 h-4 text-grey-400 transition-transform',
              showReasoning && 'rotate-180'
            )} />
          </div>
        </div>
      </button>

      <Progress
        value={assessment.approval_likelihood * 100}
        variant={
          assessment.approval_likelihood >= 0.7 ? 'success' :
          assessment.approval_likelihood >= 0.4 ? 'warning' : 'error'
        }
        size="lg"
      />

      {/* Expanded reasoning */}
      <AnimatePresence>
        {showReasoning && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-4 p-3 bg-grey-50 rounded-lg border border-grey-200">
              <div className="flex items-start gap-2 mb-3">
                <Brain className="w-4 h-4 text-grey-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-grey-900">{reasoning.summary}</p>
                </div>
              </div>

              <div className="space-y-2 mb-3">
                <p className="text-xs font-medium text-grey-500">Key Factors:</p>
                <ul className="space-y-1">
                  {reasoning.factors.map((factor, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-grey-600">
                      <ChevronRight className="w-3 h-3 text-grey-400 mt-0.5 flex-shrink-0" />
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-2 border-t border-grey-200">
                <p className="text-xs text-grey-500 italic">{reasoning.confidence}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default CoverageAssessment
