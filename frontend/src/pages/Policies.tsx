/**
 * Policies Page - Comprehensive policy library
 *
 * Features:
 * - Payer selector (left sidebar)
 * - Policy list (filterable)
 * - Policy detail view with criteria accordion
 * - Search and filter functionality
 */

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Search,
  Filter,
  Building2,
  Pill,
  FileText,
  AlertCircle,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { Badge } from '@/components/ui/Badge'
import { PolicyCard, PolicyCardSkeleton } from '@/components/domain/PolicyCard'
import { DigitizedPolicyViewer } from '@/components/domain/DigitizedPolicyViewer'
import { cn } from '@/lib/utils'
import { ENDPOINTS, QUERY_KEYS, CACHE_TIMES } from '@/lib/constants'
import { fadeInUp, staggerContainer, listItem } from '@/lib/animations'

// Types for policy data
interface PolicyListItem {
  file: string
  payer: string
  medication: string
}

// Fetch available policies using central API client
async function fetchPolicies(): Promise<{ policies: PolicyListItem[] }> {
  const { request } = await import('@/services/api')
  return request<{ policies: PolicyListItem[] }>(ENDPOINTS.availablePolicies)
}

export function Policies() {
  const [selectedPayer, setSelectedPayer] = useState<string | null>(null)
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyListItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showStepTherapyOnly, setShowStepTherapyOnly] = useState(false)

  // Fetch all available policies - static data, cached indefinitely
  const { data: policiesData, isLoading: policiesLoading, refetch } = useQuery({
    queryKey: QUERY_KEYS.policies,
    queryFn: fetchPolicies,
    staleTime: CACHE_TIMES.STATIC,
    gcTime: CACHE_TIMES.GC_TIME,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const policies = policiesData?.policies ?? []

  // Get unique payers
  const payers = useMemo(() => {
    const payerSet = new Set(policies.map((p) => p.payer))
    return Array.from(payerSet).sort()
  }, [policies])

  // Fetch digitized policy for step therapy info when needed
  const { data: digitizedPolicies } = useQuery({
    queryKey: ['policies-digitized-all'],
    queryFn: async () => {
      // Fetch digitized data for all policies to get step therapy info
      const { request } = await import('@/services/api')
      const results: Record<string, boolean> = {}
      for (const policy of policies) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data = await request<any>(
            ENDPOINTS.policyDigitized(policy.payer.toLowerCase(), policy.medication.toLowerCase())
          )
          results[`${policy.payer}-${policy.medication}`] = data?.step_therapy?.required ?? false
        } catch {
          // Skip on error
        }
      }
      return results
    },
    enabled: policies.length > 0 && showStepTherapyOnly,
    staleTime: CACHE_TIMES.STATIC, // Indefinite - step therapy info is static
    gcTime: CACHE_TIMES.GC_TIME,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  // Filter policies
  const filteredPolicies = useMemo(() => {
    let filtered = policies

    // Filter by payer
    if (selectedPayer) {
      filtered = filtered.filter((p) => p.payer === selectedPayer)
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.medication.toLowerCase().includes(query) ||
          p.payer.toLowerCase().includes(query)
      )
    }

    // Filter by step therapy requirement
    if (showStepTherapyOnly && digitizedPolicies) {
      filtered = filtered.filter((p) => {
        const key = `${p.payer}-${p.medication}`
        return digitizedPolicies[key] === true
      })
    }

    return filtered
  }, [policies, selectedPayer, searchQuery, showStepTherapyOnly, digitizedPolicies])

  // Count policies per payer
  const policyCountByPayer = useMemo(() => {
    const counts: Record<string, number> = {}
    policies.forEach((p) => {
      counts[p.payer] = (counts[p.payer] || 0) + 1
    })
    return counts
  }, [policies])

  return (
    <div className="min-h-screen">
      <Header
        title="PA Policy Library"
        subtitle="Digitized prior authorization policies for all payers"
        actions={[
          {
            label: 'Refresh',
            onClick: () => refetch(),
            variant: 'secondary',
            icon: <RefreshCw className="w-4 h-4" />,
          },
        ]}
      />

      <div className="p-8">
        <div className="flex gap-6">
          {/* Left Sidebar - Payer Selection */}
          <div className="w-64 flex-shrink-0">
            <GlassPanel variant="default" padding="md" className="sticky top-8">
              <h3 className="text-sm font-semibold text-grey-900 mb-4 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-grey-500" />
                Payers
              </h3>

              {/* All Payers Option */}
              <button
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg mb-2 transition-colors',
                  'flex items-center justify-between',
                  !selectedPayer
                    ? 'bg-grey-900 text-white'
                    : 'hover:bg-grey-100 text-grey-700'
                )}
                onClick={() => setSelectedPayer(null)}
              >
                <span className="text-sm font-medium">All Payers</span>
                <Badge variant={!selectedPayer ? 'neutral' : 'neutral'} size="sm">
                  {policies.length}
                </Badge>
              </button>

              {/* Individual Payers */}
              <div className="space-y-1">
                {payers.map((payer) => (
                  <button
                    key={payer}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg transition-colors',
                      'flex items-center justify-between',
                      selectedPayer === payer
                        ? 'bg-grey-900 text-white'
                        : 'hover:bg-grey-100 text-grey-700'
                    )}
                    onClick={() => setSelectedPayer(payer)}
                  >
                    <span className="text-sm font-medium">{payer}</span>
                    <Badge
                      variant={selectedPayer === payer ? 'neutral' : 'neutral'}
                      size="sm"
                    >
                      {policyCountByPayer[payer] || 0}
                    </Badge>
                  </button>
                ))}
              </div>

              {/* Filters */}
              <div className="mt-6 pt-4 border-t border-grey-200">
                <h4 className="text-xs font-semibold text-grey-500 uppercase mb-3 flex items-center gap-2">
                  <Filter className="w-3 h-3" />
                  Filters
                </h4>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showStepTherapyOnly}
                    onChange={(e) => setShowStepTherapyOnly(e.target.checked)}
                    className="w-4 h-4 rounded border-grey-300 text-grey-900 focus:ring-grey-500"
                  />
                  <span className="text-sm text-grey-700">Step therapy required</span>
                </label>
              </div>

              {/* Search */}
              <div className="mt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-grey-400" />
                  <input
                    type="text"
                    placeholder="Search policies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-grey-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-grey-900/20"
                  />
                </div>
              </div>
            </GlassPanel>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Policy Grid or Detail View */}
            {selectedPolicy ? (
              <PolicyDetailView
                policy={selectedPolicy}
                onBack={() => setSelectedPolicy(null)}
              />
            ) : (
              <PolicyListView
                policies={filteredPolicies}
                isLoading={policiesLoading}
                onSelect={setSelectedPolicy}
                searchQuery={searchQuery}
                digitizedPolicies={digitizedPolicies}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Policy List View - Grid of policy cards
 */
function PolicyListView({
  policies,
  isLoading,
  onSelect,
  searchQuery,
  digitizedPolicies,
}: {
  policies: PolicyListItem[]
  isLoading: boolean
  onSelect: (policy: PolicyListItem) => void
  searchQuery: string
  digitizedPolicies?: Record<string, boolean>
}) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <PolicyCardSkeleton key={i} />
        ))}
      </div>
    )
  }

  if (policies.length === 0) {
    return (
      <GlassPanel variant="light" padding="lg" className="text-center">
        <FileText className="w-12 h-12 text-grey-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-grey-900 mb-2">
          No policies found
        </h3>
        <p className="text-sm text-grey-500">
          {searchQuery
            ? `No policies match "${searchQuery}"`
            : 'No policies available for the selected filters'}
        </p>
      </GlassPanel>
    )
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      {policies.map((policy) => (
        <motion.div key={`${policy.payer}-${policy.medication}`} variants={listItem}>
          <PolicyCard
            policyId={policy.file.replace('.txt', '')}
            payer={policy.payer}
            medication={policy.medication}
            stepTherapyRequired={digitizedPolicies?.[`${policy.payer}-${policy.medication}`] ?? undefined}
            onClick={() => onSelect(policy)}
          />
        </motion.div>
      ))}
    </motion.div>
  )
}

/**
 * Policy Detail View - Full policy with digitized criteria
 */
function PolicyDetailView({
  policy,
  onBack,
}: {
  policy: PolicyListItem
  onBack: () => void
}) {
  // Fetch digitized policy data
  const { data: digitizedPolicy, isLoading: digitizedLoading, error } = useQuery({
    queryKey: QUERY_KEYS.policyDigitized(policy.payer.toLowerCase(), policy.medication.toLowerCase().replace(/\s+/g, '')),
    queryFn: async () => {
      const { request } = await import('@/services/api')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await request<any>(
        ENDPOINTS.policyDigitized(policy.payer.toLowerCase(), policy.medication.toLowerCase().replace(/\s+/g, ''))
      )
    },
    staleTime: CACHE_TIMES.STATIC,
    gcTime: CACHE_TIMES.GC_TIME,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  // Check if we have comprehensive digitized data
  const hasComprehensiveData = digitizedPolicy?.atomic_criteria &&
    Object.keys(digitizedPolicy.atomic_criteria).length > 0

  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      className="space-y-6"
    >
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-grey-600 hover:text-grey-900 transition-colors"
      >
        <ChevronRight className="w-4 h-4 rotate-180" />
        Back to all policies
      </button>

      {/* Loading state */}
      {digitizedLoading && (
        <div className="space-y-6">
          <div className="h-40 bg-grey-100 rounded-xl animate-pulse" />
          <div className="h-12 bg-grey-100 rounded-lg animate-pulse" />
          <div className="h-64 bg-grey-100 rounded-xl animate-pulse" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <GlassPanel variant="default" padding="lg">
          <div className="text-center py-8">
            <AlertCircle className="w-12 h-12 text-grey-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-grey-900 mb-2">
              Unable to load policy details
            </h3>
            <p className="text-sm text-grey-500">
              {error instanceof Error ? error.message : 'An error occurred'}
            </p>
          </div>
        </GlassPanel>
      )}

      {/* Comprehensive digitized view */}
      {!digitizedLoading && !error && hasComprehensiveData && (
        <DigitizedPolicyViewer policy={digitizedPolicy} />
      )}

      {/* Fallback: Basic policy view for non-digitized policies */}
      {!digitizedLoading && !error && !hasComprehensiveData && (
        <BasicPolicyView policy={policy} digitizedData={digitizedPolicy} />
      )}
    </motion.div>
  )
}

/**
 * Basic Policy View - Fallback for policies without full digitization
 */
function BasicPolicyView({
  policy,
  digitizedData,
}: {
  policy: PolicyListItem
  digitizedData: any
}) {
  return (
    <>
      {/* Policy Header */}
      <GlassPanel variant="default" padding="lg">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-grey-100 flex items-center justify-center">
              <Pill className="w-7 h-7 text-grey-600" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-grey-900">
                {policy.medication}
              </h2>
              <p className="text-grey-500 mt-1">{policy.payer}</p>
              <div className="flex items-center gap-3 mt-3">
                <span className="px-2 py-1 bg-grey-200 text-grey-700 text-xs rounded">
                  Prior Auth Required
                </span>
                {digitizedData?.step_therapy_requirements?.length > 0 && (
                  <span className="px-2 py-1 bg-grey-100 text-grey-600 text-xs rounded">
                    Step Therapy
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-grey-500">Policy ID</p>
            <p className="text-sm font-mono text-grey-700">
              {digitizedData?.policy_id || policy.file.replace('.txt', '').toUpperCase()}
            </p>
          </div>
        </div>
      </GlassPanel>

      {/* Indications */}
      {digitizedData?.indications?.length > 0 && (
        <GlassPanel variant="default" padding="lg">
          <h3 className="text-lg font-semibold text-grey-900 mb-4">
            Covered Indications ({digitizedData.indications.length})
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {digitizedData.indications.map((ind: any, idx: number) => (
              <div key={idx} className="p-4 rounded-lg border border-grey-200 bg-grey-50">
                <h4 className="font-medium text-grey-900">{ind.indication_name}</h4>
                {ind.min_age_years && (
                  <p className="text-xs text-grey-500 mt-1">Age {'>='} {ind.min_age_years} years</p>
                )}
                <p className="text-xs text-grey-400 mt-2">
                  Initial: {ind.initial_approval_duration_months} months
                </p>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Step Therapy */}
      {digitizedData?.step_therapy_requirements?.length > 0 && (
        <GlassPanel variant="default" padding="lg">
          <h3 className="text-lg font-semibold text-grey-900 mb-4">
            Step Therapy Requirements
          </h3>
          <div className="space-y-3">
            {digitizedData.step_therapy_requirements.map((req: any, idx: number) => (
              <div key={idx} className="p-4 rounded-lg border border-grey-200">
                <p className="text-sm font-medium text-grey-800">{req.indication}</p>
                {req.required_drug_classes?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {req.required_drug_classes.map((cls: string, clsIdx: number) => (
                      <span key={clsIdx} className="px-2 py-0.5 bg-grey-100 text-grey-600 text-xs rounded">
                        {cls}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {/* Not digitized message */}
      {!digitizedData?.indications?.length && (
        <GlassPanel variant="light" padding="lg">
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-grey-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-grey-900 mb-2">
              Policy Not Yet Fully Digitized
            </h3>
            <p className="text-sm text-grey-500">
              This policy has not been processed through the AI digitization pipeline yet.
              Run the policy digitizer to extract comprehensive criteria.
            </p>
          </div>
        </GlassPanel>
      )}
    </>
  )
}

export default Policies
