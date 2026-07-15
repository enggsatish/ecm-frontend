/**
 * FlowMinimap.jsx — Custom minimap that shows BOTH nodes and edges.
 *
 * React Flow's built-in MiniMap only shows nodes. This draws a simplified
 * SVG overview with colored node rectangles + edge lines.
 */
import { memo, useMemo } from 'react'
import { useNodes, useEdges, useViewport, useReactFlow } from '@xyflow/react'

const NODE_COLORS = {
  start: '#22c55e', reviewTask: '#3b82f6', infoWait: '#f59e0b',
  notification: '#a855f7', docusign: '#6366f1', decision: '#f97316',
  endApproved: '#22c55e', endRejected: '#ef4444', endCancelled: '#9ca3af',
  stickyNote: '#eab308',
}

const MINIMAP_W = 180
const MINIMAP_H = 120

export default memo(function FlowMinimap() {
  const nodes = useNodes()
  const edges = useEdges()
  const viewport = useViewport()
  const { getViewport } = useReactFlow()

  const { viewBox, scaledNodes, scaledEdges, vpRect } = useMemo(() => {
    if (nodes.length === 0) return { viewBox: '0 0 100 100', scaledNodes: [], scaledEdges: [], vpRect: null }

    // Compute bounding box of all nodes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    const nodeMap = {}
    for (const n of nodes) {
      const x = n.position?.x ?? n.positionAbsolute?.x ?? 0
      const y = n.position?.y ?? n.positionAbsolute?.y ?? 0
      const w = n.measured?.width ?? 160
      const h = n.measured?.height ?? 50
      nodeMap[n.id] = { x: x + w / 2, y: y + h / 2 }
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x + w)
      maxY = Math.max(maxY, y + h)
    }

    const pad = 40
    minX -= pad; minY -= pad; maxX += pad; maxY += pad
    const graphW = maxX - minX || 1
    const graphH = maxY - minY || 1
    const scale = Math.min(MINIMAP_W / graphW, MINIMAP_H / graphH)

    const sNodes = nodes.map(n => {
      const x = (n.position?.x ?? 0)
      const y = (n.position?.y ?? 0)
      const w = n.measured?.width ?? (n.type === 'start' || n.type?.startsWith('end') ? 50 : n.type === 'decision' ? 50 : 160)
      const h = n.measured?.height ?? (n.type === 'start' || n.type?.startsWith('end') ? 50 : n.type === 'decision' ? 50 : 50)
      return {
        id: n.id, type: n.type,
        cx: (x + w / 2 - minX) * scale,
        cy: (y + h / 2 - minY) * scale,
        rx: Math.max(w * scale / 2, 3),
        ry: Math.max(h * scale / 2, 3),
        color: NODE_COLORS[n.type] || '#94a3b8',
      }
    })

    const sEdges = edges.map(e => {
      const src = nodeMap[e.source]
      const tgt = nodeMap[e.target]
      if (!src || !tgt) return null
      return {
        id: e.id,
        x1: (src.x - minX) * scale,
        y1: (src.y - minY) * scale,
        x2: (tgt.x - minX) * scale,
        y2: (tgt.y - minY) * scale,
      }
    }).filter(Boolean)

    // Viewport rectangle
    const vp = getViewport()
    const vpW = (window.innerWidth / (vp.zoom || 1)) * scale
    const vpH = (window.innerHeight / (vp.zoom || 1)) * scale
    const vpX = (-vp.x / (vp.zoom || 1) - minX) * scale
    const vpY = (-vp.y / (vp.zoom || 1) - minY) * scale

    return {
      viewBox: `0 0 ${graphW * scale} ${graphH * scale}`,
      scaledNodes: sNodes,
      scaledEdges: sEdges,
      vpRect: { x: vpX, y: vpY, w: vpW, h: vpH },
    }
  }, [nodes, edges, viewport, getViewport]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      position: 'absolute', bottom: 12, right: 12, zIndex: 5,
      width: MINIMAP_W, height: MINIMAP_H,
      background: 'rgba(255,255,255,0.92)', borderRadius: 10,
      border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      overflow: 'hidden',
    }}>
      <svg width="100%" height="100%" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
        {/* Edges */}
        {scaledEdges.map(e => (
          <line key={e.id} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
            stroke="#cbd5e1" strokeWidth={1} />
        ))}
        {/* Nodes */}
        {scaledNodes.map(n => (
          n.type === 'start' || n.type?.startsWith('end')
            ? <circle key={n.id} cx={n.cx} cy={n.cy} r={Math.max(n.rx, n.ry)} fill={n.color} opacity={0.8} />
            : n.type === 'decision'
              ? <rect key={n.id} x={n.cx - n.rx} y={n.cy - n.ry} width={n.rx * 2} height={n.ry * 2}
                  fill={n.color} opacity={0.8} transform={`rotate(45 ${n.cx} ${n.cy})`} />
              : <rect key={n.id} x={n.cx - n.rx} y={n.cy - n.ry} width={n.rx * 2} height={n.ry * 2}
                  rx={4} fill={n.color} opacity={0.7} />
        ))}
        {/* Viewport indicator */}
        {vpRect && (
          <rect x={vpRect.x} y={vpRect.y} width={vpRect.w} height={vpRect.h}
            fill="rgba(59,130,246,0.08)" stroke="#3b82f6" strokeWidth={1} rx={2} />
        )}
      </svg>
    </div>
  )
})
