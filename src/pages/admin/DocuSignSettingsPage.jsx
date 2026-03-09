/**
 * DocuSignSettingsPage.jsx
 * Route: /admin/integrations/docusign
 * Role: ECM_ADMIN
 *
 * DocuSign integration configuration with field masking for sensitive values.
 */
import { useState, useEffect } from 'react'
import { Save, TestTube2, CheckCircle2, XCircle, Loader2, Eye, EyeOff, AlertTriangle, Info } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { getDocuSignConfig, saveDocuSignConfig, testDocuSignConnection } from '../../api/adminApi'

const MASKED = '*** saved ***'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function isMasked(v) { return v === MASKED }

function FieldRow({ label, hint, children }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 py-4 border-b border-gray-100 last:border-0">
      <div className="sm:col-span-1">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {hint && <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      <div className="sm:col-span-2">{children}</div>
    </div>
  )
}

function TextInput({ value, onChange, placeholder, monospace = false, disabled = false }) {
  return (
    <input
      type="text"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`w-full rounded-lg border border-gray-200 px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400
                  disabled:bg-gray-50 disabled:text-gray-400
                  ${monospace ? 'font-mono' : ''}`}
    />
  )
}

function SecretInput({ label, fieldKey, form, onChange }) {
  const [show, setShow] = useState(false)
  const value = form[fieldKey] ?? ''
  const masked = isMasked(value)

  return (
    <div className="relative">
      <input
        type={show && !masked ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(fieldKey, e.target.value)}
        placeholder={masked ? MASKED : `Enter ${label}`}
        className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm
                   font-mono focus:outline-none focus:ring-2 focus:ring-blue-200
                   focus:border-blue-400"
      />
      {!masked && (
        <button
          type="button"
          onClick={() => setShow(v => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
      )}
      {masked && (
        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
          <CheckCircle2 size={11} className="text-green-500" />
          Value saved — paste a new value to replace it
        </p>
      )}
    </div>
  )
}

function TestStatusBadge({ status, testedAt }) {
  if (!status) return null
  const ok = status === 'OK'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                      ${ok ? 'bg-green-100 text-green-700 border border-green-200'
                           : 'bg-red-100 text-red-600 border border-red-200'}`}>
      {ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      {ok ? 'Connected' : 'Failed'}
      {testedAt && (
        <span className="text-xs opacity-60 ml-0.5">
          · {new Date(testedAt).toLocaleTimeString()}
        </span>
      )}
    </span>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════════════
export default function DocuSignSettingsPage() {
  const qc = useQueryClient()

  const { data: cfg, isLoading } = useQuery({
    queryKey: ['admin', 'integrations', 'docusign'],
    queryFn:  getDocuSignConfig,
    staleTime: 60_000,
  })

  const [form, setForm] = useState({
    enabled:           false,
    baseUrl:           '',
    authServer:        '',
    accountId:         '',
    integrationKey:    '',
    impersonatedUserId: '',
    rsaPrivateKey:     '',
    webhookHmacSecret: '',
  })

  // Populate form when data loads
  useEffect(() => {
    if (!cfg) return
    setForm({
      enabled:            cfg.enabled            ?? false,
      baseUrl:            cfg.baseUrl            ?? '',
      authServer:         cfg.authServer         ?? 'https://account-d.docusign.com',
      accountId:          cfg.accountId          ?? '',
      integrationKey:     cfg.integrationKey     ?? '',
      impersonatedUserId: cfg.impersonatedUserId ?? '',
      rsaPrivateKey:      cfg.rsaPrivateKey      ?? '',
      webhookHmacSecret:  cfg.webhookHmacSecret  ?? '',
    })
  }, [cfg])

  const saveMut = useMutation({
    mutationFn: saveDocuSignConfig,
    onSuccess: () => {
      toast.success('DocuSign configuration saved')
      qc.invalidateQueries({ queryKey: ['admin', 'integrations', 'docusign'] })
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Save failed'),
  })

  const testMut = useMutation({
    mutationFn: testDocuSignConnection,
    onSuccess: (result) => {
      if (result?.success) {
        toast.success(result.message ?? 'Connection successful')
      } else {
        toast.error(result?.message ?? 'Connection test failed')
      }
      qc.invalidateQueries({ queryKey: ['admin', 'integrations', 'docusign'] })
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Test request failed'),
  })

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const updateSecret = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const handleSave = () => saveMut.mutate(form)
  const handleTest = () => testMut.mutate()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  const isSandbox = form.baseUrl?.includes('demo.docusign') || !form.baseUrl

  return (
    <div className="max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">DocuSign Integration</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure JWT grant authentication for e-signature workflows
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <TestStatusBadge status={cfg?.testStatus} testedAt={cfg?.testedAt} />
        </div>
      </div>

      {/* Sandbox notice */}
      {isSandbox && (
        <div className="flex gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <Info size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <strong>Sandbox mode detected.</strong> Using{' '}
            <code className="text-xs bg-amber-100 px-1 rounded">demo.docusign.net</code> and{' '}
            <code className="text-xs bg-amber-100 px-1 rounded">account-d.docusign.com</code>{' '}
            for testing. Change base URL to production before go-live.
          </div>
        </div>
      )}

      {/* Enable toggle */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">Enable DocuSign Integration</p>
            <p className="text-xs text-gray-400 mt-0.5">
              When disabled, DocuSign steps in workflows are skipped and forms move straight to review
            </p>
          </div>
          <button
            onClick={() => update('enabled', !form.enabled)}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0
                        ${form.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow
                              transition-transform ${form.enabled ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      </div>

      {/* Config fields */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 divide-y divide-gray-100">
        <div className="py-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">API Endpoints</h3>
        </div>

        <FieldRow label="Base URL" hint="DocuSign REST API base URL">
          <TextInput
            value={form.baseUrl}
            onChange={v => update('baseUrl', v)}
            placeholder="https://demo.docusign.net"
            monospace
          />
        </FieldRow>

        <FieldRow label="Auth Server" hint="OAuth2 authorization server URL">
          <TextInput
            value={form.authServer}
            onChange={v => update('authServer', v)}
            placeholder="https://account-d.docusign.com"
            monospace
          />
        </FieldRow>

        <div className="py-3 pt-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">JWT Grant Credentials</h3>
        </div>

        <FieldRow label="Account ID" hint="DocuSign account UUID">
          <TextInput
            value={form.accountId}
            onChange={v => update('accountId', v)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            monospace
          />
        </FieldRow>

        <FieldRow label="Integration Key" hint="OAuth client ID (from DocuSign admin)">
          <TextInput
            value={form.integrationKey}
            onChange={v => update('integrationKey', v)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            monospace
          />
        </FieldRow>

        <FieldRow label="Impersonated User ID" hint="GUID of the DocuSign user for JWT impersonation">
          <TextInput
            value={form.impersonatedUserId}
            onChange={v => update('impersonatedUserId', v)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            monospace
          />
        </FieldRow>

        <div className="py-3 pt-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Secrets <span className="normal-case font-normal text-gray-400">(AES-256 encrypted at rest)</span>
          </h3>
        </div>

        <FieldRow
          label="RSA Private Key"
          hint="PEM private key for JWT grant. Never logged or returned in GET."
        >
          <SecretInput
            label="RSA Private Key"
            fieldKey="rsaPrivateKey"
            form={form}
            onChange={updateSecret}
          />
        </FieldRow>

        <FieldRow
          label="Webhook HMAC Secret"
          hint="Shared secret for validating DocuSign Connect webhook signatures."
        >
          <SecretInput
            label="HMAC Secret"
            fieldKey="webhookHmacSecret"
            form={form}
            onChange={updateSecret}
          />
        </FieldRow>
      </div>

      {/* DocuSign Connect webhook URL */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl px-5 py-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          DocuSign Connect Webhook URL
        </p>
        <code className="text-xs text-gray-700 bg-white border border-gray-200 rounded-lg px-3 py-2 block">
          POST https://your-ecm-domain.com/api/eforms/docusign/webhook
        </code>
        <p className="text-xs text-gray-400 mt-2">
          Add this URL in DocuSign Admin → Connect → Add Configuration.
          Enable "Envelope Completed" event. Copy the HMAC Secret from DocuSign
          and paste it in the field above.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleTest}
          disabled={testMut.isPending || !form.enabled}
          className="flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2
                     text-sm font-medium text-gray-700 hover:bg-gray-50
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {testMut.isPending
            ? <Loader2 size={15} className="animate-spin" />
            : <TestTube2 size={15} />}
          Test Connection
        </button>

        <button
          onClick={handleSave}
          disabled={saveMut.isPending}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2
                     text-sm font-semibold text-white hover:bg-blue-700
                     disabled:opacity-50 shadow-sm transition-colors"
        >
          {saveMut.isPending
            ? <Loader2 size={15} className="animate-spin" />
            : <Save size={15} />}
          Save Configuration
        </button>
      </div>

      {/* Security note */}
      <div className="flex gap-2 text-xs text-gray-400 pb-4">
        <AlertTriangle size={13} className="flex-shrink-0 mt-0.5 text-amber-400" />
        Secrets are encrypted using AES-256-GCM before storage. The RSA private key
        is never returned to the browser after saving. Set the{' '}
        <code className="bg-gray-100 px-1 rounded">MASTER_ENCRYPT_KEY</code>{' '}
        environment variable on the ecm-admin service in production.
      </div>
    </div>
  )
}
