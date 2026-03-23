import { useState, useEffect } from 'react';
import { Loader2, Save, Globe, Mail, Image, Clock, RotateCcw, PanelLeft, MousePointer, Type, LayoutDashboard, Palette } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTenantConfig, useBulkUpdateConfig, useResetConfigToDefaults } from '../../hooks/useAdmin';
import useTenantStore from '../../store/tenantStore';

const TIMEZONES = [
  'UTC',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'America/Vancouver',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Amsterdam',
  'Asia/Dubai', 'Asia/Kolkata', 'Asia/Singapore', 'Asia/Tokyo',
  'Australia/Sydney', 'Pacific/Auckland',
];

// ── Config field definitions grouped into sections ──────────────────────────
const SECTIONS = [
  {
    title: 'Organisation',
    description: 'General tenant identity and contact',
    fields: [
      { key: 'tenant.name',          label: 'Organisation Name',  type: 'text',     icon: Globe,    placeholder: 'Acme Financial Services', description: 'Displayed in sidebar and emails' },
      { key: 'tenant.logo_url',      label: 'Logo URL',           type: 'logo',     icon: Image,    placeholder: 'https://cdn.example.com/logo.png', description: 'Public URL (PNG, SVG recommended)' },
      { key: 'tenant.support_email', label: 'Support Email',      type: 'email',    icon: Mail,     placeholder: 'support@example.com', description: 'Shown to users for help and contact' },
      { key: 'tenant.timezone',      label: 'Default Timezone',   type: 'timezone', icon: Clock,    description: 'Used for document timestamps and scheduled jobs' },
    ],
  },
  {
    title: 'Navigation & Header',
    description: 'Sidebar and header bar appearance',
    fields: [
      { key: 'theme.sidebar_bg',     label: 'Sidebar Background',    type: 'color', icon: PanelLeft,     description: 'Sidebar gradient base colour' },
      { key: 'theme.sidebar_active', label: 'Sidebar Active Item',   type: 'color', icon: MousePointer,  description: 'Active nav highlight and badges' },
      { key: 'theme.header_bg',      label: 'Header Background',     type: 'color', icon: LayoutDashboard, description: 'Top header bar background' },
      { key: 'theme.header_text',    label: 'Header Text',           type: 'color', icon: Type,          description: 'Header title and date text colour' },
    ],
  },
  {
    title: 'Main Content',
    description: 'Buttons, links, and page background',
    fields: [
      { key: 'theme.accent',   label: 'Accent Colour',     type: 'color', icon: Palette,         description: 'Buttons, links, focus rings, active states' },
      { key: 'theme.page_bg',  label: 'Page Background',   type: 'color', icon: LayoutDashboard, description: 'Main content area background' },
    ],
  },
];

const ALL_FIELDS = SECTIONS.flatMap(s => s.fields);

function extractValue(configData, key) {
  if (!configData) return '';
  if (Array.isArray(configData)) {
    const item = configData.find(c => c.key === key || c.configKey === key);
    return item?.value ?? item?.configValue ?? '';
  }
  return configData[key] ?? '';
}

function extractDefault(configData, key) {
  if (!configData || !Array.isArray(configData)) return '';
  const item = configData.find(c => c.key === key || c.configKey === key);
  return item?.defaultValue ?? '';
}

export default function TenantSettingsPage() {
  const { data: configData, isLoading } = useTenantConfig();
  const bulkUpdate = useBulkUpdateConfig();
  const resetMutation = useResetConfigToDefaults();
  const reloadTenant = useTenantStore(s => s.loadConfig);

  const [values, setValues] = useState({});
  const [dirty, setDirty] = useState(false);

  // Build defaults map from backend data
  const defaults = {};
  if (configData && Array.isArray(configData)) {
    configData.forEach(c => { if (c.key) defaults[c.key] = c.defaultValue ?? ''; });
  }
  const hasNonDefault = ALL_FIELDS.some(f => defaults[f.key] !== undefined && values[f.key] !== defaults[f.key]);

  useEffect(() => {
    if (!configData) return;
    const initial = {};
    ALL_FIELDS.forEach(f => {
      initial[f.key] = extractValue(configData, f.key);
    });
    setValues(initial);
    setDirty(false);
  }, [configData]);

  const set = (key, value) => {
    setValues(v => ({ ...v, [key]: value }));
    setDirty(true);
  };

  const handleReset = () => {
    if (!confirm('Reset all settings to their default values? This cannot be undone.')) return;
    resetMutation.mutate(undefined, {
      onSuccess: () => { toast.success('Settings reset to defaults'); setDirty(false); reloadTenant(); },
      onError: () => toast.error('Failed to reset settings'),
    });
  };

  const handleSave = () => {
    const configs = ALL_FIELDS.map(f => ({
      key: f.key,
      value: values[f.key] ?? '',
      description: f.description,
    }));
    bulkUpdate.mutate(configs, {
      onSuccess: () => { toast.success('Settings saved'); setDirty(false); reloadTenant(); },
      onError: () => toast.error('Failed to save settings'),
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 size={20} className="animate-spin mr-2" /> Loading settings...
      </div>
    );
  }

  const sidebarBg     = values['theme.sidebar_bg'] || '#002347';
  const sidebarActive = values['theme.sidebar_active'] || '#00A651';
  const headerBg      = values['theme.header_bg'] || '#ffffff';
  const headerText    = values['theme.header_text'] || '#111827';
  const accent        = values['theme.accent'] || '#4f46e5';
  const pageBg        = values['theme.page_bg'] || '#f4f6f9';
  const orgName       = values['tenant.name'] || 'Organisation';
  const logoUrl       = values['tenant.logo_url'] || '';

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Tenant Settings</h2>
          <p className="text-xs text-gray-500 mt-0.5">White-label configuration and organisation branding</p>
        </div>
        <div className="flex items-center gap-2">
          {hasNonDefault && (
            <button
              onClick={handleReset}
              disabled={resetMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {resetMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              Reset to Defaults
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={!dirty || bulkUpdate.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            {bulkUpdate.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save All
          </button>
        </div>
      </div>

      {/* Two-column: settings left, preview right (sticky) */}
      <div className="flex gap-6 items-start">

      {/* Left: Settings (scrollable) */}
      <div className="flex-1 min-w-0 space-y-6">
        {SECTIONS.map(section => (
          <div key={section.title}>
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-gray-800">{section.title}</h3>
              <p className="text-xs text-gray-400">{section.description}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
              {section.fields.map(({ key, label, type, icon: Icon, placeholder, description }) => {
                const isModified = defaults[key] !== undefined && values[key] !== defaults[key];

                // ── Color fields: compact single-row layout ──
                if (type === 'color') {
                  return (
                    <div key={key} className="px-4 py-2.5 flex items-center gap-3">
                      <input
                        type="color"
                        value={values[key] || '#000000'}
                        onChange={e => set(key, e.target.value)}
                        className="h-8 w-10 rounded border border-gray-300 cursor-pointer p-0.5 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-gray-800">{label}</span>
                          {isModified && (
                            <span className="text-[9px] font-medium text-amber-600 bg-amber-50 px-1 py-px rounded">modified</span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 leading-tight">{description}</p>
                      </div>
                      <input
                        type="text"
                        value={values[key] || ''}
                        onChange={e => set(key, e.target.value)}
                        placeholder="#000000"
                        className="w-24 border border-gray-200 rounded-md px-2 py-1.5 text-xs font-mono text-gray-600 focus:outline-none focus:border-blue-400 flex-shrink-0"
                      />
                      {isModified && defaults[key] && (
                        <button
                          onClick={() => set(key, defaults[key])}
                          className="text-gray-300 hover:text-gray-600 cursor-pointer flex-shrink-0"
                          title={`Reset to default: ${defaults[key]}`}
                        >
                          <RotateCcw size={13} />
                        </button>
                      )}
                    </div>
                  );
                }

                // ── Non-color fields: full layout with icon ──
                return (
                  <div key={key} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 p-1.5 rounded-lg bg-gray-100">
                        <Icon size={14} className="text-gray-500" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <label className="text-sm font-medium text-gray-800">{label}</label>
                          {isModified && (
                            <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">modified</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mb-2">{description}</p>

                        {type === 'timezone' && (
                          <select
                            value={values[key] || ''}
                            onChange={e => set(key, e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select timezone...</option>
                            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                          </select>
                        )}

                        {type === 'logo' && (
                          <div className="flex items-center gap-3">
                            <input
                              type="url"
                              value={values[key] || ''}
                              onChange={e => set(key, e.target.value)}
                              placeholder={placeholder}
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            {values[key] && (
                              <div className="h-10 w-10 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                                <img src={values[key]} alt="Logo" className="max-h-full max-w-full object-contain"
                                  onError={e => { e.target.style.display = 'none'; }} />
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
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Right: Sticky live preview */}
      <div className="w-72 flex-shrink-0 sticky top-6">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Live Preview</p>
          </div>

          {/* App mockup */}
          <div className="m-3 rounded-lg overflow-hidden border border-gray-200 shadow-sm" style={{ height: 280 }}>
            <div className="flex h-full">
              {/* Sidebar mock */}
              <div className="w-12 flex flex-col items-center pt-3 pb-2 gap-2 flex-shrink-0"
                   style={{ background: `linear-gradient(180deg, ${sidebarBg} 0%, ${sidebarBg}e6 100%)` }}>
                {logoUrl ? (
                  <img src={logoUrl} alt="" className="w-7 h-7 rounded-full object-cover bg-white/10"
                       onError={e => { e.target.style.display = 'none'; }} />
                ) : (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                       style={{ backgroundColor: sidebarActive }}>
                    {orgName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="w-7 h-5 rounded" style={{ backgroundColor: sidebarActive }} />
                <div className="w-7 h-4 rounded bg-white/10" />
                <div className="w-7 h-4 rounded bg-white/10" />
                <div className="w-7 h-4 rounded bg-white/10" />
                <div className="mt-auto w-7 h-4 rounded bg-white/10" />
              </div>

              {/* Main area */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Header mock */}
                <div className="h-8 flex items-center justify-between px-3 border-b border-gray-200 flex-shrink-0"
                     style={{ backgroundColor: headerBg }}>
                  <span className="text-[9px] font-bold truncate" style={{ color: headerText }}>
                    {orgName}
                  </span>
                  <div className="w-4 h-4 rounded-full bg-gray-200 flex-shrink-0" />
                </div>

                {/* Content mock */}
                <div className="flex-1 p-3 space-y-2" style={{ backgroundColor: pageBg }}>
                  {/* Card */}
                  <div className="bg-white rounded-md border border-gray-200 p-2.5 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1 h-3 rounded-full" style={{ backgroundColor: accent }} />
                      <div className="h-2 w-16 rounded bg-gray-200" />
                    </div>
                    <div className="h-1.5 w-full rounded bg-gray-100" />
                    <div className="h-1.5 w-3/4 rounded bg-gray-100" />
                  </div>

                  {/* Buttons */}
                  <div className="flex gap-1.5">
                    <div className="px-2.5 py-1 rounded text-[8px] text-white font-medium"
                         style={{ backgroundColor: accent }}>
                      Save
                    </div>
                    <div className="px-2.5 py-1 rounded text-[8px] font-medium border"
                         style={{ borderColor: accent, color: accent }}>
                      Cancel
                    </div>
                  </div>

                  {/* Table mock */}
                  <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
                    <div className="h-5 border-b border-gray-100 flex items-center px-2 gap-3">
                      <div className="h-1.5 w-10 rounded bg-gray-200" />
                      <div className="h-1.5 w-14 rounded bg-gray-200" />
                      <div className="h-1.5 w-8 rounded bg-gray-200" />
                    </div>
                    {[0,1,2].map(i => (
                      <div key={i} className="h-5 border-b border-gray-50 flex items-center px-2 gap-3">
                        <div className="h-1.5 w-10 rounded bg-gray-100" />
                        <span className="text-[7px]" style={{ color: accent }}>link</span>
                        <div className="h-1.5 w-8 rounded bg-gray-100" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Support email preview */}
          {values['tenant.support_email'] && (
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
              <p className="text-[10px] text-gray-400">Support: {values['tenant.support_email']}</p>
            </div>
          )}
        </div>
      </div>

      </div>

      {/* Unsaved changes bar */}
      {dirty && (
        <div className="mt-6 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
          <span className="text-sm text-amber-700">You have unsaved changes.</span>
          <button
            onClick={handleSave}
            disabled={bulkUpdate.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
          >
            {bulkUpdate.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            Save All
          </button>
        </div>
      )}
    </div>
  );
}
