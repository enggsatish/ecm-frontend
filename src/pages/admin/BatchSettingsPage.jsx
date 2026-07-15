/**
 * BatchSettingsPage.jsx
 * Batch processing configuration — watch folder + processing thresholds only.
 * Role assignments are managed in Administration > People & Access > Roles & Permissions.
 * Notification settings are managed in Administration > Processing > Notifications.
 */
import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Settings, Save, Loader2, AlertCircle, FolderOpen, Sliders,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { getBatchConfig, saveBatchConfig } from '../../api/batchApi'

const inputCls = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400'
const selectCls = 'rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1'
const hintCls = 'text-xs text-gray-400 mt-1'

function Toggle({ value, onChange, label, hint }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                   ${value ? 'bg-blue-600' : 'bg-gray-200'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm
                         ${value ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  )
}

function SectionHeader({ icon: Icon, title, description }) {
  return (
    <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
      <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50">
        <Icon className="w-4.5 h-4.5 text-blue-600" size={18} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
    </div>
  )
}

export default function BatchSettingsPage() {
  const qc = useQueryClient()

  const { data: config, isLoading, isError, error } = useQuery({
    queryKey: ['batch-config-all'],
    queryFn: getBatchConfig,
  })

  const [form, setForm] = useState({
    watchFolder: {
      enabled: false,
      watchPath: '',
      processedPath: '',
      failedPath: '',
      pollIntervalSeconds: 300,
    },
    confidenceThreshold: '90.0',
    maxBatchSize: '500',
    autoCreateFolders: 'true',
  })

  useEffect(() => {
    if (!config) return
    setForm({
      watchFolder: {
        enabled: config.watchFolder?.enabled ?? false,
        watchPath: config.watchFolder?.watchPath ?? '',
        processedPath: config.watchFolder?.processedPath ?? '',
        failedPath: config.watchFolder?.failedPath ?? '',
        pollIntervalSeconds: config.watchFolder?.pollIntervalSeconds ?? 300,
      },
      confidenceThreshold: config.confidenceThreshold ?? '90.0',
      maxBatchSize: config.maxBatchSize ?? '500',
      autoCreateFolders: config.autoCreateFolders ?? 'true',
    })
  }, [config])

  const saveMutation = useMutation({
    mutationFn: saveBatchConfig,
    onSuccess: () => {
      toast.success('Batch settings saved')
      qc.invalidateQueries({ queryKey: ['batch-config-all'] })
    },
    onError: (err) => toast.error(`Save failed: ${err.message}`),
  })

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }))
  const updateWatchFolder = (field, value) =>
    setForm(prev => ({ ...prev, watchFolder: { ...prev.watchFolder, [field]: value } }))

  const handleSave = (e) => {
    e.preventDefault()
    saveMutation.mutate(form)
  }

  if (isLoading) {
    return (
      <div className="py-20 text-center">
        <Loader2 size={28} className="animate-spin text-gray-400 mx-auto" />
        <p className="text-sm text-gray-400 mt-3">Loading batch settings...</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="py-16 text-center">
        <AlertCircle size={28} className="text-red-400 mx-auto mb-2" />
        <p className="text-sm font-medium text-gray-700">Failed to load batch settings</p>
        <p className="text-xs text-gray-400 mt-1">{error?.message}</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            Batch Processing Settings
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure watch folders and auto-classification thresholds
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
        <AlertCircle size={16} className="text-blue-500 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-700 leading-relaxed">
          <p><strong>Role assignments</strong> for batch processing are managed in
            <strong> Administration &gt; People &amp; Access &gt; Roles &amp; Permissions</strong>.
            Assign <code className="bg-blue-100 px-1 rounded">batch:review</code>,
            <code className="bg-blue-100 px-1 rounded">batch:spot_check</code>, or
            <code className="bg-blue-100 px-1 rounded">batch:admin</code> to any role.
          </p>
          <p className="mt-1"><strong>Notification preferences</strong> for batch events are managed in
            <strong> Administration &gt; Processing &gt; Notifications</strong>.
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">

        {/* Section 1: Watch Folder */}
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-6 space-y-5">
          <SectionHeader icon={FolderOpen} title="Watch Folder"
            description="Monitor a directory for incoming scanned documents" />

          <Toggle
            value={form.watchFolder.enabled}
            onChange={(v) => updateWatchFolder('enabled', v)}
            label="Enable Watch Folder"
            hint="Automatically ingest files from the monitored directory"
          />

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className={labelCls}>Incoming Folder Path</label>
              <input type="text" value={form.watchFolder.watchPath}
                onChange={(e) => updateWatchFolder('watchPath', e.target.value)}
                placeholder="/data/scanner/incoming" className={inputCls} />
              <p className={hintCls}>Directory where branch scanners deposit files</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Processed Path</label>
                <input type="text" value={form.watchFolder.processedPath}
                  onChange={(e) => updateWatchFolder('processedPath', e.target.value)}
                  placeholder="/data/scanner/processed" className={inputCls} />
                <p className={hintCls}>Successfully processed files move here</p>
              </div>
              <div>
                <label className={labelCls}>Failed Path</label>
                <input type="text" value={form.watchFolder.failedPath}
                  onChange={(e) => updateWatchFolder('failedPath', e.target.value)}
                  placeholder="/data/scanner/failed" className={inputCls} />
                <p className={hintCls}>Failed files move here for manual review</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Poll Interval (seconds)</label>
                <input type="number" min="10" max="3600"
                  value={form.watchFolder.pollIntervalSeconds}
                  onChange={(e) => updateWatchFolder('pollIntervalSeconds', parseInt(e.target.value, 10) || 300)}
                  className={`${selectCls} w-32`} />
                <p className={hintCls}>How often to check for new files</p>
              </div>
              <div>
                <Toggle
                  value={form.autoCreateFolders === 'true'}
                  onChange={(v) => updateField('autoCreateFolders', String(v))}
                  label="Auto-create directories"
                  hint="Create processed/failed folders if they don't exist"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Processing Thresholds */}
        <div className="rounded-xl border border-gray-100 bg-white shadow-sm p-6 space-y-5">
          <SectionHeader icon={Sliders} title="Processing Thresholds"
            description="Control auto-classification confidence and batch limits" />

          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className={labelCls}>Auto-file Confidence Threshold (%)</label>
              <div className="flex items-center gap-3">
                <input type="range" min="50" max="100" step="1"
                  value={parseFloat(form.confidenceThreshold)}
                  onChange={(e) => updateField('confidenceThreshold', e.target.value)}
                  className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                <span className="text-sm font-bold text-blue-600 tabular-nums w-12 text-right">
                  {parseFloat(form.confidenceThreshold).toFixed(0)}%
                </span>
              </div>
              <p className={hintCls}>
                Documents with both category and customer confidence above this threshold
                are auto-filed without human review
              </p>
            </div>

            <div>
              <label className={labelCls}>Max Batch Size</label>
              <input type="number" min="10" max="5000"
                value={form.maxBatchSize}
                onChange={(e) => updateField('maxBatchSize', e.target.value)}
                className={`${selectCls} w-32`} />
              <p className={hintCls}>Maximum files per batch upload</p>
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-gray-400">
            Changes take effect immediately — no service restart required
          </p>
          <button type="submit" disabled={saveMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5
                       text-sm font-medium text-white shadow-sm hover:bg-blue-700
                       disabled:opacity-50 transition-colors">
            {saveMutation.isPending
              ? <Loader2 size={14} className="animate-spin" />
              : <Save size={14} />}
            Save Settings
          </button>
        </div>
      </form>
    </div>
  )
}
