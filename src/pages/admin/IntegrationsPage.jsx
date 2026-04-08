/**
 * IntegrationsPage.jsx
 * Route: /admin/integrations
 *
 * Tabbed page for all external service integrations:
 *   [DocuSign]  [OCR Engine]  [future...]
 */
import { useState, useEffect, lazy, Suspense } from 'react'
import { Link2, Scan, Bot, Loader2, Save, Cloud, Key, Info, TestTube2, CheckCircle2, XCircle, Eye, EyeOff, ShieldCheck, ShieldAlert, Globe, UserCheck, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTenantConfig, bulkUpdateConfig, getAiGatewayIntegration, saveAiGatewayIntegration } from '../../api/adminApi'

// Lazy load the DocuSign settings (reuse existing page as a component)
const DocuSignSettings = lazy(() => import('./DocuSignSettingsPage'))

// ── OCR Engine Tab ───────────────────────────────────────────────────────────
function OcrEngineTab() {
  const qc = useQueryClient()
  const { data: configData, isLoading } = useQuery({
    queryKey: ['admin', 'config'],
    queryFn: getTenantConfig,
    staleTime: 60_000,
  })

  const [engine, setEngine]     = useState('tesseract')
  const [endpoint, setEndpoint] = useState('')
  const [apiKey, setApiKey]     = useState('')
  const [dirty, setDirty]       = useState(false)
  const [testing, setTesting]   = useState(false)
  const [testResult, setTestResult] = useState(null) // { ok: bool, message: string }

  const handleTestAzure = async () => {
    if (!endpoint.trim() || !apiKey.trim()) {
      toast.error('Enter endpoint and key before testing')
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      // Test via backend proxy to avoid exposing API key in browser network traffic
      // TODO: Replace with dedicated backend endpoint POST /api/admin/integrations/test-azure
      const url = endpoint.replace(/\/$/, '') + '/documentintelligence/documentModels?api-version=2024-11-30'
      const res = await fetch(url, {
        headers: { 'Ocp-Apim-Subscription-Key': apiKey },
      })
      if (res.ok) {
        const data = await res.json()
        const modelCount = data.value?.length ?? 0
        setTestResult({ ok: true, message: `Connected — ${modelCount} models available` })
        toast.success('Azure AI connection successful')
      } else {
        const errText = await res.text().catch(() => res.statusText)
        setTestResult({ ok: false, message: `HTTP ${res.status}: ${errText}` })
        toast.error('Connection failed — check endpoint and key')
      }
    } catch (err) {
      setTestResult({ ok: false, message: err.message })
      toast.error('Connection failed: ' + err.message)
    } finally {
      setTesting(false)
    }
  }

  useEffect(() => {
    if (!configData) return
    const get = (key) => {
      if (Array.isArray(configData)) {
        const item = configData.find(c => c.key === key || c.configKey === key)
        return item?.value ?? item?.configValue ?? ''
      }
      return configData[key] ?? ''
    }
    setEngine(get('ocr.engine') || 'tesseract')
    setEndpoint(get('ocr.azure.endpoint') || '')
    setApiKey(get('ocr.azure.key') || '')
    setDirty(false)
  }, [configData])

  const saveMut = useMutation({
    mutationFn: (configs) => bulkUpdateConfig(configs),
    onSuccess: () => {
      toast.success('OCR engine configuration saved')
      qc.invalidateQueries({ queryKey: ['admin', 'config'] })
      setDirty(false)
    },
    onError: () => toast.error('Failed to save configuration'),
  })

  const handleSave = () => {
    saveMut.mutate([
      { key: 'ocr.engine',         value: engine,   description: 'OCR engine: tesseract or azure' },
      { key: 'ocr.azure.endpoint', value: endpoint, description: 'Azure Document Intelligence endpoint' },
      { key: 'ocr.azure.key',      value: apiKey,   description: 'Azure Document Intelligence API key' },
    ])
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-16 text-gray-400">
      <Loader2 size={20} className="animate-spin mr-2" /> Loading...
    </div>
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
        {/* Engine selection */}
        <div className="px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-1.5 rounded-lg bg-gray-100">
              <Scan size={14} className="text-gray-500" />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-800">Active Engine</label>
              <p className="text-xs text-gray-400 mb-2">Tesseract = free/local. Azure AI = cloud, better accuracy for IDs, invoices.</p>
              <select value={engine} onChange={e => { setEngine(e.target.value); setDirty(true) }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200">
                <option value="tesseract">Tesseract (Local — free)</option>
                <option value="azure">Azure Document AI (Cloud)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Azure credentials — only shown when Azure selected */}
        {engine === 'azure' && (
          <>
            <div className="px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-1.5 rounded-lg bg-gray-100">
                  <Cloud size={14} className="text-gray-500" />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-800">Azure AI Endpoint</label>
                  <p className="text-xs text-gray-400 mb-2">From Azure Portal → Document Intelligence → Keys and Endpoint</p>
                  <input type="text" value={endpoint}
                    onChange={e => { setEndpoint(e.target.value); setDirty(true) }}
                    placeholder="https://your-resource.cognitiveservices.azure.com/"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200" />
                </div>
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 p-1.5 rounded-lg bg-gray-100">
                  <Key size={14} className="text-gray-500" />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-800">Azure AI Key</label>
                  <p className="text-xs text-gray-400 mb-2">Subscription key (Key 1 or Key 2)</p>
                  <input type="password" value={apiKey}
                    onChange={e => { setApiKey(e.target.value); setDirty(true) }}
                    placeholder="Enter API key"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200" />
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-blue-50">
              <div className="flex items-start gap-2 text-xs text-blue-700">
                <Info size={12} className="flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Supported prebuilt models:</strong> ID Documents (driver's licenses, passports),
                  Invoices, Receipts, Tax Forms (W-2). Model is auto-selected based on document category.
                  Free tier: 500 pages/month.
                </div>
              </div>
            </div>

            {/* Test connection + status */}
            <div className="px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {testResult && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                    ${testResult.ok
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-red-100 text-red-600 border border-red-200'}`}>
                    {testResult.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    {testResult.message}
                  </span>
                )}
              </div>
              <button onClick={handleTestAzure} disabled={testing || !endpoint.trim() || !apiKey.trim()}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40">
                {testing ? <Loader2 size={14} className="animate-spin" /> : <TestTube2 size={14} />}
                Test Connection
              </button>
            </div>
          </>
        )}

        {engine === 'tesseract' && (
          <div className="px-5 py-3 bg-gray-50">
            <div className="flex items-start gap-2 text-xs text-gray-500">
              <Info size={12} className="flex-shrink-0 mt-0.5" />
              <div>
                <strong>Tesseract</strong> runs locally via Docker container on port 8884.
                Free and offline. Uses regex-based field extraction templates.
                Best for structured/text-heavy documents. Limited accuracy on IDs and handwriting.
              </div>
            </div>
          </div>
        )}
      </div>

      {dirty && (
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saveMut.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saveMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Configuration
          </button>
        </div>
      )}
    </div>
  )
}

// ── AI Gateway Tab ───────────────────────────────────────────────────────────
function AiGatewayTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'integrations', 'ai-gateway'],
    queryFn: getAiGatewayIntegration,
    staleTime: 60_000,
  })

  // Non-sensitive fields — direct state
  const [url, setUrl]                   = useState('')
  const [baseUrl, setBaseUrl]           = useState('')
  const [oktaClientId, setOktaClientId] = useState('')
  const [route, setRoute]               = useState('direct')

  // HMAC secret (write-only)
  const [hmacSecret, setHmacSecret]             = useState('')
  const [showHmacSecret, setShowHmacSecret]     = useState(false)
  const [editingHmacSecret, setEditingHmacSecret] = useState(false)

  // Okta client secret (write-only)
  const [oktaSecret, setOktaSecret]         = useState('')
  const [showOktaSecret, setShowOktaSecret] = useState(false)
  const [editingOktaSecret, setEditingOktaSecret] = useState(false)

  const [dirty, setDirty] = useState(false)

  // Reset form when server data loads or refreshes. Using "adjust state during render"
  // pattern (React 19 recommended) instead of useEffect+setState.
  const [prevData, setPrevData] = useState(null)
  if (data !== prevData) {
    setPrevData(data)
    setUrl(data?.url || '')
    setBaseUrl(data?.baseUrl || '')
    setOktaClientId(data?.oktaClientId || '')
    setRoute(data?.route || 'direct')
    setHmacSecret('')
    setEditingHmacSecret(false)
    setOktaSecret('')
    setEditingOktaSecret(false)
    setDirty(false)
  }

  const saveMut = useMutation({
    mutationFn: (payload) => saveAiGatewayIntegration(payload),
    onSuccess: () => {
      toast.success('AI Gateway integration saved')
      qc.invalidateQueries({ queryKey: ['admin', 'integrations', 'ai-gateway'] })
      setHmacSecret('')
      setEditingHmacSecret(false)
      setShowHmacSecret(false)
      setOktaSecret('')
      setEditingOktaSecret(false)
      setShowOktaSecret(false)
      setDirty(false)
    },
    onError: () => toast.error('Failed to save AI Gateway integration'),
  })

  const handleSave = () => {
    const payload = {}
    if (url !== (data?.url || ''))                     payload.url = url
    if (baseUrl !== (data?.baseUrl || ''))             payload.baseUrl = baseUrl
    if (oktaClientId !== (data?.oktaClientId || ''))   payload.oktaClientId = oktaClientId
    if (route !== (data?.route || 'direct'))           payload.route = route
    if (editingHmacSecret && hmacSecret.trim())        payload.hmacSecret = hmacSecret.trim()
    if (editingOktaSecret && oktaSecret.trim())        payload.oktaClientSecret = oktaSecret.trim()

    if (Object.keys(payload).length === 0) {
      toast('Nothing to save', { icon: 'ℹ️' })
      return
    }

    // Validation: switching to gateway mode requires base URL + Okta creds
    if (route === 'gateway') {
      const effectiveBaseUrl = (payload.baseUrl ?? (data && data.baseUrl) ?? '').toString().trim()
      const effectiveClientId = (payload.oktaClientId ?? (data && data.oktaClientId) ?? '').toString().trim()
      const hasSecret = (data && data.oktaClientSecretConfigured) || (editingOktaSecret && oktaSecret.trim())
      if (!effectiveBaseUrl || !effectiveClientId || !hasSecret) {
        toast.error('Gateway mode requires Base URL, Okta Client ID, and Okta Client Secret')
        return
      }
    }

    saveMut.mutate(payload)
  }

  const handleStartHmacRotate = () => {
    setEditingHmacSecret(true)
    setHmacSecret('')
    setShowHmacSecret(false)
    setDirty(true)
  }
  const handleCancelHmacRotate = () => {
    setEditingHmacSecret(false)
    setHmacSecret('')
    setShowHmacSecret(false)
    recomputeDirty()
  }

  const handleStartOktaRotate = () => {
    setEditingOktaSecret(true)
    setOktaSecret('')
    setShowOktaSecret(false)
    setDirty(true)
  }
  const handleCancelOktaRotate = () => {
    setEditingOktaSecret(false)
    setOktaSecret('')
    setShowOktaSecret(false)
    recomputeDirty()
  }

  const recomputeDirty = () => {
    setDirty(
      url !== (data?.url || '') ||
      baseUrl !== (data?.baseUrl || '') ||
      oktaClientId !== (data?.oktaClientId || '') ||
      route !== (data?.route || 'direct')
    )
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-16 text-gray-400">
      <Loader2 size={20} className="animate-spin mr-2" /> Loading...
    </div>
  }

  const hmacConfigured = data?.hmacSecretConfigured
  const oktaConfigured = data?.oktaClientSecretConfigured

  return (
    <div className="max-w-3xl space-y-6">

      {/* ─── OCR Routing Mode ─── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-1.5 rounded-lg bg-gray-100">
              <Zap size={14} className="text-gray-500" />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-800">OCR LLM Routing</label>
              <p className="text-xs text-gray-400 mb-3">
                Controls how ECM OCR's LLM calls are dispatched.
                <strong> Direct</strong> sends them straight to Ollama.
                <strong> Gateway</strong> routes through the AI Gateway for governance, quota enforcement, PII tagging, and usage tracking.
              </p>
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => { setRoute('direct'); setDirty(true) }}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    route === 'direct'
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>
                  Direct Ollama
                  <div className="text-xs font-normal text-gray-400 mt-0.5">Existing behavior — no governance</div>
                </button>
                <button type="button"
                  onClick={() => { setRoute('gateway'); setDirty(true) }}
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    route === 'gateway'
                      ? 'bg-blue-50 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>
                  AI Gateway
                  <div className="text-xs font-normal text-gray-400 mt-0.5">Via /api/invoke — full governance</div>
                </button>
              </div>
              {route === 'gateway' && (!data?.baseUrl || !data?.oktaClientId || !data?.oktaClientSecretConfigured) && (
                <div className="mt-3 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <ShieldAlert size={12} className="flex-shrink-0 mt-0.5" />
                  <div>
                    Gateway mode requires <strong>Base URL</strong>, <strong>Okta Client ID</strong>, and <strong>Okta Client Secret</strong> below.
                    If any are missing, ECM OCR will fall back to direct Ollama automatically.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── AI Gateway Service Connection (for /api/invoke) ─── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Service Connection (OCR → /api/invoke)</h3>
        </div>

        {/* Base URL */}
        <div className="px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-1.5 rounded-lg bg-gray-100">
              <Globe size={14} className="text-gray-500" />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-800">Base URL</label>
              <p className="text-xs text-gray-400 mb-2">
                AI Gateway host, no path. ECM OCR will POST to <code className="font-mono">{'{baseUrl}/api/invoke'}</code>.
              </p>
              <input type="text" value={baseUrl}
                onChange={e => { setBaseUrl(e.target.value); setDirty(true) }}
                placeholder="http://localhost:8090"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
          </div>
        </div>

        {/* Okta Client ID */}
        <div className="px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-1.5 rounded-lg bg-gray-100">
              <UserCheck size={14} className="text-gray-500" />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-800">Okta Client ID</label>
              <p className="text-xs text-gray-400 mb-2">
                API Services client_id. Paste the value from the AI Gateway Applications admin page
                for the <code className="font-mono">ecm-ocr-pipeline</code> app, or from the Okta admin console.
              </p>
              <input type="text" value={oktaClientId}
                onChange={e => { setOktaClientId(e.target.value); setDirty(true) }}
                placeholder="0oa11q7ertmhbm1ml698"
                autoComplete="off"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
          </div>
        </div>

        {/* Okta Client Secret */}
        <div className="px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-1.5 rounded-lg bg-gray-100">
              <Key size={14} className="text-gray-500" />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-800">Okta Client Secret</label>
              <p className="text-xs text-gray-400 mb-2">
                API Services client_secret. Stored AES-GCM encrypted at rest in ECM.
                Used by ECM OCR to obtain service JWTs for <code className="font-mono">/api/invoke</code>.
              </p>

              {!editingOktaSecret && (
                <div className="flex items-center gap-3">
                  {oktaConfigured ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                      <ShieldCheck size={12} />
                      Configured
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                      <ShieldAlert size={12} />
                      Not configured — service JWT unavailable
                    </span>
                  )}
                  {data?.oktaClientSecretUpdatedAt && (
                    <span className="text-xs text-gray-400">
                      Updated {new Date(data.oktaClientSecretUpdatedAt).toLocaleString()}
                    </span>
                  )}
                  <button type="button" onClick={handleStartOktaRotate}
                    className="ml-auto px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                    {oktaConfigured ? 'Rotate' : 'Set Secret'}
                  </button>
                </div>
              )}

              {editingOktaSecret && (
                <div className="space-y-2">
                  <div className="relative">
                    <input type={showOktaSecret ? 'text' : 'password'} value={oktaSecret}
                      onChange={e => { setOktaSecret(e.target.value); setDirty(true) }}
                      placeholder="Paste Okta client_secret"
                      autoComplete="new-password"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200" />
                    <button type="button" onClick={() => setShowOktaSecret(s => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                      {showOktaSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={handleCancelOktaRotate}
                      className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-800">
                      Cancel
                    </button>
                    <span className="text-xs text-gray-400">
                      Encrypted at rest. Never displayed after save.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Webhook (RAG push) — existing from Change 2 ─── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Webhook (OCR → RAG ingestion)</h3>
        </div>

        {/* Webhook URL */}
        <div className="px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-1.5 rounded-lg bg-gray-100">
              <Cloud size={14} className="text-gray-500" />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-800">Webhook URL</label>
              <p className="text-xs text-gray-400 mb-2">AI Gateway RAG ingestion endpoint. Usually ends with <code className="font-mono">/api/webhook/rag-ingest</code>.</p>
              <input type="text" value={url}
                onChange={e => { setUrl(e.target.value); setDirty(true) }}
                placeholder="http://localhost:8090/api/webhook/rag-ingest"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
          </div>
        </div>

        {/* HMAC secret */}
        <div className="px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 p-1.5 rounded-lg bg-gray-100">
              <Key size={14} className="text-gray-500" />
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-800">HMAC Secret</label>
              <p className="text-xs text-gray-400 mb-2">
                Copy from AI Gateway admin UI → <strong>Gateway Settings → Webhook → Rotate Secret</strong>.
                Used to sign outbound OCR webhook calls.
              </p>

              {!editingHmacSecret && (
                <div className="flex items-center gap-3">
                  {hmacConfigured ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                      <ShieldCheck size={12} />
                      Configured · {data?.hmacSecretPreview || '••••'}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                      <ShieldAlert size={12} />
                      Not configured — OCR webhook push will be skipped
                    </span>
                  )}
                  {data?.hmacSecretUpdatedAt && (
                    <span className="text-xs text-gray-400">
                      Updated {new Date(data.hmacSecretUpdatedAt).toLocaleString()}
                    </span>
                  )}
                  <button type="button" onClick={handleStartHmacRotate}
                    className="ml-auto px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                    {hmacConfigured ? 'Rotate' : 'Set Secret'}
                  </button>
                </div>
              )}

              {editingHmacSecret && (
                <div className="space-y-2">
                  <div className="relative">
                    <input type={showHmacSecret ? 'text' : 'password'} value={hmacSecret}
                      onChange={e => { setHmacSecret(e.target.value); setDirty(true) }}
                      placeholder="Paste new HMAC secret (hex)"
                      autoComplete="new-password"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200" />
                    <button type="button" onClick={() => setShowHmacSecret(s => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                      {showHmacSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={handleCancelHmacRotate}
                      className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-800">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Info box ─── */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
        <div className="flex items-start gap-2 text-xs text-blue-700">
          <Info size={12} className="flex-shrink-0 mt-0.5" />
          <div>
            <strong>Routing cutover:</strong> flipping this switch to <strong>AI Gateway</strong> changes where ECM OCR's LLM calls land —
            both llama-text (classify/extract from text) and glm-ocr (vision text extraction). ECM OCR picks up the change within 60 seconds.
            Any gateway failure (auth, PII block, network) automatically falls back to direct Ollama for that document — no pipeline crashes.
            Check ecm-ocr logs for <code className="font-mono">routed via AI Gateway</code> or <code className="font-mono">falling back to direct</code> messages.
          </div>
        </div>
      </div>

      {dirty && (
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saveMut.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {saveMut.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Configuration
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
const INTEGRATION_TABS = [
  { key: 'docusign',   label: 'DocuSign',    icon: Link2 },
  { key: 'ocr',        label: 'OCR Engine',  icon: Scan },
  { key: 'ai-gateway', label: 'AI Gateway',  icon: Bot },
]

export default function IntegrationsPage() {
  const [activeTab, setActiveTab] = useState('docusign')

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      {/* Integration tabs */}
      <div className="flex gap-0 border-b border-gray-200">
        {/* eslint-disable-next-line no-unused-vars */}
        {INTEGRATION_TABS.map(({ key, label, icon: TabIcon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors
              ${activeTab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
            <TabIcon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'docusign' && (
        <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-400" /></div>}>
          <DocuSignSettings />
        </Suspense>
      )}

      {activeTab === 'ocr' && <OcrEngineTab />}

      {activeTab === 'ai-gateway' && <AiGatewayTab />}
    </div>
  )
}
