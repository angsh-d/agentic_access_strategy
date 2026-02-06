import { ENDPOINTS } from '@/lib/constants'
import type { WebSocketMessage } from '@/types/api'

type MessageHandler = (message: WebSocketMessage) => void
type ConnectionHandler = () => void
type ErrorHandler = (error: Event) => void

interface WebSocketOptions {
  reconnectAttempts?: number
  reconnectDelay?: number
  onOpen?: ConnectionHandler
  onClose?: ConnectionHandler
  onError?: ErrorHandler
}

/**
 * WebSocket connection manager for real-time case updates
 */
export class CaseWebSocket {
  private ws: WebSocket | null = null
  private caseId: string
  private messageHandlers: Set<MessageHandler> = new Set()
  private reconnectAttempts: number
  private maxReconnectAttempts: number
  private reconnectDelay: number
  private isIntentionallyClosed = false
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private options: WebSocketOptions

  constructor(caseId: string, options: WebSocketOptions = {}) {
    this.caseId = caseId
    this.maxReconnectAttempts = options.reconnectAttempts ?? 5
    this.reconnectAttempts = 0
    this.reconnectDelay = options.reconnectDelay ?? 1000
    this.options = options
  }

  /**
   * Connect to WebSocket
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return
    }

    const url = ENDPOINTS.caseWs(this.caseId)
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.reconnectAttempts = 0
      this.options.onOpen?.()
    }

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage
        this.messageHandlers.forEach(handler => handler(message))
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    this.ws.onclose = () => {
      if (!this.isIntentionallyClosed) {
        this.attemptReconnect()
      }
      this.options.onClose?.()
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      this.options.onError?.(error)
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1)

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (!this.isIntentionallyClosed) {
        this.connect()
      }
    }, delay)
  }

  /**
   * Subscribe to messages
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler)
    return () => {
      this.messageHandlers.delete(handler)
    }
  }

  /**
   * Send message through WebSocket
   */
  send(message: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket is not open, cannot send message')
    }
  }

  /**
   * Close connection
   */
  disconnect(): void {
    this.isIntentionallyClosed = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.messageHandlers.clear()
  }

  /**
   * Get connection state
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  /**
   * Get ready state
   */
  get readyState(): number | undefined {
    return this.ws?.readyState
  }
}

/**
 * Create a WebSocket connection for a case
 */
export function createCaseWebSocket(
  caseId: string,
  options?: WebSocketOptions
): CaseWebSocket {
  const ws = new CaseWebSocket(caseId, options)
  ws.connect()
  return ws
}

export default CaseWebSocket
