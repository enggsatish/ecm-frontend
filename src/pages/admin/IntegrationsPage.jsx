/**
 * IntegrationsPage.jsx
 * Route: /admin/integrations
 *
 * Tabbed page for all external service integrations:
 *   [DocuSign]  [OCR Engine]  [future...]
 */
import { useState, useEffect, lazy, Suspense } from 'react'
import { Link2, Scan, Bot, Loader2, Save, Cloud, Key, Info, TestTube2, CheckCircle2, XCircle, Eye, EyeOff, ShieldCheck, ShieldAlert } from 'lucide-react'
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

  const [url, setUrl]             = useState('')
  const [secret, setSecret]       = useState('')       // plaintext only when user is actively editing
  const [showSecret, setShowSecret] = useState(false)
  const [editingSecret, setEditingSecret] = useState(false)
  const [dirty, setDirty]         = useState(false)

  // Reset form when server data loads or refreshes. Using the "adjust state during render"
  // pattern (React 19 recommended) instead of useEffect+setState, which triggers the
  // react-hooks/set-state-in-effect rule.
  const [prevData, setPrevData] = useState(null)
  if (data !== prevData) {
    setPrevData(data)
    setUrl(data?.url || '')
    setSecret('')
    setEditingSecret(false)
    setDirty(false)
  }

  const saveMut = useMutation({
    mutationFn: (payload) => saveAiGatewayIntegration(payload),
    onSuccess: () => {
      toast.success('AI Gateway integration saved')
      qc.invalidateQueries({ queryKey: ['admin', 'integrations', 'ai-gateway'] })
      setSecret('')
      setEditingSecret(false)
      setShowSecret(false)
      setDirty(false)
    },
    onError: () => toast.error('Failed to save AI Gateway integration'),
  })

  const handleSave = () => {
    const payload = {}
    if (url !== (data?.url || '')) payload.url = url
    if (editingSecret && secret.trim()) payload.hmacSecret = secret.trim()
    if (Object.keys(payload).length === 0) {
      toast('Nothing to save', { icon: 'ℹ️' })
      return
    }
    saveMut.mutate(payload)
  }

  const handleStartRotate = () => {
    setEditingSecret(true)
    setSecret('')
    setShowSecret(false)
    setDirty(true)
  }

  const handleCancelRotate = () => {
    setEditingSecret(false)
    setSecret('')
    setShowSecret(false)
    // Recompute dirty based on URL only
    setDirty(url !== (data?.url || ''))
  }

  if (isLoading) {
    return <div className="flex items-center justify-center py-16 text-gray-400">
      <Loader2 size={20} className="animate-spin mr-2" /> Loading...
    </div>
  }

  const configured = data?.hmacSecretConfigured

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">

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
                Copy from the AI Gateway admin UI → <strong>Gateway Settings → Webhook → Rotate Secret</strong>, then paste here.
                Used to sign outbound OCR webhook calls so the gateway can verify they came from ECM.
              </p>

              {!editingSecret && (
                <div className="flex items-center gap-3">
                  {configured ? (
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
                  <button type="button" onClick={handleStartRotate}
                    className="ml-auto px-3 py-1.5 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                    {configured ? 'Rotate' : 'Set Secret'}
                  </button>
                </div>
              )}

              {editingSecret && (
                <div className="space-y-2">
                  <div className="relative">
                    <input type={showSecret ? 'text' : 'password'} value={secret}
                      onChange={e => { setSecret(e.target.value); setDirty(true) }}
                      placeholder="Paste new HMAC secret (hex)"
                      autoComplete="new-password"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200" />
                    <button type="button" onClick={() => setShowSecret(s => !s)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
                      {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={handleCancelRotate}
                      className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-800">
                      Cancel
                    </button>
                    <span className="text-xs text-gray-400">
                      The secret is only sent to the server when you click Save — it's never displayed after that.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 bg-blue-50">
          <div className="flex items-start gap-2 text-xs text-blue-700">
            <Info size={12} className="flex-shrink-0 mt-0.5" />
            <div>
              <strong>Rotation workflow:</strong> Generate a new secret in the AI Gateway admin UI,
              copy the hex value, paste it here, and save. ECM OCR picks up the new secret within 60 seconds.
              During that window some webhook calls may be rejected — this is expected.
            </div>
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
