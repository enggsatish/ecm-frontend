/**
 * SalesforceSettingsPage.jsx
 * Tab within IntegrationsPage.
 *
 * Salesforce CRM connection — OAuth 2.0 Client Credentials flow. Powers
 * live customer-profile lookup for CRM-aware form fill (Customer 360 +
 * prefilled forms). No customer data is synced or stored — every profile
 * view/fill queries Salesforce directly.
 */
import { useState, useEffect } from 'react'
import { Save, TestTube2, CheckCircle2, XCircle, Loader2, Eye, EyeOff, AlertTriangle, Info } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { getSalesforceConfig, saveSalesforceConfig, testSalesforceConnection } from '../../api/adminApi'

const MASKED = '*** saved ***'
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

function TextInput({ value, onChange, placeholder, monospace = false }) {
  return (
    <input
      type="text"
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-lg border border-gray-200 px-3 py-2 text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400
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
        <button type="button" onClick={() => setShow(v => !v)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
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
  if (!status || status === 'UNTESTED') return null
  const ok = status === 'OK'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
                      ${ok ? 'bg-green-100 text-green-700 border border-green-200'
                           : 'bg-red-100 text-red-600 border border-red-200'}`}>
      {ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      {ok ? 'Connected' : 'Failed'}
      {testedAt && <span className="text-xs opacity-60 ml-0.5">· {new Date(testedAt).toLocaleTimeString()}</span>}
    </span>
  )
}

export default function SalesforceSettingsPage() {
  const qc = useQueryClient()

  const { data: cfg, isLoading } = useQuery({
    queryKey: ['admin', 'integrations', 'salesforce'],
    queryFn: getSalesforceConfig,
    staleTime: 60_000,
  })

  const [form, setForm] = useState({
    enabled: false, loginUrl: '', clientId: '', contactLookupField: '', clientSecret: '',
  })

  useEffect(() => {
    if (!cfg) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm({
      enabled: cfg.enabled ?? false,
      loginUrl: cfg.loginUrl ?? 'https://login.salesforce.com',
      clientId: cfg.clientId ?? '',
      contactLookupField: cfg.contactLookupField ?? '',
      clientSecret: cfg.clientSecret ?? '',
    })
  }, [cfg])

  const saveMut = useMutation({
    mutationFn: saveSalesforceConfig,
    onSuccess: () => {
      toast.success('Salesforce configuration saved')
      qc.invalidateQueries({ queryKey: ['admin', 'integrations', 'salesforce'] })
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Save failed'),
  })

  const testMut = useMutation({
    mutationFn: testSalesforceConnection,
    onSuccess: (result) => {
      if (result?.success) toast.success(result.message ?? 'Connection successful')
      else toast.error(result?.message ?? 'Connection test failed')
      qc.invalidateQueries({ queryKey: ['admin', 'integrations', 'salesforce'] })
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? 'Test request failed'),
  })

  const update = (key, val) => setForm(f => ({ ...f, [key]: val }))
  const handleSave = () => saveMut.mutate(form)
  const handleTest = () => testMut.mutate()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-end">
        <TestStatusBadge status={cfg?.testStatus} testedAt={cfg?.testedAt} />
      </div>

      <div className="flex gap-2.5 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <Info size={16} className="flex-shrink-0 mt-0.5" />
        <div>
          Powers live customer-profile lookup for CRM-aware form fill (Customer 360 and
          prefilled forms). No customer data is ever synced or stored here — every view
          queries Salesforce directly at request time.
        </div>
      </div>

      {/* Enable toggle */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">Enable Salesforce Integration</p>
            <p className="text-xs text-gray-400 mt-0.5">
              When disabled, Customer 360 shows profile fields as "Unavailable" and forms fill blank
            </p>
          </div>
          <button
            onClick={() => update('enabled', !form.enabled)}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0
                        ${form.enabled ? 'bg-blue-600' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow
                              transition-transform ${form.enabled ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      </div>

      {/* Connection */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 divide-y divide-gray-100">
        <div className="py-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Connected App Credentials</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            From a Salesforce Connected App configured for the OAuth 2.0 Client Credentials Flow
          </p>
        </div>

        <FieldRow label="Login URL" hint="Your org's login/instance URL">
          <TextInput value={form.loginUrl} onChange={v => update('loginUrl', v)}
            placeholder="https://login.salesforce.com" monospace />
        </FieldRow>

        <FieldRow label="Client ID" hint="Connected App's Consumer Key">
          <TextInput value={form.clientId} onChange={v => update('clientId', v)}
            placeholder="3MVG9..." monospace />
        </FieldRow>

        <FieldRow label="Client Secret" hint="Connected App's Consumer Secret. Never returned after saving.">
          <SecretInput label="Client Secret" fieldKey="clientSecret" form={form} onChange={update} />
        </FieldRow>

        <div className="py-3 pt-5">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer Lookup</h3>
        </div>

        <FieldRow label="Contact Lookup Field"
          hint="The field on your primary Salesforce object (e.g. Contact) that matches ECM's customer reference ID">
          <TextInput value={form.contactLookupField} onChange={v => update('contactLookupField', v)}
            placeholder="External_Customer_Id__c" monospace />
        </FieldRow>
      </div>

      <div className="flex items-center justify-between">
        <button onClick={handleTest} disabled={testMut.isPending || !form.enabled}
          className="flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2
                     text-sm font-medium text-gray-700 hover:bg-gray-50
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
          {testMut.isPending ? <Loader2 size={15} className="animate-spin" /> : <TestTube2 size={15} />}
          Test Connection
        </button>

        <button onClick={handleSave} disabled={saveMut.isPending}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2
                     text-sm font-semibold text-white hover:bg-blue-700
                     disabled:opacity-50 shadow-sm transition-colors">
          {saveMut.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Save Configuration
        </button>
      </div>

      <div className="flex gap-2 text-xs text-gray-400 pb-4">
        <AlertTriangle size={13} className="flex-shrink-0 mt-0.5 text-amber-400" />
        The Client Secret is encrypted using AES-256-GCM before storage and is never returned
        to the browser after saving. Set the <code className="bg-gray-100 px-1 rounded">MASTER_ENCRYPT_KEY</code>{' '}
        environment variable on the ecm-admin service in production.
      </div>
    </div>
  )
}
