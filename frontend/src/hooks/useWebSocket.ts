import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CaseWebSocket } from '@/services/websocket'
import { QUERY_KEYS } from '@/lib/constants'
import type { WebSocketMessage, CaseUpdatedMessage, StageChangedMessage } from '@/types/api'

interface UseWebSocketOptions {
  onMessage?: (message: WebSocketMessage) => void
  onStageChange?: (previousStage: string, newStage: string) => void
  onError?: (error: Event) => void
  enabled?: boolean
}

/**
 * Hook to subscribe to real-time case updates via WebSocket.
 * Callbacks are stored in refs to prevent reconnect on every render.
 */
export function useWebSocket(caseId: string | undefined, options: UseWebSocketOptions = {}) {
  const { onMessage, onStageChange, onError, enabled = true } = options
  const queryClient = useQueryClient()
  const wsRef = useRef<CaseWebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)

  // Store callbacks in refs so they don't trigger reconnection
  const onMessageRef = useRef(onMessage)
  const onStageChangeRef = useRef(onStageChange)
  const onErrorRef = useRef(onError)

  // Keep refs current
  useEffect(() => { onMessageRef.current = onMessage }, [onMessage])
  useEffect(() => { onStageChangeRef.current = onStageChange }, [onStageChange])
  useEffect(() => { onErrorRef.current = onError }, [onError])

  // Handle incoming messages — stable callback via refs
  const handleMessage = useCallback((message: WebSocketMessage) => {
    setLastMessage(message)
    onMessageRef.current?.(message)

    // Handle specific message types
    switch (message.type) {
      case 'case_updated': {
        const msg = message as CaseUpdatedMessage
        // Update case in cache
        queryClient.setQueryData(QUERY_KEYS.case(message.case_id), {
          case: msg.data.case
        })
        // Invalidate cases list
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.cases })
        break
      }

      case 'stage_changed': {
        const msg = message as StageChangedMessage
        onStageChangeRef.current?.(msg.data.previous_stage, msg.data.new_stage)
        // Update case in cache
        queryClient.setQueryData(QUERY_KEYS.case(message.case_id), {
          case: msg.data.case
        })
        break
      }

      case 'strategy_selected': {
        // Invalidate strategies query
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.strategies(message.case_id)
        })
        break
      }
    }
  }, [queryClient])

  // Connect/disconnect based on caseId and enabled only
  useEffect(() => {
    if (!caseId || !enabled) {
      return
    }

    const ws = new CaseWebSocket(caseId, {
      onOpen: () => setIsConnected(true),
      onClose: () => setIsConnected(false),
      onError: (e) => onErrorRef.current?.(e),
    })

    ws.connect()
    const unsubscribe = ws.onMessage(handleMessage)

    wsRef.current = ws

    return () => {
      unsubscribe()
      ws.disconnect()
      wsRef.current = null
      setIsConnected(false)
    }
  }, [caseId, enabled, handleMessage])

  // Send message through WebSocket
  const send = useCallback((message: Record<string, unknown>) => {
    wsRef.current?.send(message)
  }, [])

  return {
    isConnected,
    lastMessage,
    send,
  }
}

export default useWebSocket
