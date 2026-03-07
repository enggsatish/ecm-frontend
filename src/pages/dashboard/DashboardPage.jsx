import { FileText, CheckSquare, Clock, TrendingUp, Loader2, ArrowRight, Shield } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import useUserStore from '../../store/userStore'
import { listDocuments } from '../../api/documentsApi'
import ErrorBoundary from '../../components/common/ErrorBoundary'

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, accent, loading }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm
                    p-5 hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">
            {label}
          </p>
          <p className="text-3xl font-bold text-gray-900">
            {loading
              ? <Loader2 className="w-6 h-6 animate-spin text-gray-200 mt-1" />
              : value}
          </p>
        </div>
        {/* Icon circle */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                         ${accent === 'green'  ? 'bg-accent-50'    : ''}
                         ${accent === 'navy'   ? 'bg-primary-50'   : ''}
                         ${accent === 'amber'  ? 'bg-amber-50'     : ''}
                         ${accent === 'purple' ? 'bg-purple-50'    : ''}`}>
          <Icon className={`w-5 h-5
            ${accent === 'green'  ? 'text-accent-600'  : ''}
            ${accent === 'navy'   ? 'text-primary-600' : ''}
            ${accent === 'amber'  ? 'text-amber-600'   : ''}
            ${accent === 'purple' ? 'text-purple-600'  : ''}`} />
        </div>
      </div>
      {/* Accent bar at bottom */}
      <div className={`mt-4 h-0.5 rounded-full w-12
        ${accent === 'green'  ? 'bg-accent-400'  : ''}
        ${accent === 'navy'   ? 'bg-primary-400' : ''}
        ${accent === 'amber'  ? 'bg-amber-400'   : ''}
        ${accent === 'purple' ? 'bg-purple-400'  : ''}`} />
    </div>
  )
}

// ── Document type badge ────────────────────────────────────────────────────────
function DocTypeBadge({ mime }) {
  const m = mime ?? ''
  if (m.includes('pdf'))    return <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-red-600 bg-red-50">PDF</span>
  if (m.includes('word') || m.includes('document')) return <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-blue-600 bg-blue-50">DOCX</span>
  if (m.includes('sheet') || m.includes('excel'))   return <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-emerald-600 bg-emerald-50">XLSX</span>
  if (m.startsWith('image/')) return <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-purple-600 bg-purple-50">IMG</span>
  return <span className="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-gray-500 bg-gray-100">FILE</span>
}

// ── Recent document row ────────────────────────────────────────────────────────
function RecentDocRow({ doc }) {
  const date = doc.createdAt
    ? new Date(doc.createdAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
    : '—'

  return (
    <div className="flex items-center gap-3 px-5 py-3 border-t border-gray-50
                    hover:bg-gray-50/80 transition-colors group">
      <DocTypeBadge mime={doc.mimeType} />
      <span className="flex-1 text-sm text-gray-700 truncate font-medium">
        {doc.name ?? doc.originalFilename ?? '—'}
      </span>
      {doc.status === 'PENDING_OCR' && (
        <span className="text-[10px] font-semibold text-amber-600 bg-amber-50
                         px-2 py-0.5 rounded-full">Processing</span>
      )}
      <span className="text-xs text-gray-400 whitespace-nowrap">{date}</span>
    </div>
  )
}

// ── Main stats + recent docs ───────────────────────────────────────────────────
function DashboardStats() {
  const { data, isLoading } = useQuery({
    queryKey:     ['documents', { page: 0, size: 5, sort: 'createdAt,desc' }],
    queryFn:      () => listDocuments({ page: 0, size: 5, sort: 'createdAt,desc' }),
    staleTime:    60_000,
    throwOnError: false,
  })

  const total        = data?.totalElements ?? 0
  const recentDocs   = data?.content ?? []
  const pendingCount = recentDocs.filter(d => d.status === 'PENDING_OCR').length

  return (
    <>
      {/* ── Stat cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={FileText}   label="Total Documents" value={total}         accent="navy"   loading={isLoading} />
        <StatCard icon={Clock}      label="Pending OCR"     value={pendingCount}  accent="amber"  loading={isLoading} />
        <StatCard icon={CheckSquare} label="Recent Uploads" value={recentDocs.length} accent="green" loading={isLoading} />
        <StatCard icon={TrendingUp} label="Forms Submitted" value="—"             accent="purple" loading={false} />
      </div>

      {/* ── Content grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Recent documents panel */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4
                          border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <div className="w-1.5 h-5 rounded-full bg-accent-500" />
              <h3 className="font-bold text-gray-900 text-sm">Recent Documents</h3>
            </div>
            <Link to="/documents"
                  className="flex items-center gap-1 text-xs text-accent-600
                             hover:text-accent-700 font-semibold transition-colors">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-gray-200" />
            </div>
          )}

          {!isLoading && recentDocs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center
                              justify-center mb-3">
                <FileText className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-sm font-semibold text-gray-600">No documents yet</p>
              <p className="text-xs text-gray-400 mt-1">Upload your first document to see it here</p>
              <Link to="/documents"
                    className="mt-4 text-xs text-accent-600 font-semibold hover:underline">
                Go to Documents →
              </Link>
            </div>
          )}

          {!isLoading && recentDocs.length > 0 &&
            recentDocs.map(doc => <RecentDocRow key={doc.id} doc={doc} />)
          }
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5">

          {/* My Tasks */}
          <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-1.5 h-5 rounded-full bg-primary-600" />
                <h3 className="font-bold text-gray-900 text-sm">My Tasks</h3>
              </div>
              <Link to="/workflow"
                    className="flex items-center gap-1 text-xs text-primary-600
                               hover:text-primary-700 font-semibold transition-colors">
                View all <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
            <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center
                              justify-center mb-3">
                <CheckSquare className="w-5 h-5 text-gray-300" />
              </div>
              <p className="text-sm font-semibold text-gray-600">All clear</p>
              <p className="text-xs text-gray-400 mt-1">No pending tasks</p>
            </div>
          </div>

          {/* Member info card */}
          <div className="rounded-2xl overflow-hidden"
               style={{ background: 'linear-gradient(135deg, #002347 0%, #003057 100%)' }}>
            <div className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-accent-400" />
                <span className="text-xs font-bold text-white/60 uppercase tracking-widest">
                  Servus ECM
                </span>
              </div>
              <p className="text-white font-bold text-sm leading-snug mb-1">
                Secure Document Platform
              </p>
              <p className="text-white/50 text-xs leading-relaxed">
                All documents are encrypted at rest and protected by role-based access control.
              </p>
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-[10px] text-white/30 italic">
                  Feel good about your money.®
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useUserStore()
  const firstName = user?.displayName?.split(' ')[0] ?? 'there'
  const today = new Date().toLocaleDateString('en-CA', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  return (
    <div className="space-y-5 max-w-7xl mx-auto">

      {/* ── Welcome banner ────────────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden"
           style={{ background: 'linear-gradient(135deg, #002347 0%, #003057 55%, #004a20 100%)' }}>

        {/* Decorative circles — subtle Servus circle motif */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full
                        bg-accent-500/10 pointer-events-none" />
        <div className="absolute -bottom-8 -right-4 w-32 h-32 rounded-full
                        bg-white/5 pointer-events-none" />
        <div className="absolute top-4 right-24 w-6 h-6 rounded-full
                        bg-accent-500/30 pointer-events-none" />

        <div className="relative px-7 py-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-white/50 text-xs font-medium uppercase tracking-widest mb-1">
                {today}
              </p>
              <h2 className="text-2xl font-bold text-white leading-tight">
                Welcome back, {firstName}
              </h2>
              <p className="text-white/50 text-sm mt-1">
                Here's what's happening in your workspace
              </p>
            </div>

            {/* Servus badge */}
            <div className="hidden sm:flex items-center gap-2.5 bg-white/10
                            backdrop-blur-sm rounded-xl px-4 py-2.5
                            border border-white/15">
              <div className="w-7 h-7 rounded-full bg-accent-500
                              flex items-center justify-center flex-shrink-0">
                <span className="text-white font-bold text-sm">S</span>
              </div>
              <div>
                <p className="text-[10px] text-white/50 font-medium">Signed in as</p>
                <p className="text-xs text-white font-bold leading-tight">
                  {user?.displayName ?? '—'}
                </p>
              </div>
            </div>
          </div>

          {/* Role chips */}
          <div className="flex flex-wrap gap-2 mt-5">
            {user?.roles?.map(role => (
              <span key={role}
                    className="text-[10px] font-semibold bg-white/15 text-white/80
                               px-3 py-1 rounded-full border border-white/10">
                {role.replace('ECM_', '')}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Stats + recent docs ──────────────────────────────── */}
      <ErrorBoundary>
        <DashboardStats />
      </ErrorBoundary>

    </div>
  )
}