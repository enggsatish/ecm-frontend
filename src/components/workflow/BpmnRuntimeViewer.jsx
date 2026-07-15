/**
 * BpmnRuntimeViewer.jsx
 *
 * Read-only BPMN diagram with activity overlays:
 *   - Green  = completed activity
 *   - Blue   = active (current) activity with pulse
 *   - Amber  = waiting (receive task)
 *   - Red    = failed
 *
 * Props:
 *   bpmnXml            — BPMN 2.0 XML string
 *   activeActivityIds  — string[] of currently active BPMN element IDs
 *   completedActivities — { activityId, activityName, assignee, endTime }[]
 *   onActivityClick    — (activityId) => void (optional)
 */
import { useRef, useEffect, useState, useCallback } from 'react'
import { Loader2 } from 'lucide-react'

const OVERLAY_STYLES = {
  completed: {
    border: '3px solid #10b981',
    borderRadius: '8px',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  active: {
    border: '3px solid #3b82f6',
    borderRadius: '8px',
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    animation: 'bpmn-pulse 2s ease-in-out infinite',
  },
  waiting: {
    border: '3px solid #f59e0b',
    borderRadius: '8px',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    animation: 'bpmn-pulse 2s ease-in-out infinite',
  },
}

export default function BpmnRuntimeViewer({
  bpmnXml,
  activeActivityIds = [],
  completedActivities = [],
  onActivityClick,
}) {
  const containerRef = useRef(null)
  const viewerRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const applyOverlays = useCallback((viewer) => {
    const overlays = viewer.get('overlays')
    const elementRegistry = viewer.get('elementRegistry')

    const completedIds = new Set(completedActivities.map(a => a.activityId))
    const waitingIds = new Set(
      activeActivityIds.filter(id => id.toLowerCase().includes('wait') || id.toLowerCase().includes('receive'))
    )

    // Clear existing overlays
    overlays.remove({ type: 'runtime-state' })

    // Completed activities — green
    for (const activity of completedActivities) {
      const el = elementRegistry.get(activity.activityId)
      if (!el) continue
      const { width, height } = el

      const div = document.createElement('div')
      Object.assign(div.style, OVERLAY_STYLES.completed, {
        width: `${width + 6}px`,
        height: `${height + 6}px`,
        position: 'absolute',
        pointerEvents: 'none',
      })

      // Checkmark badge
      const badge = document.createElement('div')
      badge.innerHTML = '&#10003;'
      Object.assign(badge.style, {
        position: 'absolute', top: '-8px', right: '-8px',
        width: '16px', height: '16px', borderRadius: '50%',
        backgroundColor: '#10b981', color: 'white',
        fontSize: '10px', fontWeight: 'bold',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      })
      div.appendChild(badge)

      overlays.add(activity.activityId, 'runtime-state', {
        position: { top: -3, left: -3 },
        html: div,
      })
    }

    // Active activities — blue (or amber for waiting)
    for (const activityId of activeActivityIds) {
      if (completedIds.has(activityId)) continue
      const el = elementRegistry.get(activityId)
      if (!el) continue
      const { width, height } = el
      const isWaiting = waitingIds.has(activityId)

      const div = document.createElement('div')
      Object.assign(div.style, isWaiting ? OVERLAY_STYLES.waiting : OVERLAY_STYLES.active, {
        width: `${width + 6}px`,
        height: `${height + 6}px`,
        position: 'absolute',
        pointerEvents: 'none',
      })

      // Active dot badge
      const badge = document.createElement('div')
      Object.assign(badge.style, {
        position: 'absolute', top: '-6px', right: '-6px',
        width: '12px', height: '12px', borderRadius: '50%',
        backgroundColor: isWaiting ? '#f59e0b' : '#3b82f6',
        border: '2px solid white',
        animation: 'bpmn-pulse 2s ease-in-out infinite',
      })
      div.appendChild(badge)

      overlays.add(activityId, 'runtime-state', {
        position: { top: -3, left: -3 },
        html: div,
      })
    }
  }, [activeActivityIds, completedActivities])

  useEffect(() => {
    if (!bpmnXml || !containerRef.current) return

    let destroyed = false

    ;(async () => {
      try {
        setLoading(true)
        setError(null)

        // Dynamic import for code splitting (same pattern as designer)
        const { default: BpmnViewer } = await import('bpmn-js/lib/NavigatedViewer')

        if (destroyed) return

        // Clean up previous viewer
        if (viewerRef.current) {
          viewerRef.current.destroy()
        }

        const viewer = new BpmnViewer({
          container: containerRef.current,
        })
        viewerRef.current = viewer

        await viewer.importXML(bpmnXml)

        // Fit to viewport
        const canvas = viewer.get('canvas')
        canvas.zoom('fit-viewport', 'auto')

        // Apply overlays
        applyOverlays(viewer)

        // Click handler
        if (onActivityClick) {
          const eventBus = viewer.get('eventBus')
          eventBus.on('element.click', (e) => {
            if (e.element?.id && e.element.type !== 'bpmn:Process') {
              onActivityClick(e.element.id)
            }
          })
        }

        setLoading(false)
      } catch (err) {
        if (!destroyed) {
          setError(err.message)
          setLoading(false)
        }
      }
    })()

    return () => {
      destroyed = true
      if (viewerRef.current) {
        viewerRef.current.destroy()
        viewerRef.current = null
      }
    }
  }, [bpmnXml]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-apply overlays when activity data changes (without re-importing XML)
  useEffect(() => {
    if (viewerRef.current && !loading) {
      applyOverlays(viewerRef.current)
    }
  }, [activeActivityIds, completedActivities, loading, applyOverlays])

  return (
    <div className="relative">
      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes bpmn-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
          <p className="text-sm text-red-500">Failed to load diagram: {error}</p>
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-3 text-[10px] text-gray-500 bg-white/90 px-2 py-1 rounded-lg border border-gray-200">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm border-2 border-green-500 bg-green-50" /> Completed</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm border-2 border-blue-500 bg-blue-50" /> Active</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm border-2 border-amber-500 bg-amber-50" /> Waiting</span>
      </div>

      <div ref={containerRef} className="w-full h-[350px] bg-gray-50 rounded-lg border border-gray-200" />
    </div>
  )
}
