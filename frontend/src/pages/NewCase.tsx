import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Pill, ArrowRight, Check } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, Button, GlassPanel } from '@/components/ui'
import { useCreateCase } from '@/hooks/useCases'
import { cn, getInitials } from '@/lib/utils'

// Demo scenarios available - patient_id must match backend data files
const scenarios = [
  {
    id: 'maria_r',
    patient: {
      id: 'maria_r',
      name: 'Maria Rodriguez',
      age: 36,
      condition: "Crohn's Disease with Perianal Fistula",
    },
    medication: {
      name: 'Infliximab (Remicade)',
      indication: 'Moderate-to-severe Crohn\'s disease',
    },
    payer: 'Cigna / UHC',
    complexity: 'Complex PA with dual payer coordination',
  },
  {
    id: 'david_c',
    patient: {
      id: 'david_c',
      name: 'David Chen',
      age: 48,
      condition: 'Rheumatoid Arthritis',
    },
    medication: {
      name: 'Infliximab (Remicade)',
      indication: 'RA with inadequate DMARD response',
    },
    payer: 'Cigna / UHC',
    complexity: 'Complex PA with clinical criteria',
  },
]

export function NewCase() {
  const navigate = useNavigate()
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null)
  const createCase = useCreateCase()

  const handleCreateCase = async () => {
    if (!selectedScenario) return

    try {
      const result = await createCase.mutateAsync({
        patient_id: selectedScenario,
      })
      navigate(`/cases/${result.case_id}`)
    } catch (error) {
      console.error('Failed to create case:', error)
    }
  }

  return (
    <div className="min-h-screen">
      <Header
        title="Start New Case"
        subtitle="Select a patient scenario to begin"
        showBack
        backTo="/"
      />

      <div className="p-8 max-w-4xl mx-auto">
        {/* Intro */}
        <GlassPanel variant="light" padding="md" className="mb-8">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-grey-900 flex items-center justify-center flex-shrink-0">
              <Pill className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-grey-900 mb-1">
                Prior Authorization Request
              </h2>
              <p className="text-sm text-grey-600">
                Select a demo scenario below. The agentic system will analyze the
                patient's eligibility, assess payer policies, and recommend the
                optimal strategy for approval.
              </p>
            </div>
          </div>
        </GlassPanel>

        {/* Scenario Cards */}
        <div className="space-y-4 mb-8">
          <h3 className="text-sm font-medium text-grey-500 uppercase tracking-wider">
            Available Scenarios
          </h3>

          {scenarios.map((scenario, index) => (
            <motion.div
              key={scenario.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: index * 0.1,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <ScenarioCard
                scenario={scenario}
                isSelected={selectedScenario === scenario.id}
                onSelect={() => setSelectedScenario(scenario.id)}
              />
            </motion.div>
          ))}
        </div>

        {/* Action */}
        <motion.div
          className="flex justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Button
            variant="primary"
            size="lg"
            disabled={!selectedScenario}
            isLoading={createCase.isPending}
            onClick={handleCreateCase}
            rightIcon={<ArrowRight className="w-4 h-4" />}
          >
            Start Case
          </Button>
        </motion.div>
      </div>
    </div>
  )
}

interface ScenarioCardProps {
  scenario: (typeof scenarios)[0]
  isSelected: boolean
  onSelect: () => void
}

function ScenarioCard({ scenario, isSelected, onSelect }: ScenarioCardProps) {
  return (
    <Card
      variant={isSelected ? 'elevated' : 'default'}
      padding="none"
      className={cn(
        'cursor-pointer transition-all duration-normal',
        isSelected && 'ring-2 ring-grey-900'
      )}
      onClick={onSelect}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            {/* Patient avatar */}
            <div className="w-14 h-14 rounded-2xl bg-grey-200 flex items-center justify-center">
              <span className="text-lg font-semibold text-grey-600">
                {getInitials(scenario.patient.name)}
              </span>
            </div>

            {/* Patient & medication info */}
            <div>
              <h3 className="font-semibold text-grey-900 mb-1">
                {scenario.patient.name}
              </h3>
              <p className="text-sm text-grey-500 mb-2">
                {scenario.patient.age} years old &bull; {scenario.patient.condition}
              </p>

              <div className="flex items-center gap-2 mb-2">
                <Pill className="w-4 h-4 text-grey-400" />
                <span className="text-sm font-medium text-grey-700">
                  {scenario.medication.name}
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs text-grey-500">
                <span>Payer: {scenario.payer}</span>
                <span>&bull;</span>
                <span>{scenario.complexity}</span>
              </div>
            </div>
          </div>

          {/* Selection indicator */}
          <div
            className={cn(
              'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
              isSelected
                ? 'bg-grey-900 border-grey-900'
                : 'border-grey-300'
            )}
          >
            {isSelected && <Check className="w-4 h-4 text-white" />}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default NewCase
