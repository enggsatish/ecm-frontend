/**
 * tenantStore.js
 * Loads tenant config from backend on app startup.
 * Applies branding (colors, logo, name) to the UI via CSS variables.
 */
import { create } from 'zustand'
import { getTenantConfig } from '../api/adminApi'

/**
 * Generate a color scale from a hex color.
 * Produces lighter (50-400) and darker (600-900) variants.
 */
function generateScale(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)

  const lighten = (r, g, b, factor) => [
    Math.round(r + (255 - r) * factor),
    Math.round(g + (255 - g) * factor),
    Math.round(b + (255 - b) * factor),
  ]
  const darken = (r, g, b, factor) => [
    Math.round(r * (1 - factor)),
    Math.round(g * (1 - factor)),
    Math.round(b * (1 - factor)),
  ]

  const toHex = ([r, g, b]) =>
    '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')

  return {
    50:  toHex(lighten(r, g, b, 0.90)),
    100: toHex(lighten(r, g, b, 0.80)),
    200: toHex(lighten(r, g, b, 0.60)),
    300: toHex(lighten(r, g, b, 0.40)),
    400: toHex(lighten(r, g, b, 0.20)),
    500: hex,
    600: toHex(darken(r, g, b, 0.15)),
    700: toHex(darken(r, g, b, 0.30)),
    800: toHex(darken(r, g, b, 0.45)),
    900: toHex(darken(r, g, b, 0.60)),
  }
}

function isValidHex(hex) {
  return hex && /^#[0-9a-fA-F]{6}$/.test(hex)
}

function applyColorScale(prefix, hex) {
  if (!isValidHex(hex)) return
  const scale = generateScale(hex)
  const root = document.documentElement
  for (const [shade, color] of Object.entries(scale)) {
    root.style.setProperty(`--color-${prefix}-${shade}`, color)
  }
}

function applySingleVar(varName, value) {
  if (value) document.documentElement.style.setProperty(varName, value)
}

function extractValue(data, key) {
  if (!data) return ''
  if (Array.isArray(data)) {
    const item = data.find(c => c.key === key || c.configKey === key)
    return item?.value ?? item?.configValue ?? ''
  }
  return data[key] ?? ''
}

const DEFAULTS = {
  name: 'ECM Platform',
  logoUrl: '',
  supportEmail: '',
  timezone: 'UTC',
  sidebarBg: '#002347',
  sidebarActive: '#00A651',
  headerBg: '#ffffff',
  headerText: '#111827',
  accent: '#4f46e5',
  pageBg: '#f4f6f9',
}

function applyTheme(state) {
  // Sidebar background → primary-* scale
  applyColorScale('primary', state.sidebarBg)
  // Sidebar active → accent-* scale
  applyColorScale('accent', state.sidebarActive)
  // Main content accent → used for buttons, links etc via --color-theme-*
  applyColorScale('theme', state.accent)
  // Single values
  applySingleVar('--color-header-bg', state.headerBg)
  applySingleVar('--color-header-text', state.headerText)
  applySingleVar('--color-page-bg', state.pageBg)
}

const useTenantStore = create((set) => ({
  ...DEFAULTS,
  loaded: false,

  loadConfig: async () => {
    try {
      const data = await getTenantConfig()
      const state = {
        name:          extractValue(data, 'tenant.name') || DEFAULTS.name,
        logoUrl:       extractValue(data, 'tenant.logo_url') || DEFAULTS.logoUrl,
        supportEmail:  extractValue(data, 'tenant.support_email') || DEFAULTS.supportEmail,
        timezone:      extractValue(data, 'tenant.timezone') || DEFAULTS.timezone,
        sidebarBg:     extractValue(data, 'theme.sidebar_bg') || DEFAULTS.sidebarBg,
        sidebarActive: extractValue(data, 'theme.sidebar_active') || DEFAULTS.sidebarActive,
        headerBg:      extractValue(data, 'theme.header_bg') || DEFAULTS.headerBg,
        headerText:    extractValue(data, 'theme.header_text') || DEFAULTS.headerText,
        accent:        extractValue(data, 'theme.accent') || DEFAULTS.accent,
        pageBg:        extractValue(data, 'theme.page_bg') || DEFAULTS.pageBg,
        loaded: true,
      }

      applyTheme(state)
      set(state)
    } catch (e) {
      console.warn('Failed to load tenant config:', e.message)
      set({ loaded: true })
    }
  },
}))

export default useTenantStore
