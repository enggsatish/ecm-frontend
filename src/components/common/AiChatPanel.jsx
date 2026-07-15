/**
 * AiChatPanel.jsx
 *
 * Floating AI chat widget for ECM frontend. Connects to the AI Gateway
 * at /api/chat via the ECM gateway (which proxies to port 8090).
 *
 * Features:
 *   - Collapsible floating panel (bottom-right)
 *   - Sends JWT for authentication
 *   - SSE streaming with token-by-token display
 *   - Fallback to sync endpoint if streaming fails
 *   - Chat history within session
 *   - Model selector
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { Bot, X, Send, Loader2, Zap } from 'lucide-react'
import apiClient from '../../api/apiClient'
import { oktaAuth } from '../../utils/oktaConfig'

export default function AiChatPanel() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [models, setModels] = useState([])
  const [model, setModel] = useState('')
  const [streaming, setStreaming] = useState(true)

  // Load available models from AI Gateway (via ECM gateway)
  useEffect(() => {
    apiClient.get('/api/ai/models')
      .then(r => {
        const list = r.data?.data ?? r.data ?? []
        setModels(Array.isArray(list) ? list : [])
        const def = list.find(m => m.is_default || m.isDefault)
        if (def) setModel(def.name)
        else if (list.length > 0) setModel(list[0].name)
      })
      .catch(() => setModels([]))
  }, [])
  const messagesEndRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const sendMessageSync = useCallback(async (userMsg) => {
    try {
      const res = await apiClient.post('/api/ai/chat', { message: userMsg, model })
      const data = res.data?.data ?? res.data
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.response || 'No response',
        model: data.model,
        durationMs: data.durationMs,
      }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Error: ' + err.message, error: true }])
    }
  }, [model])

  const sendMessageStream = useCallback(async (userMsg) => {
    // Use fetch directly for streaming — axios doesn't support ReadableStream
    const token = oktaAuth.getAccessToken()

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: userMsg, model }),
        signal: controller.signal,
      })

      if (!res.ok) {
        // Streaming not available — fall back to sync
        setStreaming(false)
        await sendMessageSync(userMsg)
        return
      }

      // Add empty assistant message to stream into
      setMessages(prev => [...prev, { role: 'assistant', text: '', streaming: true }])

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const jsonStr = line.slice(5).trim()
          if (!jsonStr) continue

          try {
            const evt = JSON.parse(jsonStr)

            if (evt.token) {
              // Append token to the last assistant message
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === 'assistant' && last.streaming) {
                  updated[updated.length - 1] = { ...last, text: last.text + evt.token }
                }
                return updated
              })
            } else if (evt.done) {
              // Stream complete — finalize message with metadata
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = {
                    ...last,
                    streaming: false,
                    model: evt.model,
                    durationMs: evt.durationMs,
                  }
                }
                return updated
              })
            } else if (evt.error) {
              setMessages(prev => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = { ...last, text: 'Error: ' + evt.error, error: true, streaming: false }
                }
                return updated
              })
            }
          } catch { /* ignore malformed SSE line */ }
        }
      }

      // Finalize if stream ended without done event
      setMessages(prev => {
        const updated = [...prev]
        const last = updated[updated.length - 1]
        if (last?.role === 'assistant' && last.streaming) {
          updated[updated.length - 1] = { ...last, streaming: false }
        }
        return updated
      })
    } catch (err) {
      if (err.name === 'AbortError') return
      // Fall back to sync on any streaming error
      setStreaming(false)
      await sendMessageSync(userMsg)
    }
  }, [model, sendMessageSync])

  const sendMessage = async () => {
    if (!input.trim() || sending) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setSending(true)

    try {
      if (streaming) {
        await sendMessageStream(userMsg)
      } else {
        await sendMessageSync(userMsg)
      }
    } finally {
      setSending(false)
      abortRef.current = null
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-violet-600 text-white rounded-full shadow-lg hover:bg-violet-700 flex items-center justify-center cursor-pointer z-50 transition-transform hover:scale-105">
        <Bot size={24} />
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[32rem] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-white" />
          <span className="text-white font-semibold text-sm">AI Assistant</span>
          {streaming && <Zap size={10} className="text-amber-300" title="Streaming enabled" />}
        </div>
        <div className="flex items-center gap-2">
          <select value={model} onChange={e => setModel(e.target.value)}
            className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded border border-white/30 outline-none cursor-pointer">
            {models.map(m => (
              <option key={m.name} value={m.name} className="text-gray-900">{m.label || m.name}</option>
            ))}
            {models.length === 0 && <option className="text-gray-900">Loading...</option>}
          </select>
          <button onClick={() => setOpen(false)} className="text-white/80 hover:text-white cursor-pointer">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <Bot size={28} className="mx-auto mb-2 opacity-40" />
            <p className="text-xs">Ask me about documents, cases, customers, or policies.</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-violet-600 text-white rounded-br-sm'
                : msg.error
                  ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
            }`}>
              <p className="whitespace-pre-wrap break-words">{msg.text}
                {msg.streaming && <span className="inline-block w-1.5 h-4 bg-violet-500 ml-0.5 animate-pulse rounded-sm" />}
              </p>
              {msg.durationMs && !msg.streaming && (
                <p className="text-[9px] mt-1 opacity-60">{msg.model} · {(msg.durationMs / 1000).toFixed(1)}s</p>
              )}
            </div>
          </div>
        ))}
        {sending && !messages[messages.length - 1]?.streaming && (
          <div className="flex justify-start">
            <div className="bg-gray-100 px-3 py-2 rounded-xl rounded-bl-sm flex items-center gap-1.5 text-gray-500 text-sm">
              <Loader2 size={13} className="animate-spin" /> Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 p-3 flex-shrink-0">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
            placeholder="Type a message..."
            disabled={sending}
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
          />
          <button onClick={sendMessage} disabled={!input.trim() || sending}
            className="w-9 h-9 flex items-center justify-center bg-violet-600 text-white rounded-xl hover:bg-violet-700 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed flex-shrink-0">
            <Send size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
