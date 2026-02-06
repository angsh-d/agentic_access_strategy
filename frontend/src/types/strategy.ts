/**
 * Strategy type
 * Must match backend StrategyType enum
 *
 * IMPORTANT: Only sequential_primary_first is valid for PA submissions.
 * - Never submit in parallel (causes COB coordination issues)
 * - Never submit to secondary before primary (violates insurance rules)
 *
 * Legacy types kept for backwards compatibility with existing data.
 */
export type StrategyType =
  | 'sequential_primary_first'  // The only valid approach
  // Legacy types (for backwards compatibility)
  | 'sequential_cigna_first'
  | 'sequential_uhc_first'
  | 'parallel'
  | 'optimized'

/**
 * Individual criterion in scoring
 */
export interface ScoringCriterion {
  name: string
  score: number
  weight: number
  weighted_score: number
  rationale: string
}

/**
 * Scoring weights configuration
 */
export interface ScoringWeights {
  approval_probability: number
  time_to_therapy: number
  rework_risk: number
  cost_efficiency: number
}

/**
 * Strategy score breakdown
 */
export interface StrategyScore {
  total_score: number
  approval_probability: number
  days_to_therapy: number
  rework_risk: number
  cost_efficiency: number
  criteria: ScoringCriterion[]
}

/**
 * Strategy action step
 */
export interface StrategyAction {
  id: string
  name: string
  description: string
  order: number
  estimated_duration: string
  dependencies: string[]
  parallel_group?: number
}

/**
 * Full strategy definition
 */
export interface Strategy {
  id: string
  type: StrategyType
  name: string
  description: string
  is_recommended: boolean
  score: StrategyScore
  actions: StrategyAction[]
  estimated_days: number
  confidence_range: {
    low: number
    high: number
  }
  risks: string[]
  advantages: string[]
}

/**
 * Strategy selection request
 */
export interface SelectStrategyInput {
  strategy_id: string
  rationale?: string
}

/**
 * Strategy comparison for display
 */
export interface StrategyComparison {
  strategies: Strategy[]
  recommended_id: string
  comparison_factors: {
    factor: string
    sequential: string
    parallel: string
    optimized: string
  }[]
}
