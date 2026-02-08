/**
 * Policies Page - Policy Bank with version management, diff viewer,
 * impact analysis, and policy assistant.
 * Apple HIG: greyscale-first, glass panels, tracking-tight headings,
 * Apple spring card animations, premium controls.
 */

import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Filter,
  Building2,
  Pill,
  FileText,
  AlertCircle,
  ChevronRight,
  RefreshCw,
  GitCompareArrows,
  History,
  Sparkles,
  Upload,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { Badge } from '@/components/ui/Badge'
import { PolicyCardSkeleton } from '@/components/domain/PolicyCard'
import { DigitizedPolicyViewer } from '@/components/domain/DigitizedPolicyViewer'
import { PolicyNotificationBanner } from '@/components/domain/PolicyNotificationBanner'
import { PolicyDiffViewer } from '@/components/domain/PolicyDiffViewer'
import { PolicyImpactReport } from '@/components/domain/PolicyImpactReport'
import { PolicyAssistant } from '@/components/domain/PolicyAssistant'
import { useNotifications } from '@/hooks/useNotifications'
import { cn } from '@/lib/utils'
import { ENDPOINTS, QUERY_KEYS, CACHE_TIMES } from '@/lib/constants'
import { fadeInUp, staggerContainer, listItem, appleEase } from '@/lib/animations'
import type { PolicyUpdateNotification } from '@/types/api'

// Types
interface PolicyListItem {
  file: string
  payer: string
  medication: string
}

interface PolicyBankItem {
  payer: string
  medication: string
  latest_version: string
  version_count: number
  last_updated: string | null
  extraction_quality: string
}

interface PolicyVersion {
  version: string
  cached_at: string
  content_hash: string
  id?: string
  source_filename?: string | null
  upload_notes?: string | null
  amendment_date?: string | null
  parent_version_id?: string | null
}

type ViewMode = 'list' | 'detail' | 'diff' | 'impact'

// Fetch functions
async function fetchPolicyBank(): Promise<{ policies: PolicyBankItem[] }> {
  const { request } = await import('@/services/api')
  return request<{ policies: PolicyBankItem[] }>(ENDPOINTS.policyBank)
}

async function fetchVersions(payer: string, medication: string): Promise<{ versions: PolicyVersion[] }> {
  const { request } = await import('@/services/api')
  return request<{ versions: PolicyVersion[] }>(ENDPOINTS.policyVersions(payer, medication))
}

export function Policies() {
  const [selectedPayer, setSelectedPayer] = useState<string | null>(null)
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyListItem | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showStepTherapyOnly, setShowStepTherapyOnly] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [diffVersions, setDiffVersions] = useState<{ oldVersion: string; newVersion: string } | null>(null)
  const [showAssistant, setShowAssistant] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [notification, setNotification] = useState<PolicyUpdateNotification | null>(null)

  useNotifications({
    onPolicyUpdate: useCallback((n: PolicyUpdateNotification) => {
      setNotification(n)
    }, []),
  })

  const { data: bankData, isLoading: policiesLoading, refetch } = useQuery({
    queryKey: QUERY_KEYS.policyBank,
    queryFn: fetchPolicyBank,
    staleTime: 30_000,
    gcTime: CACHE_TIMES.GC_TIME,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  })

  const bankPolicies = bankData?.policies ?? []

  // Policy list derived entirely from policy_cache table via /policies/bank
  const policies: PolicyListItem[] = useMemo(() =>
    bankPolicies.map((b) => ({
      file: '',
      payer: b.payer.charAt(0).toUpperCase() + b.payer.slice(1),
      medication: b.medication.charAt(0).toUpperCase() + b.medication.slice(1),
    })),
    [bankPolicies]
  )

  const getBankMeta = useCallback(
    (payer: string, medication: string): PolicyBankItem | undefined =>
      bankPolicies.find(
        (b) =>
          b.payer === payer.toLowerCase() &&
          b.medication === medication.toLowerCase().replace(/\s+/g, '')
      ),
    [bankPolicies]
  )

  const payers = useMemo(() => {
    const payerSet = new Set(policies.map((p) => p.payer))
    return Array.from(payerSet).sort()
  }, [policies])

  const filteredPolicies = useMemo(() => {
    let filtered = policies
    if (selectedPayer) {
      filtered = filtered.filter((p) => p.payer === selectedPayer)
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (p) =>
          p.medication.toLowerCase().includes(query) ||
          p.payer.toLowerCase().includes(query)
      )
    }
    return filtered
  }, [policies, selectedPayer, searchQuery])

  const policyCountByPayer = useMemo(() => {
    const counts: Record<string, number> = {}
    policies.forEach((p) => {
      counts[p.payer] = (counts[p.payer] || 0) + 1
    })
    return counts
  }, [policies])

  const handleViewChanges = useCallback(
    (payer: string, medication: string, version: string) => {
      const policy = policies.find(
        (p) => p.payer.toLowerCase() === payer && p.medication.toLowerCase().replace(/\s+/g, '') === medication
      )
      if (policy) {
        setSelectedPolicy(policy)
        const vNum = parseInt(version.replace('v', ''), 10)
        if (vNum > 1) {
          setDiffVersions({ oldVersion: `v${vNum - 1}`, newVersion: version })
          setViewMode('diff')
        }
      }
      setNotification(null)
    },
    [policies]
  )

  const handleSelectPolicy = useCallback((policy: PolicyListItem) => {
    setSelectedPolicy(policy)
    setViewMode('detail')
    setDiffVersions(null)
  }, [])

  const handleBack = useCallback(() => {
    setSelectedPolicy(null)
    setViewMode('list')
    setDiffVersions(null)
  }, [])

  const handleOpenDiff = useCallback((oldVersion: string, newVersion: string) => {
    setDiffVersions({ oldVersion, newVersion })
    setViewMode('diff')
  }, [])

  const handleOpenImpact = useCallback(() => {
    setViewMode('impact')
  }, [])

  return (
    <div className="min-h-screen">
      <Header
        title="PA Policy Library"
        subtitle="Digitized prior authorization policies with version tracking"
        actions={[
          {
            label: 'Upload Policy',
            onClick: () => setShowUpload(!showUpload),
            variant: showUpload ? 'primary' : 'secondary',
            icon: <Upload className="w-4 h-4" />,
          },
          {
            label: 'Policy Assistant',
            onClick: () => setShowAssistant(!showAssistant),
            variant: showAssistant ? 'primary' : 'secondary',
            icon: <Sparkles className="w-4 h-4" />,
          },
          {
            label: 'Refresh',
            onClick: () => refetch(),
            variant: 'secondary',
            icon: <RefreshCw className="w-4 h-4" />,
          },
        ]}
      />

      <div className="p-8">
        {/* Notification Banner */}
        <div className="mb-4">
          <PolicyNotificationBanner
            notification={notification}
            onViewChanges={handleViewChanges}
            onDismiss={() => setNotification(null)}
          />
        </div>

        {/* Upload Zone */}
        <AnimatePresence>
          {showUpload && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={appleEase}
              className="overflow-hidden"
            >
              <PolicyUploadZone
                onClose={() => setShowUpload(false)}
                onSuccess={() => refetch()}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-6">
          {/* Left Sidebar */}
          <div className="w-64 flex-shrink-0">
            <GlassPanel variant="default" padding="md" className="sticky top-8">
              <h3 className="text-[12px] font-medium text-grey-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5" />
                Payers
              </h3>

              <button
                className={cn(
                  'w-full text-left px-3 py-2 rounded-xl mb-2 transition-all',
                  'flex items-center justify-between',
                  !selectedPayer
                    ? 'bg-grey-900 text-white'
                    : 'hover:bg-grey-50 text-grey-700'
                )}
                onClick={() => setSelectedPayer(null)}
              >
                <span className="text-[13px] font-medium">All Payers</span>
                <Badge variant={!selectedPayer ? 'neutral' : 'neutral'} size="sm">{policies.length}</Badge>
              </button>

              <div className="space-y-0.5">
                {payers.map((payer) => (
                  <button
                    key={payer}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-xl transition-all',
                      'flex items-center justify-between',
                      selectedPayer === payer
                        ? 'bg-grey-900 text-white'
                        : 'hover:bg-grey-50 text-grey-700'
                    )}
                    onClick={() => setSelectedPayer(payer)}
                  >
                    <span className="text-[13px] font-medium">{payer}</span>
                    <Badge variant="neutral" size="sm">
                      {policyCountByPayer[payer] || 0}
                    </Badge>
                  </button>
                ))}
              </div>

              {/* Filters */}
              <div className="mt-6 pt-4 border-t border-grey-100">
                <h4 className="text-[10px] font-medium text-grey-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Filter className="w-3 h-3" />
                  Filters
                </h4>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showStepTherapyOnly}
                    onChange={(e) => setShowStepTherapyOnly(e.target.checked)}
                    className="w-4 h-4 rounded border-grey-300 text-grey-900 focus:ring-grey-500"
                  />
                  <span className="text-[12px] text-grey-600">Step therapy required</span>
                </label>
              </div>

              {/* Search */}
              <div className="mt-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-grey-300" />
                  <input
                    type="text"
                    placeholder="Search policies..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-[12px] bg-grey-50 border border-grey-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-grey-900/10 focus:border-grey-300 transition-all placeholder:text-grey-300"
                  />
                </div>
              </div>
            </GlassPanel>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              {viewMode === 'list' && (
                <motion.div
                  key="list"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={appleEase}
                >
                  <PolicyListView
                    policies={filteredPolicies}
                    isLoading={policiesLoading}
                    onSelect={handleSelectPolicy}
                    searchQuery={searchQuery}
                    getBankMeta={getBankMeta}
                  />
                </motion.div>
              )}
              {viewMode === 'detail' && selectedPolicy && (
                <motion.div
                  key="detail"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={appleEase}
                >
                  <PolicyDetailView
                    policy={selectedPolicy}
                    onBack={handleBack}
                    onOpenDiff={handleOpenDiff}
                    bankMeta={getBankMeta(selectedPolicy.payer, selectedPolicy.medication)}
                  />
                </motion.div>
              )}
              {viewMode === 'diff' && selectedPolicy && diffVersions && (
                <motion.div
                  key="diff"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={appleEase}
                  className="space-y-4"
                >
                  <button
                    onClick={() => setViewMode('detail')}
                    className="flex items-center gap-1.5 text-[12px] text-grey-400 hover:text-grey-700 transition-colors font-medium"
                  >
                    <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                    Back to policy detail
                  </button>
                  <PolicyDiffViewer
                    payer={selectedPolicy.payer.toLowerCase()}
                    medication={selectedPolicy.medication.toLowerCase().replace(/\s+/g, '')}
                    oldVersion={diffVersions.oldVersion}
                    newVersion={diffVersions.newVersion}
                    onAssessImpact={handleOpenImpact}
                  />
                </motion.div>
              )}
              {viewMode === 'impact' && selectedPolicy && diffVersions && (
                <motion.div
                  key="impact"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={appleEase}
                  className="space-y-4"
                >
                  <button
                    onClick={() => setViewMode('diff')}
                    className="flex items-center gap-1.5 text-[12px] text-grey-400 hover:text-grey-700 transition-colors font-medium"
                  >
                    <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                    Back to diff view
                  </button>
                  <PolicyImpactReport
                    payer={selectedPolicy.payer.toLowerCase()}
                    medication={selectedPolicy.medication.toLowerCase().replace(/\s+/g, '')}
                    oldVersion={diffVersions.oldVersion}
                    newVersion={diffVersions.newVersion}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Policy Assistant Slide-out */}
          <AnimatePresence>
            {showAssistant && (
              <motion.div
                key="assistant"
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 480 }}
                exit={{ opacity: 0, width: 0 }}
                transition={appleEase}
                className="flex-shrink-0 overflow-hidden"
              >
                <PolicyAssistant onClose={() => setShowAssistant(false)} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

/**
 * Policy Upload Zone — drag-and-drop upload with form fields
 */
function PolicyUploadZone({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [payerInput, setPayerInput] = useState('')
  const [medicationInput, setMedicationInput] = useState('')
  const [notes, setNotes] = useState('')
  const [amendmentDate, setAmendmentDate] = useState('')
  const [uploading, setUploading] = useState(false)
  const [inferring, setInferring] = useState(false)
  const [result, setResult] = useState<{ version: string; extraction_quality: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Infer metadata from file content via backend LLM call
  const inferMetadata = useCallback(async (selectedFile: File) => {
    setInferring(true)
    setError(null)
    try {
      const { policiesApi } = await import('@/services/api')
      const meta = await policiesApi.inferMetadata(selectedFile)
      if (meta.payer_name) setPayerInput(meta.payer_name)
      if (meta.medication_name) setMedicationInput(meta.medication_name)
      if (meta.effective_date) setAmendmentDate(meta.effective_date)
      if (!meta.payer_name && !meta.medication_name) {
        setError('Could not auto-detect payer/medication. Please enter manually.')
      }
    } catch {
      setError('Metadata detection failed. Please enter payer and medication manually.')
    } finally {
      setInferring(false)
    }
  }, [])

  const acceptFile = useCallback((f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase()
    if (ext === 'pdf' || ext === 'txt') {
      setFile(f)
      setError(null)
      // Reset fields before inference
      setPayerInput('')
      setMedicationInput('')
      setAmendmentDate('')
      inferMetadata(f)
    } else {
      setError('Only .pdf and .txt files are supported.')
    }
  }, [inferMetadata])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) acceptFile(dropped)
  }, [acceptFile])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) acceptFile(selected)
  }, [acceptFile])

  const handleSubmit = useCallback(async () => {
    if (!file || !payerInput || !medicationInput) return
    setUploading(true)
    setError(null)
    try {
      const { policiesApi } = await import('@/services/api')
      const formData = new FormData()
      formData.append('file', file)
      formData.append('payer_name', payerInput.toLowerCase().replace(/\s+/g, '_'))
      formData.append('medication_name', medicationInput.toLowerCase().replace(/\s+/g, '_'))
      if (notes) formData.append('amendment_notes', notes)
      if (amendmentDate) formData.append('amendment_date', amendmentDate)
      const res = await policiesApi.upload(formData)
      if (res.status === 'unchanged') {
        setError(res.message || 'File is identical to the latest version — pipeline skipped.')
      } else {
        setResult({ version: res.version, extraction_quality: res.extraction_quality })
        onSuccess()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }, [file, payerInput, medicationInput, notes, amendmentDate, onSuccess])

  return (
    <GlassPanel variant="default" padding="lg" className="mb-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[14px] font-semibold text-grey-900 tracking-tight flex items-center gap-2">
          <Upload className="w-4 h-4 text-grey-500" />
          Upload Policy Document
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-grey-100 rounded-lg transition-colors">
          <X className="w-4 h-4 text-grey-400" />
        </button>
      </div>

      {result ? (
        <div className="flex items-center gap-3 py-4">
          <CheckCircle2 className="w-5 h-5 text-semantic-success" />
          <div>
            <p className="text-[13px] font-medium text-grey-900">
              Stored as {result.version} — extraction quality: {result.extraction_quality}
            </p>
            <button onClick={onClose} className="text-[11px] text-grey-400 hover:text-grey-700 mt-1">
              Dismiss
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              'border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer mb-4',
              dragOver ? 'border-grey-400 bg-grey-50' : 'border-grey-200 hover:border-grey-300',
              file ? 'bg-grey-50' : ''
            )}
            onClick={() => document.getElementById('policy-file-input')?.click()}
          >
            <input
              id="policy-file-input"
              type="file"
              accept=".pdf,.txt"
              onChange={handleFileSelect}
              className="hidden"
            />
            {file ? (
              <p className="text-[13px] text-grey-700 font-medium">{file.name} ({(file.size / 1024).toFixed(0)} KB)</p>
            ) : (
              <p className="text-[12px] text-grey-400">Drop a .pdf or .txt file here, or click to browse</p>
            )}
          </div>

          {/* Inference indicator */}
          {inferring && (
            <div className="flex items-center gap-2 mb-4 px-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-grey-400" />
              <span className="text-[11px] text-grey-500">Analyzing document to extract payer and medication...</span>
            </div>
          )}

          {/* Form fields — auto-populated from inference, editable for override */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-[10px] font-medium text-grey-400 uppercase tracking-wider mb-1 block">
                Payer {inferring ? '' : payerInput ? '(detected)' : '*'}
              </label>
              <input
                type="text"
                value={payerInput}
                onChange={(e) => setPayerInput(e.target.value)}
                placeholder={inferring ? 'Detecting...' : 'e.g. cigna'}
                disabled={inferring}
                className={cn(
                  'w-full px-3 py-2 text-[12px] border rounded-xl focus:outline-none focus:ring-2 focus:ring-grey-900/10 focus:border-grey-300 transition-all placeholder:text-grey-300',
                  inferring ? 'bg-grey-100 border-grey-100 text-grey-400' : 'bg-grey-50 border-grey-200'
                )}
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-grey-400 uppercase tracking-wider mb-1 block">
                Medication {inferring ? '' : medicationInput ? '(detected)' : '*'}
              </label>
              <input
                type="text"
                value={medicationInput}
                onChange={(e) => setMedicationInput(e.target.value)}
                placeholder={inferring ? 'Detecting...' : 'e.g. infliximab'}
                disabled={inferring}
                className={cn(
                  'w-full px-3 py-2 text-[12px] border rounded-xl focus:outline-none focus:ring-2 focus:ring-grey-900/10 focus:border-grey-300 transition-all placeholder:text-grey-300',
                  inferring ? 'bg-grey-100 border-grey-100 text-grey-400' : 'bg-grey-50 border-grey-200'
                )}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-[10px] font-medium text-grey-400 uppercase tracking-wider mb-1 block">Amendment Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What changed in this version?"
                rows={2}
                className="w-full px-3 py-2 text-[12px] bg-grey-50 border border-grey-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-grey-900/10 focus:border-grey-300 transition-all placeholder:text-grey-300 resize-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-grey-400 uppercase tracking-wider mb-1 block">
                Amendment Date {amendmentDate && !inferring ? '(detected)' : ''}
              </label>
              <input
                type="date"
                value={amendmentDate}
                onChange={(e) => setAmendmentDate(e.target.value)}
                className="w-full px-3 py-2 text-[12px] bg-grey-50 border border-grey-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-grey-900/10 focus:border-grey-300 transition-all"
              />
            </div>
          </div>

          {error && (
            <p className="text-[11px] text-semantic-error mb-3">{error}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={!file || !payerInput || !medicationInput || uploading || inferring}
            className={cn(
              'w-full py-2.5 rounded-xl text-[12px] font-semibold transition-all flex items-center justify-center gap-2',
              !file || !payerInput || !medicationInput || uploading || inferring
                ? 'bg-grey-100 text-grey-300 cursor-not-allowed'
                : 'bg-grey-900 text-white hover:bg-grey-800'
            )}
          >
            {uploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Running 3-pass pipeline (1–3 min)...
              </>
            ) : (
              'Upload & Digitalize'
            )}
          </button>
        </>
      )}
    </GlassPanel>
  )
}

/**
 * Policy List View — grid of policy cards with version badges and Apple hover
 */
function PolicyListView({
  policies,
  isLoading,
  onSelect,
  searchQuery,
  getBankMeta,
}: {
  policies: PolicyListItem[]
  isLoading: boolean
  onSelect: (policy: PolicyListItem) => void
  searchQuery: string
  getBankMeta: (payer: string, medication: string) => PolicyBankItem | undefined
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
      <GlassPanel variant="default" padding="lg" className="text-center">
        <div className="py-8">
          <div className="w-12 h-12 rounded-2xl bg-grey-100 flex items-center justify-center mx-auto mb-4">
            <FileText className="w-6 h-6 text-grey-300" />
          </div>
          <h3 className="text-[15px] font-semibold text-grey-900 tracking-tight mb-1.5">No policies found</h3>
          <p className="text-[13px] text-grey-400">
            {searchQuery ? `No policies match "${searchQuery}"` : 'No policies available for the selected filters'}
          </p>
        </div>
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
      {policies.map((policy) => {
        const meta = getBankMeta(policy.payer, policy.medication)
        return (
          <motion.div
            key={`${policy.payer}-${policy.medication}`}
            variants={listItem}
            whileHover={{ y: -2, scale: 1.005 }}
            whileTap={{ scale: 0.995 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            <GlassPanel
              variant="interactive"
              padding="md"
              className="cursor-pointer group"
              onClick={() => onSelect(policy)}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-grey-100 flex items-center justify-center group-hover:bg-grey-200/80 transition-colors">
                  <Pill className="w-5 h-5 text-grey-500" />
                </div>
                <div className="flex items-center gap-1.5">
                  {meta && (
                    <Badge variant="info" size="sm">
                      {meta.version_count} version{meta.version_count !== 1 ? 's' : ''}
                    </Badge>
                  )}
                  <ChevronRight className="w-4 h-4 text-grey-300 group-hover:text-grey-500 group-hover:translate-x-0.5 transition-all" />
                </div>
              </div>
              <h3 className="text-[14px] font-semibold text-grey-900 tracking-tight">{policy.medication}</h3>
              <p className="text-[11px] text-grey-400 mt-0.5 font-medium">{policy.payer}</p>
              {meta && (
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-grey-100/80">
                  <Badge variant={meta.extraction_quality === 'high' ? 'success' : 'warning'} size="sm">
                    {meta.extraction_quality}
                  </Badge>
                  <span className="text-[10px] text-grey-300 font-mono">{meta.latest_version}</span>
                </div>
              )}
            </GlassPanel>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

/**
 * Policy Detail View with version history
 */
function PolicyDetailView({
  policy,
  onBack,
  onOpenDiff,
  bankMeta,
}: {
  policy: PolicyListItem
  onBack: () => void
  onOpenDiff: (oldVersion: string, newVersion: string) => void
  bankMeta?: PolicyBankItem
}) {
  const payer = policy.payer.toLowerCase()
  const medication = policy.medication.toLowerCase().replace(/\s+/g, '')

  const [showVersions, setShowVersions] = useState(false)
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set())

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: digitizedPolicy, isLoading: digitizedLoading, error } = useQuery({
    queryKey: QUERY_KEYS.policyDigitized(payer, medication),
    queryFn: async () => {
      const { request } = await import('@/services/api')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return await request<any>(ENDPOINTS.policyDigitized(payer, medication))
    },
    staleTime: CACHE_TIMES.STATIC,
    gcTime: CACHE_TIMES.GC_TIME,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const { data: versionsData } = useQuery({
    queryKey: QUERY_KEYS.policyVersions(payer, medication),
    queryFn: () => fetchVersions(payer, medication),
    staleTime: 0,
    refetchOnMount: 'always' as const,
    enabled: showVersions || (bankMeta?.version_count ?? 0) > 0,
  })

  const versions = versionsData?.versions ?? []
  const hasComprehensiveData =
    digitizedPolicy?.atomic_criteria && Object.keys(digitizedPolicy.atomic_criteria).length > 0

  return (
    <motion.div variants={fadeInUp} initial="initial" animate="animate" className="space-y-5">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[12px] text-grey-400 hover:text-grey-700 transition-colors font-medium"
      >
        <ChevronRight className="w-3.5 h-3.5 rotate-180" />
        Back to all policies
      </button>

      {/* Version Bar */}
      {(bankMeta || versions.length > 0) && (
        <GlassPanel variant="default" padding="md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-grey-100 flex items-center justify-center">
                <History className="w-3.5 h-3.5 text-grey-400" />
              </div>
              <span className="text-[13px] font-medium text-grey-900">
                {bankMeta?.version_count ?? versions.length} version{(bankMeta?.version_count ?? versions.length) !== 1 ? 's' : ''}
              </span>
              {bankMeta && (
                <Badge variant="info" size="sm">Latest: {bankMeta.latest_version}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {versions.length >= 2 && (
                <motion.button
                  onClick={() => onOpenDiff(versions[1].version, versions[0].version)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-3 py-1.5 text-[11px] font-semibold text-grey-700 bg-grey-100 hover:bg-grey-200 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <GitCompareArrows className="w-3 h-3" />
                  Compare Latest
                </motion.button>
              )}
              <button
                onClick={() => setShowVersions(!showVersions)}
                className="px-3 py-1.5 text-[11px] font-medium text-grey-400 hover:text-grey-700 transition-colors"
              >
                {showVersions ? 'Hide' : 'Show'} History
              </button>
            </div>
          </div>

          {/* Version Timeline */}
          <AnimatePresence>
            {showVersions && versions.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={appleEase}
                className="overflow-hidden"
              >
                <div className="mt-4 pt-4 border-t border-grey-100">
                  {/* Compare button */}
                  {selectedForCompare.size === 2 && (
                    <div className="mb-3 flex items-center gap-2">
                      <motion.button
                        onClick={() => {
                          const sorted = Array.from(selectedForCompare).sort()
                          onOpenDiff(sorted[0], sorted[1])
                          setSelectedForCompare(new Set())
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="px-3 py-1.5 text-[11px] font-semibold text-white bg-grey-900 hover:bg-grey-800 rounded-lg transition-colors flex items-center gap-1.5"
                      >
                        <GitCompareArrows className="w-3 h-3" />
                        Compare Selected
                      </motion.button>
                      <button
                        onClick={() => setSelectedForCompare(new Set())}
                        className="text-[10px] text-grey-400 hover:text-grey-700"
                      >
                        Clear
                      </button>
                    </div>
                  )}

                  {/* Timeline */}
                  <div className="relative pl-5">
                    {/* Vertical line */}
                    <div className="absolute left-[7px] top-3 bottom-3 w-px bg-grey-200" />

                    <div className="space-y-1">
                      {versions.map((v, idx) => {
                        const isSelected = selectedForCompare.has(v.version)
                        return (
                          <div
                            key={v.version}
                            className={cn(
                              'relative flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors',
                              idx === 0 ? 'bg-grey-50' : 'hover:bg-grey-50/50',
                              isSelected && 'ring-1 ring-grey-400'
                            )}
                          >
                            {/* Timeline dot */}
                            <div
                              className={cn(
                                'absolute -left-5 top-4 w-[9px] h-[9px] rounded-full border-2 border-white z-10',
                                idx === 0 ? 'bg-grey-900' : 'bg-grey-300'
                              )}
                            />

                            {/* Checkbox for comparison */}
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedForCompare((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(v.version)) {
                                    next.delete(v.version)
                                  } else if (next.size < 2) {
                                    next.add(v.version)
                                  }
                                  return next
                                })
                              }}
                              className="w-3.5 h-3.5 rounded border-grey-300 text-grey-900 focus:ring-grey-500 mt-0.5 flex-shrink-0"
                            />

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant={idx === 0 ? 'info' : 'neutral'} size="sm">
                                  {v.version}
                                </Badge>
                                <span className="text-[11px] text-grey-400">
                                  {v.cached_at ? new Date(v.cached_at).toLocaleDateString() : ''}
                                </span>
                                {v.amendment_date && (
                                  <span className="text-[10px] text-grey-400 italic">
                                    amended {new Date(v.amendment_date).toLocaleDateString()}
                                  </span>
                                )}
                                <span className="text-[10px] font-mono text-grey-300">{v.content_hash?.slice(0, 8)}</span>
                              </div>
                              {(v.source_filename || v.upload_notes) && (
                                <div className="mt-1 flex items-center gap-2 flex-wrap">
                                  {v.source_filename && (
                                    <span className="text-[10px] text-grey-400 bg-grey-100 px-1.5 py-0.5 rounded">
                                      {v.source_filename}
                                    </span>
                                  )}
                                  {v.upload_notes && (
                                    <span className="text-[10px] text-grey-500 italic truncate max-w-[200px]" title={v.upload_notes}>
                                      {v.upload_notes}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassPanel>
      )}

      {/* Loading */}
      {digitizedLoading && (
        <div className="space-y-5">
          <div className="h-40 bg-grey-100 rounded-2xl animate-pulse" />
          <div className="h-12 bg-grey-100 rounded-xl animate-pulse" />
          <div className="h-64 bg-grey-100 rounded-2xl animate-pulse" />
        </div>
      )}

      {/* Error */}
      {error && (
        <GlassPanel variant="default" padding="lg">
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-2xl bg-grey-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-6 h-6 text-grey-300" />
            </div>
            <h3 className="text-[15px] font-semibold text-grey-900 tracking-tight mb-1.5">Unable to load policy details</h3>
            <p className="text-[13px] text-grey-400">
              {error instanceof Error ? error.message : 'An error occurred'}
            </p>
          </div>
        </GlassPanel>
      )}

      {/* Comprehensive digitized view */}
      {!digitizedLoading && !error && hasComprehensiveData && (
        <DigitizedPolicyViewer policy={digitizedPolicy} />
      )}

      {/* Fallback: Basic policy view */}
      {!digitizedLoading && !error && !hasComprehensiveData && (
        <BasicPolicyView policy={policy} digitizedData={digitizedPolicy} />
      )}
    </motion.div>
  )
}

/**
 * Basic Policy View — fallback for policies without full digitization
 */
function BasicPolicyView({
  policy,
  digitizedData,
}: {
  policy: PolicyListItem
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  digitizedData: any
}) {
  return (
    <>
      <GlassPanel variant="default" padding="lg">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-grey-100 flex items-center justify-center">
              <Pill className="w-7 h-7 text-grey-500" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-grey-900 tracking-tight">{policy.medication}</h2>
              <p className="text-[13px] text-grey-400 mt-1 font-medium">{policy.payer}</p>
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="neutral" size="sm">Prior Auth Required</Badge>
                {digitizedData?.step_therapy_requirements?.length > 0 && (
                  <Badge variant="warning" size="sm">Step Therapy</Badge>
                )}
              </div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-medium text-grey-400 uppercase tracking-wider">Policy ID</p>
            <p className="text-[12px] font-mono text-grey-600 mt-0.5">
              {digitizedData?.policy_id || policy.file.replace('.txt', '').toUpperCase()}
            </p>
          </div>
        </div>
      </GlassPanel>

      {digitizedData?.indications?.length > 0 && (
        <GlassPanel variant="default" padding="lg">
          <h3 className="text-[15px] font-semibold text-grey-900 tracking-tight mb-4">
            Covered Indications ({digitizedData.indications.length})
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {digitizedData.indications.map((ind: any, idx: number) => (
              <div key={idx} className="p-4 rounded-xl bg-grey-50">
                <h4 className="text-[13px] font-medium text-grey-900">{ind.indication_name}</h4>
                {ind.min_age_years && (
                  <p className="text-[11px] text-grey-400 mt-1">Age {'>='} {ind.min_age_years} years</p>
                )}
                <p className="text-[11px] text-grey-300 mt-2 font-medium">
                  Initial: {ind.initial_approval_duration_months} months
                </p>
              </div>
            ))}
          </div>
        </GlassPanel>
      )}

      {digitizedData?.step_therapy_requirements?.length > 0 && (
        <GlassPanel variant="default" padding="lg">
          <h3 className="text-[15px] font-semibold text-grey-900 tracking-tight mb-4">
            Step Therapy Requirements
          </h3>
          <div className="space-y-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {digitizedData.step_therapy_requirements.map((req: any, idx: number) => (
              <div key={idx} className="p-4 rounded-xl bg-grey-50">
                <p className="text-[13px] font-medium text-grey-800">{req.indication}</p>
                {req.required_drug_classes?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {req.required_drug_classes.map((cls: string, clsIdx: number) => (
                      <span
                        key={clsIdx}
                        className="px-2 py-0.5 bg-grey-100 text-grey-500 text-[10px] rounded-md font-medium"
                      >
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

      {!digitizedData?.indications?.length && (
        <GlassPanel variant="default" padding="lg">
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-2xl bg-grey-100 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-6 h-6 text-grey-300" />
            </div>
            <h3 className="text-[15px] font-semibold text-grey-900 tracking-tight mb-1.5">
              Policy Not Yet Fully Digitized
            </h3>
            <p className="text-[13px] text-grey-400">
              Run the policy digitizer to extract comprehensive criteria.
            </p>
          </div>
        </GlassPanel>
      )}
    </>
  )
}

export default Policies
