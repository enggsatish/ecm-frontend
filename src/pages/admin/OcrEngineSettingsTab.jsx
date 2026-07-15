/**
 * OcrEngineSettingsTab.jsx
 *
 * Dynamic OCR pipeline configuration tab for Admin → Settings.
 * Allows admin to enable/disable engines, set priority order,
 * configure each engine, and test connectivity.
 *
 * Pipeline config is stored as a single JSON value under key "ocr.pipeline"
 * in tenant_config.
 */
import { useState, useEffect } from 'react'
import { Loader2, Save, GripVertical, CheckCircle, XCircle, Wifi, WifiOff,
         ChevronDown, ChevronUp, Cpu, Cloud, Zap, AlertTriangle, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import apiClient from '../../api/apiClient'
import { useTenantConfig, useBulkUpdateConfig } from '../../hooks/useAdmin'

const ENGINE_META = {
  'glm-ocr': {
    name: 'Vision LLM (via AI Gateway)',
    description: 'Routes images through the AI Gateway — gateway selects any model with "Supports Vision" enabled. Provides model governance, usage logging, and PII guard. Falls back to direct Ollama if gateway is unreachable.',
    icon: Cpu,
    color: 'violet',
    capabilities: ['OCR', 'CLASSIFY', 'EXTRACT_FIELDS'],
    configFields: [
      { key: 'url', label: 'Ollama URL (fallback only)', placeholder: 'http://localhost:11434', type: 'text' },
      { key: 'model', label: 'Fallback Model Name', placeholder: 'glm-ocr', type: 'text' },
      { key: 'timeout', label: 'Timeout (seconds)', placeholder: '120', type: 'number' },
    ],
    memoryNote: 'Primary path: AI Gateway (configure at Admin → Integrations → AI Gateway). Fallback model is only used if the gateway is disabled or unreachable.',
  },
  'azure': {
    name: 'Azure AI Document Intelligence',
    description: 'Cloud AI with prebuilt models for IDs, invoices, receipts. High accuracy, per-page cost.',
    icon: Cloud,
    color: 'blue',
    capabilities: ['OCR', 'CLASSIFY', 'EXTRACT_FIELDS'],
    configFields: [
      { key: 'endpoint', label: 'Endpoint URL', placeholder: 'https://your-resource.cognitiveservices.azure.com', type: 'text' },
      { key: 'key', label: 'API Key', placeholder: '', type: 'password' },
      { key: 'rateLimit', label: 'Rate Limit (req/sec)', placeholder: '1', type: 'number' },
    ],
  },
  'llama-text': {
    name: 'Text Classify + Extract (via AI Gateway)',
    description: 'Works on OCR text from a prior engine — classifies the document and extracts fields. Routes through the AI Gateway — gateway selects whichever model is configured for this application (not necessarily Llama, despite the engine name — that predates gateway routing). Falls back to direct Ollama if gateway is unreachable.',
    icon: Cpu,
    color: 'emerald',
    capabilities: ['CLASSIFY', 'EXTRACT_FIELDS'],
    configFields: [
      { key: 'url', label: 'Ollama URL (fallback only)', placeholder: 'http://localhost:11434', type: 'text' },
      { key: 'model', label: 'Fallback Model Name', placeholder: 'llama3.2:3b', type: 'text' },
      { key: 'timeout', label: 'Timeout (seconds)', placeholder: '60', type: 'number' },
    ],
    memoryNote: 'Primary path: AI Gateway (configure at Admin → Integrations → AI Gateway). Fallback model is only used if the gateway is disabled or unreachable.',
  },
  'rapidocr': {
    name: 'RapidOCR (Local)',
    description: 'Fast local text extraction via Docker container. Text only — needs another engine for classification.',
    icon: Zap,
    color: 'amber',
    capabilities: ['OCR'],
    configFields: [
      { key: 'url', label: 'Container URL', placeholder: 'http://localhost:8884', type: 'text' },
      { key: 'apiPath', label: 'API Path', placeholder: '/ocr', type: 'text' },
      { key: 'fileField', label: 'File Field Name', placeholder: 'image_file', type: 'text' },
      { key: 'timeout', label: 'Timeout (seconds)', placeholder: '60', type: 'number' },
    ],
  },
}

const CAPABILITY_LABELS = {
  OCR: { label: 'OCR', color: 'bg-emerald-100 text-emerald-700' },
  CLASSIFY: { label: 'Classify', color: 'bg-blue-100 text-blue-700' },
  EXTRACT_FIELDS: { label: 'Extract Fields', color: 'bg-purple-100 text-purple-700' },
}

const DEFAULT_PIPELINE = [
  { engine: 'glm-ocr', enabled: true, priority: 1, minConfidence: 75, config: { url: 'http://localhost:11434', model: 'glm-ocr', timeout: '120' } },
  { engine: 'llama-text', enabled: true, priority: 2, minConfidence: 75, config: { url: 'http://localhost:11434', model: 'llama3.2:3b', timeout: '60' } },
  { engine: 'azure', enabled: true, priority: 3, minConfidence: 0, config: {} },
  { engine: 'rapidocr', enabled: false, priority: 4, minConfidence: 0, config: { url: 'http://localhost:8884', apiPath: '/ocr', fileField: 'image_file', timeout: '60' } },
]

export default function OcrEngineSettingsTab() {
  const { data: configData } = useTenantConfig()
  const bulkUpdate = useBulkUpdateConfig()
  const [pipeline, setPipeline] = useState(DEFAULT_PIPELINE)
  const [dirty, setDirty] = useState(false)
  const [expandedEngine, setExpandedEngine] = useState(null)
  const [testResults, setTestResults] = useState({})
  const [testingEngine, setTestingEngine] = useState(null)
  const [engineToAdd, setEngineToAdd] = useState('')

  // Load pipeline from config
  useEffect(() => {
    if (!configData) return
    const raw = Array.isArray(configData)
      ? configData.find(c => c.key === 'ocr.pipeline')?.value
      : configData['ocr.pipeline']
    if (raw) {
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPipeline(parsed)
          return
        }
      } catch { /* use defaults */ }
    }
    setPipeline(DEFAULT_PIPELINE)
  }, [configData])

  const toggleEngine = (engineId) => {
    setPipeline(prev => prev.map(e =>
      e.engine === engineId ? { ...e, enabled: !e.enabled } : e
    ))
    setDirty(true)
  }

  const updateConfig = (engineId, key, value) => {
    setPipeline(prev => prev.map(e =>
      e.engine === engineId ? { ...e, config: { ...e.config, [key]: value } } : e
    ))
    setDirty(true)
  }

  const updateMinConfidence = (engineId, value) => {
    setPipeline(prev => prev.map(e =>
      e.engine === engineId ? { ...e, minConfidence: parseInt(value) || 0 } : e
    ))
    setDirty(true)
  }

  const moveEngine = (index, direction) => {
    const newPipeline = [...pipeline]
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= newPipeline.length) return
    ;[newPipeline[index], newPipeline[targetIndex]] = [newPipeline[targetIndex], newPipeline[index]]
    // Reassign priorities
    newPipeline.forEach((e, i) => { e.priority = i + 1 })
    setPipeline(newPipeline)
    setDirty(true)
  }

  const missingEngines = Object.keys(ENGINE_META).filter(
    key => !pipeline.some(e => e.engine === key)
  )

  const handleAddEngine = () => {
    if (!engineToAdd) return
    const defaults = DEFAULT_PIPELINE.find(e => e.engine === engineToAdd)
    const maxPriority = pipeline.reduce((max, e) => Math.max(max, e.priority), 0)
    setPipeline(prev => [
      ...prev,
      {
        engine: engineToAdd,
        enabled: true,
        priority: maxPriority + 1,
        minConfidence: defaults?.minConfidence ?? 0,
        config: defaults?.config ?? {},
      },
    ])
    setEngineToAdd('')
    setDirty(true)
  }

  const handleSave = () => {
    const configs = [{
      key: 'ocr.pipeline',
      value: JSON.stringify(pipeline),
      description: 'Dynamic OCR pipeline engine configuration',
    }]
    bulkUpdate.mutate(configs, {
      onSuccess: () => { toast.success('OCR pipeline saved'); setDirty(false) },
      onError: () => toast.error('Failed to save pipeline configuration'),
    })
  }

  const handleTestConnection = async (engineId) => {
    const entry = pipeline.find(e => e.engine === engineId)
    if (!entry) return
    setTestingEngine(engineId)
    setTestResults(prev => ({ ...prev, [engineId]: null }))

    try {
      const res = await apiClient.post('/api/ocr/test-connection', {
        engine: engineId,
        config: entry.config,
      })
      const result = res.data?.data ?? res.data
      setTestResults(prev => ({ ...prev, [engineId]: result }))
    } catch (err) {
      setTestResults(prev => ({
        ...prev,
        [engineId]: { success: false, message: err.response?.data?.message || err.message },
      }))
    } finally {
      setTestingEngine(null)
    }
  }

  // Build pipeline preview text
  const enabledEngines = pipeline.filter(e => e.enabled).sort((a, b) => a.priority - b.priority)
  const pipelinePreview = enabledEngines.map((e, i) => {
    const meta = ENGINE_META[e.engine]
    const name = meta?.name?.split(' ')[0] || e.engine
    const suffix = e.minConfidence > 0 ? ` (min ${e.minConfidence}%)` : ''
    return (i > 0 ? ' → ' : '') + name + suffix
  }).join('')

  const hasClassifier = enabledEngines.some(e =>
    ENGINE_META[e.engine]?.capabilities?.includes('CLASSIFY')
  )

  return (
    <div className="space-y-6">
      {/* Pipeline preview */}
      <div className="bg-gradient-to-r from-gray-50 to-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Pipeline Flow</p>
            <p className="text-sm font-mono text-gray-800">
              {enabledEngines.length > 0 ? pipelinePreview : 'No engines enabled'}
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={!dirty || bulkUpdate.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {bulkUpdate.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Pipeline
          </button>
        </div>
        {!hasClassifier && enabledEngines.length > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-amber-600 text-xs">
            <AlertTriangle size={12} />
            No engine with classification capability enabled. Documents won't be auto-classified.
          </div>
        )}
      </div>

      {/* Engine cards */}
      <div className="space-y-3">
        {pipeline.sort((a, b) => a.priority - b.priority).map((entry, index) => {
          const meta = ENGINE_META[entry.engine]
          if (!meta) return null
          const Icon = meta.icon
          const isExpanded = expandedEngine === entry.engine
          const testResult = testResults[entry.engine]
          const isTesting = testingEngine === entry.engine

          const colorMap = {
            violet: { bg: 'bg-violet-50', border: 'border-violet-200', icon: 'text-violet-600', toggle: 'bg-violet-600' },
            blue:   { bg: 'bg-blue-50',   border: 'border-blue-200',   icon: 'text-blue-600',   toggle: 'bg-blue-600' },
            amber:  { bg: 'bg-amber-50',  border: 'border-amber-200',  icon: 'text-amber-600',  toggle: 'bg-amber-600' },
          }
          const colors = colorMap[meta.color] || colorMap.blue

          return (
            <div key={entry.engine}
              className={`rounded-xl border ${entry.enabled ? colors.border : 'border-gray-200'} ${entry.enabled ? 'bg-white' : 'bg-gray-50'} shadow-sm transition-all`}
            >
              {/* Header row */}
              <div className="px-4 py-3 flex items-center gap-3">
                {/* Drag handle / priority */}
                <div className="flex flex-col items-center gap-0.5 text-gray-300">
                  <button onClick={() => moveEngine(index, -1)} disabled={index === 0}
                    className="hover:text-gray-500 disabled:opacity-30 cursor-pointer disabled:cursor-default">
                    <ChevronUp size={14} />
                  </button>
                  <span className="text-[10px] font-bold text-gray-400">{index + 1}</span>
                  <button onClick={() => moveEngine(index, 1)} disabled={index === pipeline.length - 1}
                    className="hover:text-gray-500 disabled:opacity-30 cursor-pointer disabled:cursor-default">
                    <ChevronDown size={14} />
                  </button>
                </div>

                {/* Icon */}
                <div className={`p-2 rounded-lg ${entry.enabled ? colors.bg : 'bg-gray-100'}`}>
                  <Icon size={18} className={entry.enabled ? colors.icon : 'text-gray-400'} />
                </div>

                {/* Name + description */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${entry.enabled ? 'text-gray-900' : 'text-gray-400'}`}>
                      {meta.name}
                    </span>
                    <div className="flex gap-1">
                      {meta.capabilities.map(cap => (
                        <span key={cap} className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${entry.enabled ? CAPABILITY_LABELS[cap].color : 'bg-gray-100 text-gray-400'}`}>
                          {CAPABILITY_LABELS[cap].label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <p className={`text-xs ${entry.enabled ? 'text-gray-500' : 'text-gray-400'} mt-0.5`}>
                    {meta.description}
                  </p>
                </div>

                {/* Enable toggle */}
                <button
                  onClick={() => toggleEngine(entry.engine)}
                  className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${entry.enabled ? colors.toggle : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${entry.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>

                {/* Expand */}
                <button onClick={() => setExpandedEngine(isExpanded ? null : entry.engine)}
                  className="text-gray-400 hover:text-gray-600 cursor-pointer">
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
              </div>

              {/* Expanded config */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-1 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    {meta.configFields.map(field => (
                      <div key={field.key}>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">{field.label}</label>
                        <input
                          type={field.type}
                          value={entry.config?.[field.key] || ''}
                          onChange={e => updateConfig(entry.engine, field.key, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ))}

                    {/* Min confidence (only for engines that classify) */}
                    {meta.capabilities.includes('CLASSIFY') && (
                      <div>
                        <label className="text-xs font-medium text-gray-600 mb-1 block">
                          Min Confidence to Accept (%)
                        </label>
                        <input
                          type="number"
                          min="0" max="100"
                          value={entry.minConfidence}
                          onChange={e => updateMinConfidence(entry.engine, e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          Below this threshold, result passes to next engine. 0 = always accept.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Memory note */}
                  {meta.memoryNote && (
                    <p className="text-[10px] text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5 mt-3">
                      {meta.memoryNote}
                    </p>
                  )}

                  {/* Test connection */}
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      onClick={() => handleTestConnection(entry.engine)}
                      disabled={isTesting}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors"
                    >
                      {isTesting ? <Loader2 size={12} className="animate-spin" /> : <Wifi size={12} />}
                      Test Connection
                    </button>
                    {testResult && (
                      <div className={`flex items-center gap-1.5 text-xs ${testResult.success ? 'text-emerald-600' : 'text-red-500'}`}>
                        {testResult.success ? <CheckCircle size={13} /> : <XCircle size={13} />}
                        <span>{testResult.message}</span>
                        {testResult.latencyMs > 0 && (
                          <span className="text-gray-400">({testResult.latencyMs}ms)</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add engine */}
      {missingEngines.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-gray-50 border border-dashed border-gray-300 rounded-xl">
          <select
            value={engineToAdd}
            onChange={e => setEngineToAdd(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select an engine to add…</option>
            {missingEngines.map(key => (
              <option key={key} value={key}>{ENGINE_META[key].name}</option>
            ))}
          </select>
          <button
            onClick={handleAddEngine}
            disabled={!engineToAdd}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-700 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            <Plus size={14} />
            Add Engine
          </button>
        </div>
      )}

      {/* Unsaved changes */}
      {dirty && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
          <span className="text-sm text-amber-700">Pipeline configuration has unsaved changes.</span>
          <button
            onClick={handleSave}
            disabled={bulkUpdate.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            {bulkUpdate.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save Pipeline
          </button>
        </div>
      )}
    </div>
  )
}
