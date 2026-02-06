/**
 * DigitizedPolicyViewer - Comprehensive display of digitized policy data
 *
 * Design: Apple HIG-inspired, greyscale-first, typography-driven
 *
 * Displays:
 * - Policy metadata and medication codes
 * - Atomic criteria with their properties
 * - Criterion groups showing AND/OR/NOT logic
 * - Indications with ICD-10 codes and dosing
 * - Step therapy requirements
 * - Exclusions
 */

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Pill,
  Calendar,
  Hash,
  Layers,
  GitBranch,
  AlertTriangle,
  Shield,
  Stethoscope,
  Clock,
  CheckCircle2,
  XCircle,
  User,
  Beaker,
} from 'lucide-react'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { cn } from '@/lib/utils'
import { fadeInUp, staggerContainer } from '@/lib/animations'

// Types matching the backend schema
interface ClinicalCode {
  system: string
  code: string
  display?: string
}

interface AtomicCriterion {
  criterion_id: string
  criterion_type: string
  name: string
  description: string
  policy_text: string
  clinical_codes: ClinicalCode[]
  comparison_operator?: string
  threshold_value?: number | string
  threshold_unit?: string
  allowed_values: string[]
  drug_names: string[]
  drug_classes: string[]
  evidence_types: string[]
  is_required: boolean
  category: string
  source_section?: string
  // Provenance & evaluation fields (from policy_digitalization module)
  source_page?: number
  source_text_excerpt?: string
  extraction_confidence?: 'high' | 'medium' | 'low' | 'unconfident'
  validation_status?: string
  patient_data_path?: string
  evaluation_strategy?: string
  codes_validated?: boolean
  criterion_category?: string
}

interface CriterionGroup {
  group_id: string
  name: string
  description?: string
  operator: 'AND' | 'OR' | 'NOT'
  criteria: string[]
  subgroups: string[]
  negated: boolean
}

interface DosingRequirement {
  indication: string
  phase: string
  dose_value?: number
  dose_unit: string
  route: string
  frequency: string
  max_dose?: number
  notes?: string
}

interface IndicationCriteria {
  indication_id: string
  indication_name: string
  indication_codes: ClinicalCode[]
  initial_approval_criteria: string
  continuation_criteria?: string
  initial_approval_duration_months: number
  continuation_approval_duration_months?: number
  dosing_requirements: DosingRequirement[]
  min_age_years?: number
  max_age_years?: number
}

interface StepTherapyRequirement {
  requirement_id: string
  indication: string
  required_drugs: string[]
  required_drug_classes: string[]
  minimum_trials: number
  minimum_duration_days?: number
  failure_required: boolean
  intolerance_acceptable: boolean
  contraindication_acceptable: boolean
  documentation_requirements: string[]
}

interface ExclusionCriteria {
  exclusion_id: string
  name: string
  description: string
  policy_text: string
  trigger_criteria: string[]
}

// Safety screening can be either a string or an object with details
interface SafetyScreening {
  screening_id: string
  name: string
  description?: string
  required?: boolean
  timing?: string
  criterion_id?: string
  acceptable_tests?: Array<{ test_name: string; loinc_code?: string; cpt_code?: string }>
  if_positive?: string
}

interface CriterionProvenance {
  criterion_id: string
  source_page?: number
  source_section?: string
  source_text_excerpt?: string
  extraction_confidence?: 'high' | 'medium' | 'low' | 'unconfident'
  validation_action?: string
  validation_reasoning?: string
  code_validation_results?: Record<string, boolean>
}

interface DigitizedPolicy {
  policy_id: string
  policy_number: string
  policy_title: string
  payer_name: string
  medication_name: string
  medication_brand_names: string[]
  medication_generic_names: string[]
  medication_codes: ClinicalCode[]
  effective_date?: string
  last_revision_date?: string
  atomic_criteria: Record<string, AtomicCriterion>
  criterion_groups: Record<string, CriterionGroup>
  indications: IndicationCriteria[]
  exclusions: ExclusionCriteria[]
  step_therapy_requirements: StepTherapyRequirement[]
  required_specialties: string[]
  consultation_allowed: boolean
  safety_screenings: (string | SafetyScreening)[]
  extraction_timestamp?: string
  extraction_model?: string
  // New fields from policy_digitalization module
  policy_type?: string
  version?: string
  extraction_pipeline_version?: string
  validation_model?: string
  extraction_quality?: 'good' | 'needs_review' | 'poor'
  provenances?: Record<string, CriterionProvenance>
}

interface DigitizedPolicyViewerProps {
  policy: DigitizedPolicy
  className?: string
}

// Tab type
type TabId = 'overview' | 'criteria' | 'indications' | 'step-therapy' | 'groups'

export function DigitizedPolicyViewer({ policy, className }: DigitizedPolicyViewerProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [expandedCriteria, setExpandedCriteria] = useState<Set<string>>(new Set())

  // Stats
  const stats = useMemo(() => ({
    atomicCriteria: Object.keys(policy.atomic_criteria).length,
    criterionGroups: Object.keys(policy.criterion_groups).length,
    indications: policy.indications.length,
    exclusions: policy.exclusions.length,
    stepTherapy: policy.step_therapy_requirements.length,
  }), [policy])

  const tabs: { id: TabId; label: string; count?: number }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'criteria', label: 'Atomic Criteria', count: stats.atomicCriteria },
    { id: 'groups', label: 'Criterion Groups', count: stats.criterionGroups },
    { id: 'indications', label: 'Indications', count: stats.indications },
    { id: 'step-therapy', label: 'Step Therapy', count: stats.stepTherapy },
  ]

  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      className={cn('space-y-6', className)}
    >
      {/* Policy Header */}
      <PolicyHeader policy={policy} stats={stats} />

      {/* Tab Navigation */}
      <div className="border-b border-grey-200">
        <nav className="flex gap-6" aria-label="Policy sections">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'pb-3 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.id
                  ? 'border-grey-900 text-grey-900'
                  : 'border-transparent text-grey-500 hover:text-grey-700'
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn(
                  'ml-2 px-1.5 py-0.5 text-xs rounded',
                  activeTab === tab.id ? 'bg-grey-900 text-white' : 'bg-grey-100 text-grey-600'
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
        >
          {activeTab === 'overview' && <OverviewTab policy={policy} />}
          {activeTab === 'criteria' && (
            <AtomicCriteriaTab
              criteria={policy.atomic_criteria}
              expanded={expandedCriteria}
              onToggle={(id) => {
                setExpandedCriteria(prev => {
                  const next = new Set(prev)
                  next.has(id) ? next.delete(id) : next.add(id)
                  return next
                })
              }}
            />
          )}
          {activeTab === 'groups' && (
            <CriterionGroupsTab
              groups={policy.criterion_groups}
              criteria={policy.atomic_criteria}
              expanded={expandedGroups}
              onToggle={(id) => {
                setExpandedGroups(prev => {
                  const next = new Set(prev)
                  next.has(id) ? next.delete(id) : next.add(id)
                  return next
                })
              }}
            />
          )}
          {activeTab === 'indications' && (
            <IndicationsTab
              indications={policy.indications}
              groups={policy.criterion_groups}
              criteria={policy.atomic_criteria}
            />
          )}
          {activeTab === 'step-therapy' && (
            <StepTherapyTab
              requirements={policy.step_therapy_requirements}
              exclusions={policy.exclusions}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  )
}

/**
 * Policy Header with key metadata
 */
function PolicyHeader({ policy, stats }: {
  policy: DigitizedPolicy
  stats: { atomicCriteria: number; criterionGroups: number; indications: number; exclusions: number; stepTherapy: number }
}) {
  return (
    <GlassPanel variant="default" padding="lg">
      <div className="flex items-start justify-between gap-6">
        {/* Left: Title and basic info */}
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-grey-100 flex items-center justify-center">
            <Pill className="w-7 h-7 text-grey-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-grey-900">
              {policy.policy_title}
            </h2>
            <p className="text-grey-500 mt-1">{policy.payer_name}</p>

            {/* Medication codes */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {policy.medication_codes.slice(0, 4).map((code, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 text-xs font-mono bg-grey-100 text-grey-700 rounded"
                >
                  {code.system}: {code.code}
                </span>
              ))}
              {policy.medication_codes.length > 4 && (
                <span className="text-xs text-grey-500">
                  +{policy.medication_codes.length - 4} more
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Meta info */}
        <div className="text-right space-y-2">
          <div className="flex items-center gap-2 justify-end">
            <Hash className="w-3.5 h-3.5 text-grey-400" />
            <span className="text-sm font-mono text-grey-600">{policy.policy_number}</span>
          </div>
          {policy.effective_date && (
            <div className="flex items-center gap-2 justify-end">
              <Calendar className="w-3.5 h-3.5 text-grey-400" />
              <span className="text-sm text-grey-600">Effective: {policy.effective_date}</span>
            </div>
          )}
          {policy.extraction_model && (
            <div className="flex items-center gap-2 justify-end">
              <Beaker className="w-3.5 h-3.5 text-grey-400" />
              <span className="text-xs text-grey-400">Extracted by {policy.extraction_model}</span>
            </div>
          )}
          {policy.extraction_quality && (
            <div className="flex items-center gap-2 justify-end">
              <span className={cn(
                'px-2 py-0.5 text-xs rounded-full font-medium',
                policy.extraction_quality === 'good' ? 'bg-green-100 text-green-700' :
                policy.extraction_quality === 'needs_review' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              )}>
                Quality: {policy.extraction_quality}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-5 gap-4 mt-6 pt-6 border-t border-grey-100">
        <StatItem label="Atomic Criteria" value={stats.atomicCriteria} icon={<Layers className="w-4 h-4" />} />
        <StatItem label="Criterion Groups" value={stats.criterionGroups} icon={<GitBranch className="w-4 h-4" />} />
        <StatItem label="Indications" value={stats.indications} icon={<Stethoscope className="w-4 h-4" />} />
        <StatItem label="Step Therapy" value={stats.stepTherapy} icon={<Clock className="w-4 h-4" />} />
        <StatItem label="Exclusions" value={stats.exclusions} icon={<AlertTriangle className="w-4 h-4" />} />
      </div>
    </GlassPanel>
  )
}

function StatItem({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="text-center">
      <div className="flex items-center justify-center gap-1.5 text-grey-400 mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-grey-900">{value}</p>
    </div>
  )
}

/**
 * Overview Tab - Summary of all policy components
 */
function OverviewTab({ policy }: { policy: DigitizedPolicy }) {
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Left column */}
      <div className="space-y-6">
        {/* Brand names */}
        <div className="p-4 rounded-xl border border-grey-200 bg-white">
          <h4 className="text-sm font-medium text-grey-700 mb-3">Brand Names</h4>
          <div className="flex flex-wrap gap-2">
            {policy.medication_brand_names.map((name, idx) => (
              <span key={idx} className="px-3 py-1 bg-grey-100 text-grey-800 text-sm rounded-full">
                {name}
              </span>
            ))}
          </div>
        </div>

        {/* Generic names */}
        <div className="p-4 rounded-xl border border-grey-200 bg-white">
          <h4 className="text-sm font-medium text-grey-700 mb-3">Generic Names</h4>
          <div className="flex flex-wrap gap-2">
            {policy.medication_generic_names.map((name, idx) => (
              <span key={idx} className="px-3 py-1 bg-grey-50 text-grey-700 text-sm rounded-full font-mono">
                {name}
              </span>
            ))}
          </div>
        </div>

        {/* Required specialties */}
        {policy.required_specialties.length > 0 && (
          <div className="p-4 rounded-xl border border-grey-200 bg-white">
            <h4 className="text-sm font-medium text-grey-700 mb-3">
              <User className="w-4 h-4 inline mr-2" />
              Required Prescriber Specialties
            </h4>
            <div className="flex flex-wrap gap-2">
              {policy.required_specialties.map((spec, idx) => (
                <span key={idx} className="px-2 py-1 bg-grey-100 text-grey-700 text-xs rounded capitalize">
                  {spec}
                </span>
              ))}
            </div>
            {policy.consultation_allowed && (
              <p className="text-xs text-grey-500 mt-2">
                Consultation with specialist is acceptable
              </p>
            )}
          </div>
        )}
      </div>

      {/* Right column */}
      <div className="space-y-6">
        {/* Safety screenings */}
        {policy.safety_screenings.length > 0 && (
          <div className="p-4 rounded-xl border border-grey-200 bg-white">
            <h4 className="text-sm font-medium text-grey-700 mb-3">
              <Shield className="w-4 h-4 inline mr-2" />
              Safety Screenings Required
            </h4>
            <ul className="space-y-1.5">
              {policy.safety_screenings.map((screen, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-grey-600">
                  <span className="w-1.5 h-1.5 rounded-full bg-grey-400 mt-1.5 flex-shrink-0" />
                  {typeof screen === 'string' ? screen : screen.name || screen.screening_id}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Quick indication list */}
        <div className="p-4 rounded-xl border border-grey-200 bg-white">
          <h4 className="text-sm font-medium text-grey-700 mb-3">
            <Stethoscope className="w-4 h-4 inline mr-2" />
            Covered Indications ({policy.indications.length})
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {policy.indications.map((ind) => (
              <div key={ind.indication_id} className="flex items-center justify-between py-1.5 border-b border-grey-50 last:border-0">
                <span className="text-sm text-grey-800">{ind.indication_name}</span>
                <div className="flex items-center gap-2">
                  {ind.indication_codes[0] && (
                    <span className="text-xs font-mono text-grey-500">
                      {ind.indication_codes[0].code}
                    </span>
                  )}
                  {ind.min_age_years && (
                    <span className="text-xs text-grey-400">
                      {'>='}{ind.min_age_years}y
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Exclusions summary */}
        {policy.exclusions.length > 0 && (
          <div className="p-4 rounded-xl border border-grey-300 bg-grey-50">
            <h4 className="text-sm font-medium text-grey-700 mb-3">
              <XCircle className="w-4 h-4 inline mr-2" />
              Exclusions ({policy.exclusions.length})
            </h4>
            <ul className="space-y-1.5">
              {policy.exclusions.map((excl) => (
                <li key={excl.exclusion_id} className="text-sm text-grey-600">
                  <span className="font-medium">{excl.name}:</span> {excl.description}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Atomic Criteria Tab - All individual criteria
 */
function AtomicCriteriaTab({ criteria, expanded, onToggle }: {
  criteria: Record<string, AtomicCriterion>
  expanded: Set<string>
  onToggle: (id: string) => void
}) {
  // Group criteria by category
  const byCategory = useMemo(() => {
    const grouped: Record<string, AtomicCriterion[]> = {}
    Object.values(criteria).forEach(crit => {
      const cat = crit.category || 'other'
      if (!grouped[cat]) grouped[cat] = []
      grouped[cat].push(crit)
    })
    return grouped
  }, [criteria])

  const categoryIcons: Record<string, React.ReactNode> = {
    diagnosis: <Stethoscope className="w-4 h-4" />,
    step_therapy: <Clock className="w-4 h-4" />,
    age: <User className="w-4 h-4" />,
    prescriber: <User className="w-4 h-4" />,
    safety: <Shield className="w-4 h-4" />,
  }

  return (
    <div className="space-y-4">
      {Object.entries(byCategory).map(([category, catCriteria]) => (
        <div key={category} className="rounded-xl border border-grey-200 overflow-hidden">
          <div className="px-4 py-3 bg-grey-50 border-b border-grey-200 flex items-center gap-2">
            {categoryIcons[category] || <FileText className="w-4 h-4 text-grey-400" />}
            <span className="font-medium text-grey-800 capitalize">{category.replace('_', ' ')}</span>
            <span className="text-xs text-grey-500">({catCriteria.length})</span>
          </div>
          <div className="divide-y divide-grey-100">
            {catCriteria.map(crit => (
              <CriterionRow
                key={crit.criterion_id}
                criterion={crit}
                isExpanded={expanded.has(crit.criterion_id)}
                onToggle={() => onToggle(crit.criterion_id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function CriterionRow({ criterion, isExpanded, onToggle }: {
  criterion: AtomicCriterion
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="bg-white">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-grey-50 transition-colors"
      >
        <ChevronRight className={cn(
          'w-4 h-4 text-grey-400 mt-0.5 transition-transform flex-shrink-0',
          isExpanded && 'rotate-90'
        )} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-grey-400">{criterion.criterion_id}</span>
            <span className={cn(
              'px-1.5 py-0.5 text-xs rounded',
              criterion.is_required ? 'bg-grey-900 text-white' : 'bg-grey-200 text-grey-600'
            )}>
              {criterion.is_required ? 'Required' : 'Optional'}
            </span>
            {criterion.extraction_confidence && (
              <span className={cn(
                'px-1.5 py-0.5 text-xs rounded',
                criterion.extraction_confidence === 'high' ? 'bg-green-100 text-green-700' :
                criterion.extraction_confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                criterion.extraction_confidence === 'low' ? 'bg-orange-100 text-orange-700' :
                'bg-red-100 text-red-700'
              )}>
                {criterion.extraction_confidence}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-grey-900 mt-1">{criterion.name}</p>
          <p className="text-xs text-grey-500 mt-0.5">{criterion.description}</p>
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pl-11 space-y-3">
              {/* Policy text */}
              {criterion.policy_text && (
                <div>
                  <span className="text-xs font-medium text-grey-500">Policy Text:</span>
                  <p className="text-sm text-grey-700 italic mt-1">"{criterion.policy_text}"</p>
                </div>
              )}

              {/* Threshold */}
              {criterion.threshold_value !== undefined && (
                <div className="flex items-center gap-4">
                  <div>
                    <span className="text-xs font-medium text-grey-500">Operator:</span>
                    <p className="text-sm font-mono text-grey-800">{criterion.comparison_operator || 'eq'}</p>
                  </div>
                  <div>
                    <span className="text-xs font-medium text-grey-500">Value:</span>
                    <p className="text-sm font-mono text-grey-800">
                      {criterion.threshold_value} {criterion.threshold_unit || ''}
                    </p>
                  </div>
                </div>
              )}

              {/* Clinical codes */}
              {criterion.clinical_codes.length > 0 && (
                <div>
                  <span className="text-xs font-medium text-grey-500">Clinical Codes:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {criterion.clinical_codes.map((code, idx) => (
                      <span key={idx} className="px-2 py-0.5 text-xs font-mono bg-grey-100 text-grey-700 rounded">
                        {code.system}: {code.code}
                        {code.display && ` (${code.display})`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Drug names/classes */}
              {(criterion.drug_names.length > 0 || criterion.drug_classes.length > 0) && (
                <div>
                  <span className="text-xs font-medium text-grey-500">Related Drugs:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {criterion.drug_names.map((drug, idx) => (
                      <span key={`drug-${idx}`} className="px-2 py-0.5 text-xs bg-grey-100 text-grey-700 rounded">
                        {drug}
                      </span>
                    ))}
                    {criterion.drug_classes.map((cls, idx) => (
                      <span key={`class-${idx}`} className="px-2 py-0.5 text-xs bg-grey-200 text-grey-600 rounded italic">
                        {cls}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Criterion Groups Tab - Shows AND/OR/NOT logic
 */
function CriterionGroupsTab({ groups, criteria, expanded, onToggle }: {
  groups: Record<string, CriterionGroup>
  criteria: Record<string, AtomicCriterion>
  expanded: Set<string>
  onToggle: (id: string) => void
}) {
  const operatorStyles: Record<string, string> = {
    AND: 'bg-grey-900 text-white',
    OR: 'bg-grey-600 text-white',
    NOT: 'bg-grey-400 text-white',
  }

  return (
    <div className="space-y-3">
      {Object.values(groups).map(group => (
        <div key={group.group_id} className="rounded-xl border border-grey-200 overflow-hidden bg-white">
          <button
            onClick={() => onToggle(group.group_id)}
            className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-grey-50 transition-colors"
          >
            <ChevronRight className={cn(
              'w-4 h-4 text-grey-400 transition-transform',
              expanded.has(group.group_id) && 'rotate-90'
            )} />
            <span className={cn('px-2 py-0.5 text-xs font-bold rounded', operatorStyles[group.operator])}>
              {group.operator}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-grey-900">{group.name}</p>
              <p className="text-xs text-grey-500">
                {group.criteria.length} criteria, {group.subgroups.length} subgroups
              </p>
            </div>
            <span className="font-mono text-xs text-grey-400">{group.group_id}</span>
          </button>

          <AnimatePresence>
            {expanded.has(group.group_id) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-grey-100"
              >
                <div className="p-4 space-y-3">
                  {/* Criteria in group */}
                  {group.criteria.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-grey-500 mb-2 block">
                        Criteria ({group.criteria.length}):
                      </span>
                      <div className="space-y-1.5 pl-4 border-l-2 border-grey-200">
                        {group.criteria.map(critId => {
                          const crit = criteria[critId]
                          return (
                            <div key={critId} className="flex items-start gap-2 py-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-grey-400 mt-0.5 flex-shrink-0" />
                              <div>
                                <span className="font-mono text-xs text-grey-400">{critId}</span>
                                {crit && (
                                  <p className="text-sm text-grey-700">{crit.name}</p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Subgroups */}
                  {group.subgroups.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-grey-500 mb-2 block">
                        Subgroups ({group.subgroups.length}):
                      </span>
                      <div className="space-y-1.5 pl-4 border-l-2 border-grey-300">
                        {group.subgroups.map(subId => {
                          const sub = groups[subId]
                          return (
                            <div key={subId} className="flex items-center gap-2 py-1">
                              <GitBranch className="w-3.5 h-3.5 text-grey-400 flex-shrink-0" />
                              <span className={cn(
                                'px-1.5 py-0.5 text-xs font-bold rounded',
                                sub ? operatorStyles[sub.operator] : 'bg-grey-200'
                              )}>
                                {sub?.operator || '?'}
                              </span>
                              <span className="font-mono text-xs text-grey-500">{subId}</span>
                              {sub && <span className="text-sm text-grey-700">{sub.name}</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )
}

/**
 * Indications Tab - All covered conditions
 */
function IndicationsTab({ indications, groups, criteria }: {
  indications: IndicationCriteria[]
  groups: Record<string, CriterionGroup>
  criteria: Record<string, AtomicCriterion>
}) {
  const [expandedInd, setExpandedInd] = useState<Set<string>>(new Set())

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-4">
      {indications.map(ind => (
        <div key={ind.indication_id} className="rounded-xl border border-grey-200 overflow-hidden bg-white">
          {/* Header */}
          <button
            onClick={() => {
              setExpandedInd(prev => {
                const next = new Set(prev)
                next.has(ind.indication_id) ? next.delete(ind.indication_id) : next.add(ind.indication_id)
                return next
              })
            }}
            className="w-full px-4 py-4 flex items-center gap-4 text-left hover:bg-grey-50 transition-colors"
          >
            <ChevronDown className={cn(
              'w-5 h-5 text-grey-400 transition-transform',
              expandedInd.has(ind.indication_id) && 'rotate-180'
            )} />
            <Stethoscope className="w-5 h-5 text-grey-500" />
            <div className="flex-1">
              <h4 className="font-medium text-grey-900">{ind.indication_name}</h4>
              <div className="flex items-center gap-3 mt-1">
                {ind.indication_codes[0] && (
                  <span className="text-xs font-mono text-grey-500">
                    ICD-10: {ind.indication_codes[0].code}
                  </span>
                )}
                {ind.min_age_years && (
                  <span className="text-xs text-grey-500">
                    Age {'>='} {ind.min_age_years} years
                  </span>
                )}
                <span className="text-xs text-grey-400">
                  Initial: {ind.initial_approval_duration_months}mo
                </span>
              </div>
            </div>
          </button>

          {/* Expanded content */}
          <AnimatePresence>
            {expandedInd.has(ind.indication_id) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden border-t border-grey-100"
              >
                <div className="p-4 grid grid-cols-2 gap-6">
                  {/* Left: ICD-10 codes */}
                  <div className="space-y-4">
                    <div>
                      <h5 className="text-xs font-medium text-grey-500 mb-2">ICD-10 Codes</h5>
                      <div className="space-y-1">
                        {ind.indication_codes.map((code, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="font-mono text-sm text-grey-800">{code.code}</span>
                            {code.display && (
                              <span className="text-xs text-grey-500">{code.display}</span>
                            )}
                          </div>
                        ))}
                        {ind.indication_codes.length === 0 && (
                          <span className="text-xs text-grey-400">No codes specified</span>
                        )}
                      </div>
                    </div>

                    {/* Dosing */}
                    {ind.dosing_requirements.length > 0 && (
                      <div>
                        <h5 className="text-xs font-medium text-grey-500 mb-2">Dosing Requirements</h5>
                        <div className="space-y-2">
                          {ind.dosing_requirements.map((dose, idx) => (
                            <div key={idx} className="p-2 bg-grey-50 rounded text-sm">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-grey-800 capitalize">{dose.phase}:</span>
                                <span className="text-grey-600">
                                  {dose.dose_value} {dose.dose_unit} {dose.route}
                                </span>
                              </div>
                              <p className="text-xs text-grey-500 mt-0.5">{dose.frequency}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Approval criteria */}
                  <div className="space-y-4">
                    <div>
                      <h5 className="text-xs font-medium text-grey-500 mb-2">Initial Approval Criteria</h5>
                      <CriteriaGroupPreview
                        groupId={ind.initial_approval_criteria}
                        groups={groups}
                        criteria={criteria}
                      />
                    </div>
                    {ind.continuation_criteria && (
                      <div>
                        <h5 className="text-xs font-medium text-grey-500 mb-2">Continuation Criteria</h5>
                        <CriteriaGroupPreview
                          groupId={ind.continuation_criteria}
                          groups={groups}
                          criteria={criteria}
                        />
                      </div>
                    )}

                    {/* Approval durations */}
                    <div className="flex items-center gap-4 pt-2 border-t border-grey-100">
                      <div>
                        <span className="text-xs text-grey-500">Initial</span>
                        <p className="text-sm font-medium text-grey-800">{ind.initial_approval_duration_months} months</p>
                      </div>
                      {ind.continuation_approval_duration_months && (
                        <div>
                          <span className="text-xs text-grey-500">Continuation</span>
                          <p className="text-sm font-medium text-grey-800">{ind.continuation_approval_duration_months} months</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </motion.div>
  )
}

function CriteriaGroupPreview({ groupId, groups, criteria }: {
  groupId: string
  groups: Record<string, CriterionGroup>
  criteria: Record<string, AtomicCriterion>
}) {
  const group = groups[groupId]
  if (!group) {
    return <span className="text-xs text-grey-400 font-mono">{groupId}</span>
  }

  const operatorColors: Record<string, string> = {
    AND: 'text-grey-900 bg-grey-900',
    OR: 'text-white bg-grey-600',
    NOT: 'text-white bg-grey-400',
  }

  return (
    <div className="p-3 bg-grey-50 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <span className={cn('px-1.5 py-0.5 text-xs font-bold rounded text-white', operatorColors[group.operator])}>
          {group.operator}
        </span>
        <span className="text-sm font-medium text-grey-700">{group.name}</span>
      </div>
      <div className="space-y-1 pl-3 border-l border-grey-300">
        {group.criteria.slice(0, 3).map(critId => {
          const crit = criteria[critId]
          return (
            <p key={critId} className="text-xs text-grey-600">
              {crit?.name || critId}
            </p>
          )
        })}
        {group.criteria.length > 3 && (
          <p className="text-xs text-grey-400">+{group.criteria.length - 3} more</p>
        )}
        {group.subgroups.length > 0 && (
          <p className="text-xs text-grey-500 italic">{group.subgroups.length} nested group(s)</p>
        )}
      </div>
    </div>
  )
}

/**
 * Step Therapy Tab
 */
function StepTherapyTab({ requirements, exclusions }: {
  requirements: StepTherapyRequirement[]
  exclusions: ExclusionCriteria[]
}) {
  return (
    <div className="space-y-6">
      {/* Step therapy requirements */}
      <div>
        <h3 className="text-sm font-medium text-grey-700 mb-3">Step Therapy Requirements</h3>
        <div className="space-y-3">
          {requirements.map(req => (
            <div key={req.requirement_id} className="p-4 rounded-xl border border-grey-200 bg-white">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-grey-900">{req.indication}</h4>
                  <p className="text-xs text-grey-500 mt-0.5 font-mono">{req.requirement_id}</p>
                </div>
                <span className="px-2 py-1 bg-grey-100 text-grey-700 text-xs rounded">
                  Min {req.minimum_trials} trial{req.minimum_trials !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-4">
                {/* Required drugs */}
                {req.required_drugs.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-grey-500">Required Drugs:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {req.required_drugs.map((drug, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-grey-100 text-grey-700 text-xs rounded">
                          {drug}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Drug classes */}
                {req.required_drug_classes.length > 0 && (
                  <div>
                    <span className="text-xs font-medium text-grey-500">Required Drug Classes:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {req.required_drug_classes.map((cls, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-grey-200 text-grey-600 text-xs rounded italic">
                          {cls}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Acceptable outcomes */}
              <div className="mt-3 pt-3 border-t border-grey-100 flex items-center gap-4 text-xs">
                <span className={cn(
                  'flex items-center gap-1',
                  req.failure_required ? 'text-grey-700' : 'text-grey-400'
                )}>
                  {req.failure_required ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  Failure required
                </span>
                <span className={cn(
                  'flex items-center gap-1',
                  req.intolerance_acceptable ? 'text-grey-700' : 'text-grey-400'
                )}>
                  {req.intolerance_acceptable ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  Intolerance OK
                </span>
                <span className={cn(
                  'flex items-center gap-1',
                  req.contraindication_acceptable ? 'text-grey-700' : 'text-grey-400'
                )}>
                  {req.contraindication_acceptable ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                  Contraindication OK
                </span>
              </div>

              {/* Duration */}
              {req.minimum_duration_days && (
                <p className="text-xs text-grey-500 mt-2">
                  Minimum trial duration: {req.minimum_duration_days} days
                </p>
              )}
            </div>
          ))}
          {requirements.length === 0 && (
            <p className="text-sm text-grey-500 text-center py-4">No step therapy requirements specified</p>
          )}
        </div>
      </div>

      {/* Exclusions */}
      {exclusions.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-grey-700 mb-3">
            <AlertTriangle className="w-4 h-4 inline mr-2" />
            Exclusions
          </h3>
          <div className="space-y-3">
            {exclusions.map(excl => (
              <div key={excl.exclusion_id} className="p-4 rounded-xl border border-grey-300 bg-grey-50">
                <h4 className="font-medium text-grey-800">{excl.name}</h4>
                <p className="text-sm text-grey-600 mt-1">{excl.description}</p>
                {excl.policy_text && (
                  <p className="text-xs text-grey-500 italic mt-2">"{excl.policy_text}"</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default DigitizedPolicyViewer
