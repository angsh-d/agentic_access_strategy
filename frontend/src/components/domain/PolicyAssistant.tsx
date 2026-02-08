/**
 * PolicyAssistant — slide-out chat panel for policy Q&A.
 * Apple HIG: glass morphism, greyscale-first chat, premium inputs,
 * subtle semantic badges, Apple spring animations.
 */

import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import {
  Send,
  X,
  Loader2,
  ChevronDown,
  BookOpen,
  Sparkles,
} from 'lucide-react'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { Badge } from '@/components/ui/Badge'
import { ENDPOINTS } from '@/lib/constants'
import { appleSpring, appleEase } from '@/lib/animations'

interface PolicyAssistantProps {
  onClose: () => void
}

interface Citation {
  payer: string
  criterion_id: string
  text: string
}

interface AssistantMessage {
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  policies_consulted?: string[]
  confidence?: number
  timestamp: string
}

const confidenceBadge = (confidence: number) => {
  if (confidence >= 0.9) return <Badge variant="success" size="sm">High confidence</Badge>
  if (confidence >= 0.7) return <Badge variant="neutral" size="sm">Moderate</Badge>
  return <Badge variant="warning" size="sm">Low confidence</Badge>
}

export function PolicyAssistant({ onClose }: PolicyAssistantProps) {
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [input, setInput] = useState('')
  const [payerFilter, setPayerFilter] = useState('')
  const [medicationFilter, setMedicationFilter] = useState('')
  const [expandedCitations, setExpandedCitations] = useState<Set<number>>(new Set())
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const { mutate: sendQuery, isPending } = useMutation({
    mutationFn: async (question: string) => {
      const { request } = await import('@/services/api')
      return request<{
        answer: string
        citations: Citation[]
        policies_consulted: string[]
        confidence: number
      }>(ENDPOINTS.policyAssistant, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          payer_filter: payerFilter || null,
          medication_filter: medicationFilter || null,
        }),
      })
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.answer,
          citations: data.citations,
          policies_consulted: data.policies_consulted,
          confidence: data.confidence,
          timestamp: new Date().toISOString(),
        },
      ])
    },
    onError: (error) => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${(error as Error).message}`,
          timestamp: new Date().toISOString(),
        },
      ])
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isPending) return

    const question = input.trim()
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: question, timestamp: new Date().toISOString() },
    ])
    setInput('')
    sendQuery(question)
  }

  const toggleCitations = (idx: number) => {
    setExpandedCitations((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isPending])

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={appleSpring}
      className="h-[calc(100vh-12rem)] flex flex-col sticky top-8"
    >
      <GlassPanel variant="default" padding="none" className="flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-grey-100">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent/[0.08] flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
            </div>
            <h3 className="text-[13px] font-semibold text-grey-900 tracking-tight">Policy Assistant</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-grey-300 hover:text-grey-500 transition-colors rounded-lg hover:bg-grey-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-4 py-2.5 border-b border-grey-100 flex gap-2">
          <input
            type="text"
            placeholder="Payer filter..."
            value={payerFilter}
            onChange={(e) => setPayerFilter(e.target.value)}
            className="flex-1 px-2.5 py-1.5 text-[11px] bg-grey-50 border border-grey-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-grey-900/10 focus:border-grey-300 transition-all placeholder:text-grey-300"
          />
          <input
            type="text"
            placeholder="Medication..."
            value={medicationFilter}
            onChange={(e) => setMedicationFilter(e.target.value)}
            className="flex-1 px-2.5 py-1.5 text-[11px] bg-grey-50 border border-grey-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-grey-900/10 focus:border-grey-300 transition-all placeholder:text-grey-300"
          />
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="w-12 h-12 rounded-2xl bg-grey-100 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-6 h-6 text-grey-300" />
              </div>
              <p className="text-[13px] font-medium text-grey-600">Ask about any digitized policy</p>
              <p className="text-[11px] text-grey-400 mt-1.5 leading-relaxed max-w-[240px] mx-auto">
                e.g., &quot;What step therapy does this policy require?&quot;
              </p>
            </div>
          )}

          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={appleEase}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${
                  msg.role === 'user'
                    ? 'bg-grey-100 text-grey-900'
                    : 'bg-white border border-grey-200 text-grey-800'
                }`}
              >
                <div className="text-[13px] leading-relaxed prose prose-sm prose-grey max-w-none
                  [&_p]:my-1.5 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0.5
                  [&_strong]:font-semibold [&_strong]:text-grey-900
                  [&_h1]:text-sm [&_h1]:font-semibold [&_h1]:mt-3 [&_h1]:mb-1.5
                  [&_h2]:text-[13px] [&_h2]:font-semibold [&_h2]:mt-2.5 [&_h2]:mb-1
                  [&_h3]:text-[13px] [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1
                ">
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>

                {msg.role === 'assistant' && (
                  <div className="mt-2.5 space-y-2">
                    {msg.confidence != null && (
                      <div className="flex items-center gap-2">
                        {confidenceBadge(msg.confidence)}
                      </div>
                    )}

                    {msg.policies_consulted && msg.policies_consulted.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {msg.policies_consulted.map((p, i) => (
                          <span
                            key={i}
                            className="text-[10px] px-1.5 py-0.5 bg-grey-50 text-grey-500 rounded-md font-medium"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    )}

                    {msg.citations && msg.citations.length > 0 && (
                      <div>
                        <button
                          onClick={() => toggleCitations(idx)}
                          className="text-[10px] text-grey-400 hover:text-grey-600 flex items-center gap-0.5 font-medium transition-colors"
                        >
                          <motion.div
                            animate={{ rotate: expandedCitations.has(idx) ? 0 : -90 }}
                            transition={{ duration: 0.15 }}
                          >
                            <ChevronDown className="w-3 h-3" />
                          </motion.div>
                          {msg.citations.length} citation{msg.citations.length !== 1 ? 's' : ''}
                        </button>

                        <AnimatePresence>
                          {expandedCitations.has(idx) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={appleEase}
                              className="overflow-hidden mt-1.5 space-y-1"
                            >
                              {msg.citations.map((c, ci) => (
                                <div
                                  key={ci}
                                  className="text-[10px] px-2.5 py-1.5 bg-grey-50 border border-grey-100 rounded-lg"
                                >
                                  <span className="font-mono text-grey-500">{c.criterion_id}</span>
                                  <span className="text-grey-300 mx-1">|</span>
                                  <span className="text-grey-600 font-medium">{c.payer}</span>
                                  {c.text && (
                                    <p className="text-grey-500 mt-0.5 leading-relaxed">{c.text}</p>
                                  )}
                                </div>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}

          {isPending && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={appleEase}
              className="flex justify-start"
            >
              <div className="bg-white border border-grey-200 rounded-2xl px-3.5 py-2.5 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-grey-400 animate-spin" />
                <span className="text-[11px] text-grey-400">Analyzing policies...</span>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-grey-100">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about policies..."
              disabled={isPending}
              className="flex-1 px-3.5 py-2 text-[13px] bg-grey-50 border border-grey-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-grey-900/10 focus:border-grey-300 disabled:opacity-50 transition-all placeholder:text-grey-300"
            />
            <motion.button
              type="submit"
              disabled={!input.trim() || isPending}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              className="p-2.5 bg-grey-900 text-white rounded-xl hover:bg-grey-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-3.5 h-3.5" />
            </motion.button>
          </div>
        </form>
      </GlassPanel>
    </motion.div>
  )
}
