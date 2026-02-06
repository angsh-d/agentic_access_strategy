import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/services/api'
import { QUERY_KEYS } from '@/lib/constants'
import type { AnalyzePolicyRequest } from '@/types/api'

/**
 * Hook to analyze policy coverage for a case
 */
export function useAnalyzePolicy() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: AnalyzePolicyRequest) => api.policies.analyze(data),
    onSuccess: (data, variables) => {
      // Cache the assessment result
      queryClient.setQueryData(
        [...QUERY_KEYS.policies, variables.case_id],
        data
      )
    },
  })
}

export default useAnalyzePolicy
