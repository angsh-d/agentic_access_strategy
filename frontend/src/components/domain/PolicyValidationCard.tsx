/**
 * PolicyValidationCard - Detailed policy criteria validation view
 *
 * Displays policy requirements with expandable categories, logical operators,
 * and real-time evaluation against patient data.
 */

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  MinusCircle,
  Circle,
  Scale,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ENDPOINTS, QUERY_KEYS, CACHE_TIMES } from '@/lib/constants'
import { usePatientData } from '@/hooks/usePatientData'

interface PolicyValidationCardProps {
  patientId: string
  payerName: string
  medicationName: string
}

export function PolicyValidationCard({
  patientId,
  payerName,
  medicationName,
}: PolicyValidationCardProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['all']))

  // Fetch patient data
  const { data: patientData, isLoading: patientLoading } = usePatientData(patientId)

  // Fetch digitized policy - indefinite caching for static policy data
  const { data: digitizedPolicy, isLoading: policyLoading } = useQuery({
    queryKey: QUERY_KEYS.policyDigitized(payerName.toLowerCase(), medicationName.toLowerCase().replace(/\s+/g, '')),
    queryFn: async () => {
      const { request } = await import('@/services/api')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await request<any>(ENDPOINTS.policyDigitized(
        payerName.toLowerCase(),
        medicationName.toLowerCase().replace(/\s+/g, '')
      ))
    },
    enabled: !!payerName && !!medicationName,
    staleTime: CACHE_TIMES.STATIC,
    gcTime: CACHE_TIMES.GC_TIME,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  // Match patient diagnosis to policy indication
  const matchedIndication = useMemo(() => {
    if (!digitizedPolicy?.indications || !patientData?.diagnoses) return null

    const patientCodes = patientData.diagnoses.map(d => d.icd10_code?.toUpperCase())

    for (const indication of digitizedPolicy.indications) {
      if (indication.indication_codes) {
        for (const code of indication.indication_codes) {
          if (patientCodes.some(pc => pc?.startsWith(code.code?.split('.')[0]))) {
            return indication
          }
        }
      }
      const indicationNameLower = indication.indication_name?.toLowerCase() || ''
      for (const dx of patientData.diagnoses) {
        const dxDesc = dx.description?.toLowerCase() || ''
        if (
          indicationNameLower.includes('crohn') && dxDesc.includes('crohn') ||
          indicationNameLower.includes('ulcerative colitis') && dxDesc.includes('ulcerative colitis') ||
          indicationNameLower.includes('rheumatoid') && dxDesc.includes('rheumatoid') ||
          indicationNameLower.includes('psoria') && dxDesc.includes('psoria') ||
          indicationNameLower.includes('ankylosing') && dxDesc.includes('ankylosing')
        ) {
          return indication
        }
      }
    }
    return null
  }, [digitizedPolicy, patientData?.diagnoses])

  // Get relevant criteria for matched indication
  const relevantCriteria = useMemo(() => {
    if (!digitizedPolicy || !matchedIndication) return []

    const criteriaIds = new Set<string>()

    const collectCriteriaIds = (groupId: string) => {
      const group = digitizedPolicy.criterion_groups?.[groupId]
      if (!group) return
      group.criteria?.forEach((id: string) => criteriaIds.add(id))
      group.subgroups?.forEach((subgroupId: string) => collectCriteriaIds(subgroupId))
    }

    if (matchedIndication.initial_approval_criteria) {
      collectCriteriaIds(matchedIndication.initial_approval_criteria)
    }

    return Array.from(criteriaIds)
      .map(id => digitizedPolicy.atomic_criteria?.[id])
      .filter(Boolean)
  }, [digitizedPolicy, matchedIndication])

  // Group criteria by category
  const groupedCriteria = useMemo(() => {
    const groups: Record<string, any[]> = {}
    relevantCriteria.forEach(criterion => {
      const category = criterion.category || 'other'
      if (!groups[category]) groups[category] = []
      groups[category].push(criterion)
    })
    return groups
  }, [relevantCriteria])

  // Evaluate criterion against patient data
  const evaluateCriterion = (criterion: any): 'met' | 'not_met' | 'partial' | 'unknown' => {
    if (!patientData) return 'unknown'

    const criterionType = criterion.criterion_type
    const criterionId = criterion.criterion_id?.toLowerCase() || ''

    // Age criteria
    if (criterionType === 'age') {
      const patientAge = patientData.demographics?.age
      if (!patientAge) return 'unknown'
      const threshold = criterion.threshold_value
      const operator = criterion.comparison_operator
      if (operator === 'gte' && patientAge >= threshold) return 'met'
      if (operator === 'gt' && patientAge > threshold) return 'met'
      if (operator === 'lte' && patientAge <= threshold) return 'met'
      if (operator === 'lt' && patientAge < threshold) return 'met'
      if (operator === 'eq' && patientAge === threshold) return 'met'
      return 'not_met'
    }

    // Diagnosis criteria
    if (criterionType === 'diagnosis_confirmed') {
      const diagnosisCodes = patientData.diagnoses?.map(d => d.icd10_code?.toUpperCase()) || []
      const requiredCodes = criterion.clinical_codes?.map((c: any) => c.code?.toUpperCase()) || []
      const hasMatch = requiredCodes.some((reqCode: string) =>
        diagnosisCodes.some(patCode => patCode?.startsWith(reqCode?.split('.')[0]))
      )
      return hasMatch ? 'met' : 'not_met'
    }

    // Prescriber specialty criteria
    if (criterionType === 'prescriber_specialty') {
      const prescriberSpecialty = patientData.prescriber?.specialty?.toLowerCase() || ''
      const allowedSpecialties = criterion.allowed_values?.map((v: string) => v.toLowerCase()) || []
      if (criterionId.includes('gi') || criterionId.includes('gastro')) {
        if (prescriberSpecialty.includes('gastro')) return 'met'
      }
      if (criterionId.includes('rheum')) {
        if (prescriberSpecialty.includes('rheum')) return 'met'
      }
      if (criterionId.includes('derm')) {
        if (prescriberSpecialty.includes('derm')) return 'met'
      }
      if (allowedSpecialties.some((s: string) => prescriberSpecialty.includes(s))) return 'met'
      return prescriberSpecialty ? 'not_met' : 'unknown'
    }

    // Prior treatment criteria
    if (criterionType === 'prior_treatment_tried' || criterionType === 'prior_treatment_failed') {
      const priorTreatments = patientData.prior_treatments || []
      const requiredDrugs = criterion.drug_names?.map((d: string) => d.toLowerCase()) || []
      const requiredClasses = criterion.drug_classes?.map((c: string) => c.toLowerCase()) || []

      const hasTried = priorTreatments.some(tx => {
        const txName = tx.medication_name?.toLowerCase() || ''
        const txClass = tx.drug_class?.toLowerCase() || ''
        return requiredDrugs.some((d: string) => txName.includes(d)) ||
               requiredClasses.some((c: string) => txClass.includes(c) || txName.includes(c))
      })

      if (criterionType === 'prior_treatment_failed') {
        const hasFailed = priorTreatments.some(tx => {
          const txName = tx.medication_name?.toLowerCase() || ''
          const txClass = tx.drug_class?.toLowerCase() || ''
          const outcome = tx.outcome?.toLowerCase() || ''
          const matchesDrug = requiredDrugs.some((d: string) => txName.includes(d)) ||
                             requiredClasses.some((c: string) => txClass.includes(c) || txName.includes(c))
          return matchesDrug && (outcome.includes('inadequate') || outcome.includes('fail') || outcome.includes('intolerance'))
        })
        return hasFailed ? 'met' : hasTried ? 'partial' : 'unknown'
      }

      return hasTried ? 'met' : 'unknown'
    }

    // Safety screening criteria
    if (criterionType === 'safety_screening_completed' || criterionType === 'safety_screening_negative') {
      const screening = patientData.pre_biologic_screening
      if (!screening) return 'unknown'

      if (criterionId.includes('tb')) {
        const tbScreening = screening.tuberculosis_screening || screening.tb_screening
        if (tbScreening?.status === 'completed' || tbScreening?.status === 'COMPLETED') {
          if (criterionType === 'safety_screening_negative') {
            const result = tbScreening.result?.toLowerCase()
            return result === 'negative' || result === 'not detected' ? 'met' : 'not_met'
          }
          return 'met'
        }
        if (tbScreening?.status === 'NOT_FOUND' || !tbScreening) {
          return 'not_met'
        }
        return 'unknown'
      }

      if (criterionId.includes('hep_b') || criterionId.includes('hepatitis_b')) {
        const hepBScreening = screening.hepatitis_b_screening
        if (hepBScreening?.status === 'completed' || hepBScreening?.status === 'COMPLETED') {
          return 'met'
        }
        if (hepBScreening?.status === 'NOT_FOUND' || !hepBScreening) {
          return 'not_met'
        }
        return 'unknown'
      }

      if (criterionId.includes('hep_c') || criterionId.includes('hepatitis_c')) {
        const hepCScreening = screening.hepatitis_c_screening
        if (hepCScreening?.status === 'completed' || hepCScreening?.status === 'COMPLETED') {
          return 'met'
        }
        if (hepCScreening?.status === 'NOT_FOUND' || !hepCScreening) {
          return 'not_met'
        }
        return 'unknown'
      }

      return 'unknown'
    }

    // Clinical marker criteria
    if (criterionType === 'clinical_marker_present') {
      if (criterionId.includes('fistula')) {
        const diagnosisCodes = patientData.diagnoses?.map(d => d.icd10_code?.toUpperCase()) || []
        const diagnosisDescriptions = patientData.diagnoses?.map(d => d.description?.toLowerCase()) || []

        const hasFistulaDiagnosis = diagnosisCodes.some(code =>
          code?.includes('13') || code?.startsWith('K60')
        ) || diagnosisDescriptions.some(desc => desc?.includes('fistula'))

        const proceduresData = patientData.procedures
        let hasFistulaProcedure = false

        if (proceduresData) {
          const procedureList = Array.isArray(proceduresData)
            ? proceduresData
            : Object.values(proceduresData)

          hasFistulaProcedure = procedureList.some((proc: any) => {
            if (!proc) return false
            const findings = proc.findings || {}
            if (findings.rectum?.fistula_observed) return true
            if (findings.fistula_classification || findings.primary_tract) return true
            if (proc.impression?.toLowerCase().includes('fistula')) return true
            return false
          })
        }

        const clinicalHistory = patientData.clinical_history
        const hasFistulaHistory = clinicalHistory?.chief_complaint?.toLowerCase().includes('fistula') ||
          clinicalHistory?.chief_complaint?.toLowerCase().includes('perianal')

        if (hasFistulaDiagnosis || hasFistulaProcedure || hasFistulaHistory) {
          return 'met'
        }
        return 'not_met'
      }

      if (criterionId.includes('resection')) {
        const proceduresData = patientData.procedures
        const surgicalHistory = patientData.clinical_history?.surgical_history || []

        let hasResectionProcedure = false
        if (proceduresData) {
          const procedureList = Array.isArray(proceduresData)
            ? proceduresData
            : Object.values(proceduresData)

          hasResectionProcedure = procedureList.some((proc: any) =>
            proc?.procedure_name?.toLowerCase().includes('resection') ||
            proc?.procedure_name?.toLowerCase().includes('ileocolectomy')
          )
        }

        const hasResectionHistory = surgicalHistory.some((surg: any) =>
          surg?.procedure?.toLowerCase().includes('resection') ||
          surg?.procedure?.toLowerCase().includes('ileocolectomy')
        )

        return (hasResectionProcedure || hasResectionHistory) ? 'met' : 'not_met'
      }

      return 'unknown'
    }

    // Lab value criteria
    if (criterionType === 'lab_value' || criterionType === 'lab_test_completed') {
      if (!patientData.laboratory_results) return 'unknown'
      return 'partial'
    }

    return 'unknown'
  }

  // Count status totals
  const statusCounts = useMemo(() => {
    let met = 0, notMet = 0, partial = 0, unknown = 0
    relevantCriteria.forEach(c => {
      const status = evaluateCriterion(c)
      if (status === 'met') met++
      else if (status === 'not_met') notMet++
      else if (status === 'partial') partial++
      else unknown++
    })
    return { met, notMet, partial, unknown, total: relevantCriteria.length }
  }, [relevantCriteria, patientData])

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) next.delete(category)
      else next.add(category)
      return next
    })
  }

  const isLoading = patientLoading || policyLoading

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-grey-100 rounded-xl animate-pulse" />
        <div className="h-40 bg-grey-100 rounded-xl animate-pulse" />
        <div className="h-32 bg-grey-100 rounded-xl animate-pulse" />
      </div>
    )
  }

  // No policy found
  if (!digitizedPolicy) {
    return (
      <div className="text-center py-12 bg-grey-50 rounded-xl">
        <Scale className="w-12 h-12 text-grey-300 mx-auto mb-4" />
        <p className="text-base font-medium text-grey-900">Policy Not Found</p>
        <p className="text-sm text-grey-500 mt-1">
          No digitized policy found for {payerName} / {medicationName}
        </p>
      </div>
    )
  }

  // No matching indication
  if (!matchedIndication) {
    return (
      <div className="bg-grey-50 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-grey-200 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-grey-500" />
          </div>
          <div>
            <h4 className="text-base font-semibold text-grey-900">No Matching Indication</h4>
            <p className="text-sm text-grey-600 mt-1">
              Patient's diagnosis does not match any covered indication in the {digitizedPolicy.payer_name} policy for {digitizedPolicy.medication_name}.
            </p>
            <p className="text-xs text-grey-500 mt-3">
              Patient diagnoses: {patientData?.diagnoses?.map(d => `${d.icd10_code} - ${d.description}`).join(', ') || 'None documented'}
            </p>
            <p className="text-xs text-grey-500 mt-1">
              Covered indications: {digitizedPolicy.indications?.map((i: any) => i.indication_name).join(', ')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Category display names
  const categoryLabels: Record<string, string> = {
    age: 'Age Requirements',
    diagnosis: 'Diagnosis',
    step_therapy: 'Step Therapy',
    prior_treatment: 'Prior Treatments',
    safety: 'Safety Screenings',
    safety_screening: 'Pre-Biologic Safety Screening',
    prescriber: 'Prescriber Requirements',
    lab: 'Laboratory',
    documentation: 'Documentation',
    clinical: 'Clinical Criteria',
    other: 'Other Requirements',
  }

  return (
    <div className="space-y-6">
      {/* Indication Match Header */}
      <div className="bg-grey-900 rounded-xl p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-grey-400 uppercase tracking-wide mb-1">Matched Indication</p>
            <h4 className="text-lg font-semibold text-white">{matchedIndication.indication_name}</h4>
            {matchedIndication.indication_codes?.length > 0 && (
              <p className="text-xs font-mono text-grey-400 mt-1">
                {matchedIndication.indication_codes.map((c: any) => `${c.system}: ${c.code}`).join(' | ')}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-grey-400">Initial Approval</p>
            <p className="text-sm font-medium text-white">{matchedIndication.initial_approval_duration_months} months</p>
          </div>
        </div>
      </div>

      {/* Criteria Status Summary */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-grey-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-semibold text-grey-900">{statusCounts.met}</p>
          <p className="text-xs text-grey-500">Met</p>
        </div>
        <div className="bg-grey-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-semibold text-grey-900">{statusCounts.partial}</p>
          <p className="text-xs text-grey-500">Partial</p>
        </div>
        <div className="bg-grey-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-semibold text-grey-900">{statusCounts.notMet}</p>
          <p className="text-xs text-grey-500">Not Met</p>
        </div>
        <div className="bg-grey-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-semibold text-grey-900">{statusCounts.unknown}</p>
          <p className="text-xs text-grey-500">Unknown</p>
        </div>
      </div>

      {/* Criteria by Category */}
      <div className="space-y-3">
        {Object.entries(groupedCriteria).map(([category, criteria]) => {
          const isExpanded = expandedCategories.has('all') || expandedCategories.has(category)
          const categoryMet = criteria.filter(c => evaluateCriterion(c) === 'met').length
          const categoryTotal = criteria.length

          const isOrLogic = category === 'step_therapy'
          const categoryStatus = isOrLogic
            ? (categoryMet >= 1 ? 'satisfied' : 'not_satisfied')
            : (categoryMet === categoryTotal ? 'satisfied' : 'not_satisfied')

          return (
            <div key={category} className="border border-grey-200 rounded-xl overflow-hidden">
              {/* Category Header */}
              <button
                type="button"
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between px-4 py-3 bg-grey-50 hover:bg-grey-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-grey-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-grey-500" />
                  )}
                  <span className="text-sm font-semibold text-grey-900">
                    {categoryLabels[category] || category.replace(/_/g, ' ')}
                  </span>
                  {categoryTotal > 1 && (
                    <span className={cn(
                      "text-[10px] font-medium px-1.5 py-0.5 rounded",
                      isOrLogic ? "bg-blue-100 text-blue-700" : "bg-grey-200 text-grey-600"
                    )}>
                      {isOrLogic ? 'ANY ONE' : 'ALL REQUIRED'}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-grey-500">
                    {categoryMet}/{categoryTotal} met
                  </span>
                  {categoryStatus === 'satisfied' && (
                    <CheckCircle className="w-4 h-4 text-grey-900" />
                  )}
                </div>
              </button>

              {/* Category Criteria */}
              {isExpanded && (
                <div className="divide-y divide-grey-100">
                  {criteria.map((criterion, idx) => {
                    const status = evaluateCriterion(criterion)
                    const isRequired = criterion.is_required !== false // Default to required if not specified
                    return (
                      <div key={idx} className="px-4 py-3 flex items-start gap-3">
                        <div className="mt-0.5">
                          {status === 'met' && <CheckCircle className="w-4 h-4 text-grey-900" />}
                          {status === 'not_met' && <XCircle className={cn("w-4 h-4", isRequired ? "text-red-500" : "text-grey-400")} />}
                          {status === 'partial' && <MinusCircle className="w-4 h-4 text-amber-500" />}
                          {status === 'unknown' && <Circle className="w-4 h-4 text-grey-300" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-medium",
                            status === 'met' ? 'text-grey-900' : 'text-grey-600'
                          )}>
                            {criterion.name}
                          </p>
                          <p className="text-xs text-grey-500 mt-0.5">{criterion.description}</p>
                          {criterion.policy_text && criterion.policy_text !== criterion.description && (
                            <p className="text-xs text-grey-400 mt-1 italic">"{criterion.policy_text}"</p>
                          )}
                          {criterion.clinical_codes?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {criterion.clinical_codes.slice(0, 3).map((code: any, codeIdx: number) => (
                                <span key={codeIdx} className="px-1.5 py-0.5 bg-grey-100 text-grey-600 text-xs font-mono rounded">
                                  {code.system}: {code.code}
                                </span>
                              ))}
                              {criterion.clinical_codes.length > 3 && (
                                <span className="text-xs text-grey-400">+{criterion.clinical_codes.length - 3} more</span>
                              )}
                            </div>
                          )}
                        </div>

                        <span className={cn(
                          "px-2 py-0.5 text-xs font-medium rounded flex-shrink-0",
                          status === 'met' && 'bg-grey-900 text-white',
                          status === 'not_met' && isRequired && 'bg-red-100 text-red-700',
                          status === 'not_met' && !isRequired && 'bg-grey-200 text-grey-600',
                          status === 'partial' && 'bg-amber-100 text-amber-700',
                          status === 'unknown' && 'bg-grey-100 text-grey-500'
                        )}>
                          {status === 'met' ? 'Met' : status === 'not_met' ? 'Not Met' : status === 'partial' ? 'Partial' : 'Unknown'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Policy Reference */}
      <div className="pt-4 border-t border-grey-200">
        <p className="text-xs text-grey-400">
          Source: {digitizedPolicy.payer_name} Policy {digitizedPolicy.policy_number} - {digitizedPolicy.policy_title}
        </p>
        {digitizedPolicy.effective_date && (
          <p className="text-xs text-grey-400">Effective: {digitizedPolicy.effective_date}</p>
        )}
      </div>
    </div>
  )
}
