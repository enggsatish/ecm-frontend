/**
 * WaypointEdge.jsx — Custom React Flow edge with draggable bend points.
 *
 * Features:
 *   - Click edge → shows existing waypoint handles + midpoint "+" handles
 *   - Drag a waypoint handle → reshapes the edge path
 *   - Click "+" at midpoint → inserts a new waypoint
 *   - Double-click waypoint handle → removes it
 *   - Smooth cubic bezier path through all points
 *   - Waypoints stored in edge.data.waypoints = [{x, y}, ...]
 *   - Arrow marker at target end
 */
import { memo, useState, useMemo, useCallback, useEffect } from 'react'
import { BaseEdge, EdgeLabelRenderer, useReactFlow } from '@xyflow/react'

// ── Smooth path through points ────────────────────────────────────────────────

function buildSmoothPath(points) {
  if (points.length < 2) return ''
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`
  }

  // Catmull-Rom → cubic bezier conversion for smooth curve through all points
  let d = `M ${points[0].x} ${points[0].y}`

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[Math.min(i + 2, points.length - 1)]

    // Catmull-Rom to cubic bezier control points (tension = 0.3)
    const t = 0.3
    const cp1x = p1.x + (p2.x - p0.x) * t
    const cp1y = p1.y + (p2.y - p0.y) * t
    const cp2x = p2.x - (p3.x - p1.x) * t
    const cp2y = p2.y - (p3.y - p1.y) * t

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }

  return d
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

// ── Edge component ──────────────────────────────���─────────────────────────────

function WaypointEdge({
  id, sourceX, sourceY, targetX, targetY,
  data, label, style, markerEnd, selected,
}) {
  const { setEdges } = useReactFlow()
  const [draggingIdx, setDraggingIdx] = useState(null)

  const waypoints = useMemo(() => data?.waypoints || [], [data?.waypoints])
  const displayLabel = data?.label || label || ''

  // All points: source → waypoints → target
  const allPoints = [
    { x: sourceX, y: sourceY },
    ...waypoints,
    { x: targetX, y: targetY },
  ]

  const edgePath = buildSmoothPath(allPoints)

  // Label position at midpoint of the full path
  const midIdx = Math.floor(allPoints.length / 2)
  const labelPos = midpoint(allPoints[midIdx - 1] || allPoints[0], allPoints[midIdx] || allPoints[0])

  // ── Waypoint CRUD ───────────────────────────────────────────────────────

  const updateWaypoints = useCallback((newWaypoints) => {
    setEdges(eds => eds.map(e =>
      e.id === id ? { ...e, data: { ...e.data, waypoints: newWaypoints } } : e
    ))
  }, [id, setEdges])

  const addWaypoint = (afterIndex, point) => {
    const newWp = [...waypoints]
    newWp.splice(afterIndex, 0, point)
    updateWaypoints(newWp)
  }

  const removeWaypoint = (index) => {
    updateWaypoints(waypoints.filter((_, i) => i !== index))
  }

  // ── Drag handling ───────────────────────────────────────────────────────

  const onMouseDown = useCallback((e, wpIndex) => {
    e.stopPropagation()
    e.preventDefault()
    setDraggingIdx(wpIndex)
  }, [])

  useEffect(() => {
    if (draggingIdx === null) return

    const onMouseMove = (e) => {
      // Convert screen coords to SVG/flow coords
      // We need the react-flow viewport transform
      const rfContainer = document.querySelector('.react-flow__viewport')
      if (!rfContainer) return

      const transform = rfContainer.style.transform
      const match = transform.match(/translate\((.+?)px, (.+?)px\) scale\((.+?)\)/)
      if (!match) return

      const tx = parseFloat(match[1])
      const ty = parseFloat(match[2])
      const scale = parseFloat(match[3])

      const rfPane = document.querySelector('.react-flow')
      if (!rfPane) return
      const rect = rfPane.getBoundingClientRect()

      const x = (e.clientX - rect.left - tx) / scale
      const y = (e.clientY - rect.top - ty) / scale

      const newWp = [...waypoints]
      newWp[draggingIdx] = { x, y }
      updateWaypoints(newWp)
    }

    const onMouseUp = () => {
      setDraggingIdx(null)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [draggingIdx, waypoints, updateWaypoints])

  // ── Render ────���─────────────────────────────────────────────────────────

  const isActive = selected || draggingIdx !== null
  const edgeStyle = {
    ...style,
    strokeWidth: isActive ? 3 : 2.5,
    stroke: isActive ? '#3b82f6' : '#94a3b8',
    fill: 'none',
    cursor: 'pointer',
  }

  return (
    <>
      {/* Invisible wide hitbox for easier clicking */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        style={{ cursor: 'pointer' }}
      />

      {/* Visible edge path */}
      <BaseEdge id={id} path={edgePath} style={edgeStyle} markerEnd={markerEnd} />

      {/* Waypoint handles + midpoint add buttons (only when selected) */}
      {isActive && (
        <EdgeLabelRenderer>
          {/* Existing waypoint handles — draggable */}
          {waypoints.map((wp, i) => (
            <div key={`wp-${i}`}
              className="nodrag nopan"
              onMouseDown={(e) => onMouseDown(e, i)}
              onDoubleClick={(e) => { e.stopPropagation(); removeWaypoint(i) }}
              title="Drag to move, double-click to remove"
              style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${wp.x}px, ${wp.y}px)`,
                width: 12, height: 12, borderRadius: '50%',
                background: '#3b82f6', border: '2px solid white',
                cursor: draggingIdx === i ? 'grabbing' : 'grab',
                boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
                zIndex: 10,
                pointerEvents: 'all',
              }}
            />
          ))}

          {/* "+" buttons at segment midpoints — click to add waypoint */}
          {allPoints.slice(0, -1).map((pt, i) => {
            const next = allPoints[i + 1]
            const mid = midpoint(pt, next)
            // wpIndex: where to insert in the waypoints array
            // i=0 is source→first, so insert at position 0
            // i=1 is first wp→second, insert at position 1, etc.
            const insertAt = i // segment 0 → insert at 0, segment 1 → insert at 1
            return (
              <div key={`add-${i}`}
                className="nodrag nopan"
                onClick={(e) => { e.stopPropagation(); addWaypoint(insertAt, { x: mid.x, y: mid.y }) }}
                title="Click to add bend point"
                style={{
                  position: 'absolute',
                  transform: `translate(-50%, -50%) translate(${mid.x}px, ${mid.y}px)`,
                  width: 16, height: 16, borderRadius: '50%',
                  background: 'white', border: '1.5px dashed #94a3b8',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: '#94a3b8',
                  opacity: 0.7, transition: 'opacity 0.15s',
                  zIndex: 5,
                  pointerEvents: 'all',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.color = '#3b82f6' }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.borderColor = '#94a3b8'; e.currentTarget.style.color = '#94a3b8' }}
              >
                +
              </div>
            )
          })}
        </EdgeLabelRenderer>
      )}

      {/* Edge label */}
      {displayLabel && (
        <EdgeLabelRenderer>
          <div className="nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelPos.x}px, ${labelPos.y}px)`,
              fontSize: 11, fontWeight: 600, color: '#475569',
              background: 'rgba(255,255,255,0.95)', padding: '2px 8px',
              borderRadius: 4, border: '1px solid #e2e8f0',
              pointerEvents: 'all',
              whiteSpace: 'nowrap',
            }}
          >
            {displayLabel}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export default memo(WaypointEdge)
