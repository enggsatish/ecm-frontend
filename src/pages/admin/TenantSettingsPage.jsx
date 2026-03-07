import { useState, useEffect } from 'react';
import { Loader2, Save, Globe, Mail, Palette, Image, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTenantConfig, useBulkUpdateConfig } from '../../hooks/useAdmin';

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Vancouver',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
];

const CONFIG_FIELDS = [
  {
    key: 'tenant.name',
    label: 'Tenant / Organisation Name',
    type: 'text',
    icon: Globe,
    placeholder: 'Acme Financial Services',
    description: 'Displayed in the application header and emails',
  },
  {
    key: 'tenant.logo_url',
    label: 'Logo URL',
    type: 'logo',
    icon: Image,
    placeholder: 'https://cdn.example.com/logo.png',
    description: 'Public URL for your organisation logo (PNG, SVG recommended)',
  },
  {
    key: 'tenant.primary_color',
    label: 'Primary Brand Colour',
    type: 'color',
    icon: Palette,
    description: 'Used for buttons, highlights, and brand accents',
  },
  {
    key: 'tenant.support_email',
    label: 'Support Email',
    type: 'email',
    icon: Mail,
    placeholder: 'support@example.com',
    description: 'Shown to users for help and contact',
  },
  {
    key: 'tenant.timezone',
    label: 'Default Timezone',
    type: 'timezone',
    icon: Clock,
    description: 'Used for document timestamps and scheduled jobs',
  },
];

// Extract value from ApiResponse config shape
function extractValue(configData, key) {
  if (!configData) return '';
  // Support both array and map shapes
  if (Array.isArray(configData)) {
    const item = configData.find(c => c.key === key || c.configKey === key);
    return item?.value ?? item?.configValue ?? '';
  }
  return configData[key] ?? '';
}

export default function TenantSettingsPage() {
  const { data: configData, isLoading } = useTenantConfig();
  const bulkUpdate = useBulkUpdateConfig();

  const [values, setValues] = useState({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!configData) return;
    const initial = {};
    CONFIG_FIELDS.forEach(f => {
      initial[f.key] = extractValue(configData, f.key);
    });
    setValues(initial);
    setDirty(false);
  }, [configData]);

  const set = (key, value) => {
    setValues(v => ({ ...v, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    const configs = CONFIG_FIELDS.map(f => ({
      key: f.key,
      value: values[f.key] ?? '',
      description: f.description,
    }));
    bulkUpdate.mutate(configs, {
      onSuccess: () => { toast.success('Settings saved'); setDirty(false); },
      onError: () => toast.error('Failed to save settings'),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading settings…
      </div>
    );
  }

  const primaryColor = values['tenant.primary_color'] || '#2563eb';

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Tenant Settings</h2>
          <p className="text-xs text-gray-500 mt-0.5">White-label configuration and organisation branding</p>
        </div>
        <button
          onClick={handleSave}
          disabled={!dirty || bulkUpdate.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {bulkUpdate.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save All
        </button>
      </div>

      {/* Live preview card */}
      <div className="mb-6 p-4 rounded-xl border-2 border-dashed border-gray-200 bg-white">
        <p className="text-xs text-gray-400 mb-3 uppercase tracking-wider font-semibold">Brand Preview</p>
        <div className="flex items-center gap-3">
          {values['tenant.logo_url'] ? (
            <img
              src={values['tenant.logo_url']}
              alt="Logo preview"
              className="h-10 w-auto object-contain rounded"
              onError={e => { e.target.style.display = 'none'; }}
            />
          ) : (
            <div
              className="h-10 w-10 rounded-lg flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: primaryColor }}
            >
              {(values['tenant.name'] || 'E').charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="text-sm font-semibold text-gray-900">{values['tenant.name'] || 'Your Organisation'}</div>
            <div className="text-xs text-gray-400">{values['tenant.support_email'] || 'support@example.com'}</div>
          </div>
          <div className="ml-auto">
            <span
              className="inline-block px-3 py-1 rounded-full text-xs text-white font-medium"
              style={{ backgroundColor: primaryColor }}
            >
              Sample Button
            </span>
          </div>
        </div>
      </div>

      {/* Settings fields */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
        {CONFIG_FIELDS.map(({ key, label, type, icon: Icon, placeholder, description }) => (
          <div key={key} className="px-5 py-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-1.5 rounded-lg bg-gray-100">
                <Icon size={14} className="text-gray-500" />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-800 mb-0.5">{label}</label>
                <p className="text-xs text-gray-400 mb-2">{description}</p>

                {type === 'color' && (
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={values[key] || '#2563eb'}
                      onChange={e => set(key, e.target.value)}
                      className="h-9 w-16 rounded border border-gray-300 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={values[key] || ''}
                      onChange={e => set(key, e.target.value)}
                      placeholder="#2563eb"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {values[key] && (
                      <div
                        className="h-9 w-9 rounded-lg border border-gray-200 flex-shrink-0"
                        style={{ backgroundColor: values[key] }}
                      />
                    )}
                  </div>
                )}

                {type === 'timezone' && (
                  <select
                    value={values[key] || ''}
                    onChange={e => set(key, e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select timezone…</option>
                    {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                )}

                {type === 'logo' && (
                  <div className="space-y-2">
                    <input
                      type="url"
                      value={values[key] || ''}
                      onChange={e => set(key, e.target.value)}
                      placeholder={placeholder}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {values[key] && (
                      <div className="h-14 w-40 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden p-2">
                        <img
                          src={values[key]}
                          alt="Logo"
                          className="max-h-full max-w-full object-contain"
                          onError={e => { e.target.parentElement.innerHTML = '<span class="text-xs text-gray-400">Invalid URL</span>'; }}
                        />
                      </div>
                    )}
                  </div>
                )}

                {(type === 'text' || type === 'email') && (
                  <input
                    type={type}
                    value={values[key] || ''}
                    onChange={e => set(key, e.target.value)}
                    placeholder={placeholder}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {dirty && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
          <span className="text-sm text-amber-700">You have unsaved changes.</span>
          <button
            onClick={handleSave}
            disabled={bulkUpdate.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {bulkUpdate.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save All
          </button>
        </div>
      )}
    </div>
  );
}