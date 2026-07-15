/**
 * FlowDesignerCanvas.jsx — Miro-style workflow designer.
 *
 * Features:
 *   Tier 1: Inline editing, floating NodeToolbar, hover handles, quick-add "+"
 *   Tier 2: Auto-layout (dagre), custom minimap with edges, smooth transitions, sticky notes
 *   Tier 3: Edge type picker (smoothstep/bezier), edge reconnection
 *
 * Keyboard: Del=delete, Ctrl+S=save, Ctrl+Z=undo, Ctrl+Shift+Z=redo, Ctrl+L=auto-layout, Esc=deselect
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, Panel,
  useNodesState, useEdgesState, addEdge, useReactFlow, MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Save, AlertCircle, GripVertical, Undo2, Redo2, Maximize2,
  Grid3X3, Keyboard, Clipboard, Trash2, Wand2, Copy,
} from 'lucide-react'
import { nodeTypes, PALETTE_GROUPS, PALETTE_ITEMS, isValidConnection } from './FlowNodes'
import { getAutoLayout } from './autoLayout'
import FlowMinimap from './FlowMinimap'
import WaypointEdge from './WaypointEdge'
import { useRoles } from '../../../hooks/useAdmin'

// ── Edge config ───────────────────────────────────────────────────────────────

const edgeTypes = { waypoint: WaypointEdge }

const DEF_EDGE = {
  type: 'waypoint',
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: '#64748b' },
  style: { strokeWidth: 2.5, stroke: '#94a3b8' },
  data: { waypoints: [] },
}

// GROUPS loaded dynamically from backend via useRoles() — see PropertiesPanel

// ── Properties Panel (advanced config only) ───────────────────────────────────

function PropertiesPanel({ selectedNode, selectedEdge, onUpdateNode, onUpdateEdge }) {
  const { data: roles = [] } = useRoles()
  const groups = roles.filter(r => r.isActive !== false).map(r => r.name)
  if (selectedEdge) {
    return (
      <div style={{ padding: 12 }}>
        <h4 style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 10 }}>Edge</h4>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 10, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 3 }}>Label</label>
          <input value={selectedEdge.label || selectedEdge.data?.label || ''}
            onChange={e => onUpdateEdge(selectedEdge.id, 'label', e.target.value)}
            placeholder="e.g. Approved"
            style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', outline: 'none' }} />
        </div>
        {(selectedEdge.data?.waypoints?.length > 0) && (
          <button onClick={() => onUpdateEdge(selectedEdge.id, 'waypoints', [])}
            style={{ width: '100%', padding: '6px 10px', fontSize: 11, fontWeight: 500, color: '#6b7280', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, cursor: 'pointer', marginBottom: 10 }}>
            Reset path ({selectedEdge.data.waypoints.length} bend points)
          </button>
        )}
        <p style={{ fontSize: 9, color: '#9ca3af' }}>{selectedEdge.source} → {selectedEdge.target}</p>
        <p style={{ fontSize: 9, color: '#9ca3af', marginTop: 4 }}>Click edge to show bend handles. Drag to reshape. Double-click handle to remove.</p>
      </div>
    )
  }

  if (!selectedNode) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 16px', color: '#9ca3af', fontSize: 11, textAlign: 'center' }}>
        <Clipboard size={20} style={{ marginBottom: 8, color: '#d1d5db' }} />
        <p style={{ fontWeight: 500, color: '#6b7280' }}>No Selection</p>
        <p style={{ marginTop: 4 }}>Click node or edge to configure.<br/>Double-click label to rename.<br/>Hover to see connection handles.</p>
      </div>
    )
  }

  const { id, type, data } = selectedNode
  const update = (key, value) => onUpdateNode(id, { ...data, [key]: value })

  return (
    <div style={{ padding: 12 }}>
      <h4 style={{ fontSize: 11, fontWeight: 700, color: '#374151', marginBottom: 10 }}>Properties</h4>

      {type === 'reviewTask' && (
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 10, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 3 }}>Assigned Group</label>
          <select value={data.assignedGroup || 'ECM_REVIEWER'} onChange={e => update('assignedGroup', e.target.value)}
            style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', background: 'white' }}>
            {groups.map(g => <option key={g} value={g}>{g.replace('ECM_', '')}</option>)}
          </select>
        </div>
      )}

      {type === 'docusign' && (
        <>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 10, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 3 }}>Envelope Subject</label>
            <input value={data.subject || ''} onChange={e => update('subject', e.target.value)} placeholder="Please sign your document"
              style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', outline: 'none' }} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 10, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 3 }}>Recipient Email Var</label>
            <input value={data.recipientEmailVar || ''} onChange={e => update('recipientEmailVar', e.target.value)} placeholder="submittedBy"
              style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', outline: 'none' }} />
          </div>
        </>
      )}

      {type === 'notification' && (
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 10, fontWeight: 500, color: '#6b7280', display: 'block', marginBottom: 3 }}>Email Subject</label>
          <input value={data.subject || ''} onChange={e => update('subject', e.target.value)} placeholder="Notification subject..."
            style={{ width: '100%', fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', outline: 'none' }} />
        </div>
      )}

      {type === 'decision' && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: 8, marginBottom: 10 }}>
          <p style={{ fontSize: 10, color: '#c2410c', fontWeight: 500 }}>Connect outgoing edges and label them (click edge → set label in panel).</p>
        </div>
      )}

      <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 8, marginTop: 8 }}>
        <p style={{ fontSize: 9, color: '#9ca3af' }}>ID: <code>{id}</code> &middot; Type: <code>{type}</code></p>
      </div>
    </div>
  )
}

// ── Palette ───────────────────────────────────────────────────────────────────

function Palette() {
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', nodeType)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div style={{ padding: 10 }}>
      {PALETTE_GROUPS.map(group => (
        <div key={group.title} style={{ marginBottom: 14 }}>
          <h4 style={{ fontSize: 9, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', paddingLeft: 4, marginBottom: 6 }}>{group.title}</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {group.items.map(item => {
              const Icon = item.icon
              return (
                <div key={item.type} draggable onDragStart={(e) => onDragStart(e, item.type)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 10, border: '1px solid #f1f5f9', background: 'white', cursor: 'grab', transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)' }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#f1f5f9'; e.currentTarget.style.boxShadow = 'none' }}>
                  <GripVertical size={10} color="#d1d5db" />
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: item.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={12} color={item.color} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#374151', lineHeight: 1.2 }}>{item.label}</div>
                    <div style={{ fontSize: 9, color: '#9ca3af', lineHeight: 1.2 }}>{item.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Quick-add picker (shown when clicking "+" on a node) ──────────────────────

function QuickAddPicker({ x, y, onSelect, onClose }) {
  const items = PALETTE_ITEMS.filter(i => i.type !== 'stickyNote')
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={onClose} />
      <div style={{
        position: 'fixed', zIndex: 50, top: y, left: x,
        background: 'white', borderRadius: 12, border: '1px solid #e2e8f0',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 6, minWidth: 160,
      }}>
        {items.map(item => {
          const Icon = item.icon
          return (
            <button key={item.type} onClick={() => { onSelect(item.type); onClose() }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 10px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
              onMouseLeave={e => e.currentTarget.style.background = 'none'}>
              <div style={{ width: 20, height: 20, borderRadius: 4, background: item.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={11} color={item.color} />
              </div>
              <span style={{ fontSize: 11, fontWeight: 500, color: '#374151' }}>{item.label}</span>
            </button>
          )
        })}
      </div>
    </>
  )
}

// ── Context Menu ──────────────────────────────────────────────────────────────

function ContextMenu({ x, y, nodeId, onDelete, onDuplicate, onClose }) {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={onClose} />
      <div style={{ position: 'fixed', zIndex: 50, top: y, left: x, background: 'white', borderRadius: 10, border: '1px solid #e2e8f0', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', padding: '4px 0', minWidth: 130 }}>
        <button onClick={() => { onDuplicate(nodeId); onClose() }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 12px', fontSize: 12, color: '#374151', background: 'none', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
          <Copy size={11} /> Duplicate
        </button>
        <div style={{ height: 1, background: '#f1f5f9', margin: '2px 0' }} />
        <button onClick={() => { onDelete(nodeId); onClose() }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '6px 12px', fontSize: 12, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}
          onMouseEnter={e => e.currentTarget.style.background = '#fef2f2'} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
          <Trash2 size={11} /> Delete
        </button>
      </div>
    </>
  )
}

// ── Canvas Inner ──────────────────────────────────────────────────────────────

let nodeIdCounter = Date.now()

function FlowCanvasInner({ initialNodes, initialEdges, onSave, onChange, readOnly }) {
  const wrapperRef = useRef(null)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState(null)
  const [snapGrid, setSnapGrid] = useState(true)
  const [ctxMenu, setCtxMenu] = useState(null)
  const [quickAdd, setQuickAdd] = useState(null) // { x, y, sourceNodeId }
  const { screenToFlowPosition, fitView } = useReactFlow()

  // Undo/redo
  const [history, setHistory] = useState([])
  const [future, setFuture] = useState([])
  const stateRef = useRef({ nodes: initialNodes, edges: initialEdges })

  const pushHistory = useCallback(() => {
    setHistory(h => [...h.slice(-30), { nodes: stateRef.current.nodes, edges: stateRef.current.edges }])
    setFuture([])
  }, [])

  useEffect(() => {
    stateRef.current = { nodes, edges }
    if (onChange) onChange(nodes, edges)
  }, [nodes, edges, onChange])

  const undo = useCallback(() => {
    setHistory(h => {
      if (h.length === 0) return h
      const prev = h[h.length - 1]
      setFuture(f => [...f, stateRef.current])
      setNodes(prev.nodes)
      setEdges(prev.edges)
      return h.slice(0, -1)
    })
  }, [setNodes, setEdges])

  const redo = useCallback(() => {
    setFuture(f => {
      if (f.length === 0) return f
      const next = f[f.length - 1]
      setHistory(h => [...h, stateRef.current])
      setNodes(next.nodes)
      setEdges(next.edges)
      return f.slice(0, -1)
    })
  }, [setNodes, setEdges])

  const selectedNode = nodes.find(n => n.id === selectedNodeId) || null
  const selectedEdge = edges.find(e => e.id === selectedEdgeId) || null

  // ── Node callbacks injected via data (for NodeToolbar, quick-add, inline edit) ──

  const onDeleteNode = useCallback((nid) => {
    if (nodes.find(n => n.id === nid)?.type === 'start') return
    pushHistory()
    setNodes(nds => nds.filter(n => n.id !== nid))
    setEdges(eds => eds.filter(e => e.source !== nid && e.target !== nid))
    setSelectedNodeId(null)
  }, [nodes, setNodes, setEdges, pushHistory])

  const onDuplicateNode = useCallback((nid) => {
    const node = nodes.find(n => n.id === nid)
    if (!node || node.type === 'start') return
    pushHistory()
    const id = `${node.type}_${++nodeIdCounter}`
    setNodes(nds => [...nds, { ...node, id, position: { x: node.position.x + 30, y: node.position.y + 30 }, selected: false, data: { ...node.data } }])
    setSelectedNodeId(id)
  }, [nodes, setNodes, pushHistory])

  const onLabelChange = useCallback((nid, label) => {
    setNodes(nds => nds.map(n => n.id === nid ? { ...n, data: { ...n.data, label } } : n))
  }, [setNodes])

  const handleQuickAdd = useCallback((sourceNodeId) => {
    const sourceNode = nodes.find(n => n.id === sourceNodeId)
    if (!sourceNode) return
    // Show picker near the node's right edge
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return
    setQuickAdd({
      x: Math.min(rect.right - 180, rect.left + rect.width / 2),
      y: rect.top + rect.height / 3,
      sourceNodeId,
    })
  }, [nodes])

  const handleQuickAddSelect = useCallback((type) => {
    if (!quickAdd) return
    pushHistory()
    const sourceNode = nodes.find(n => n.id === quickAdd.sourceNodeId)
    if (!sourceNode) return

    const id = `${type}_${++nodeIdCounter}`
    const item = PALETTE_ITEMS.find(p => p.type === type)
    const newPos = { x: sourceNode.position.x + 250, y: sourceNode.position.y }

    setNodes(nds => [...nds, {
      id, type, position: newPos,
      data: { label: item?.label || type, assignedGroup: type === 'reviewTask' ? 'ECM_REVIEWER' : undefined },
    }])
    // Auto-connect from source
    setEdges(eds => addEdge({ source: quickAdd.sourceNodeId, target: id, ...DEF_EDGE }, eds))
    setSelectedNodeId(id)
    setQuickAdd(null)
  }, [quickAdd, nodes, setNodes, setEdges, pushHistory])

  // Inject callbacks into node data so custom nodes can call them
  const nodesWithCallbacks = nodes.map(n => ({
    ...n,
    data: {
      ...n.data,
      _onDelete: readOnly ? undefined : onDeleteNode,
      _onDuplicate: readOnly ? undefined : onDuplicateNode,
      _onLabelChange: readOnly ? undefined : onLabelChange,
      _onQuickAdd: readOnly ? undefined : handleQuickAdd,
    },
  }))

  // ── Connections ─────────────────────────────────────────────────────────────

  const onConnect = useCallback((params) => {
    pushHistory()
    setEdges(eds => addEdge({ ...params, ...DEF_EDGE }, eds))
  }, [setEdges, pushHistory])

  const checkValid = useCallback((conn) => isValidConnection(conn, nodes), [nodes])

  const onReconnect = useCallback((oldEdge, newConn) => {
    pushHistory()
    setEdges(eds => {
      const filtered = eds.filter(e => e.id !== oldEdge.id)
      return addEdge({ ...newConn, ...DEF_EDGE, label: oldEdge.label, data: oldEdge.data }, filtered)
    })
  }, [setEdges, pushHistory])

  // ── Selection ───────────────────────────────────────────────────────────────

  const onNodeClick = useCallback((_, node) => { setSelectedNodeId(node.id); setSelectedEdgeId(null); setCtxMenu(null) }, [])
  const onEdgeClick = useCallback((_, edge) => { setSelectedEdgeId(edge.id); setSelectedNodeId(null) }, [])
  const onPaneClick = useCallback(() => { setSelectedNodeId(null); setSelectedEdgeId(null); setCtxMenu(null); setQuickAdd(null) }, [])

  const onNodeContextMenu = useCallback((event, node) => {
    if (readOnly || node.type === 'start') return
    event.preventDefault()
    setCtxMenu({ x: event.clientX, y: event.clientY, nodeId: node.id })
  }, [readOnly])

  // ── Drop from palette ───────────────────────────────────────────────────────

  const onDragOver = useCallback((e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }, [])
  const onDrop = useCallback((e) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('application/reactflow')
    if (!type) return
    pushHistory()
    let pos = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    if (snapGrid) pos = { x: Math.round(pos.x / 20) * 20, y: Math.round(pos.y / 20) * 20 }
    const id = `${type}_${++nodeIdCounter}`
    const item = PALETTE_ITEMS.find(p => p.type === type)
    setNodes(nds => [...nds, { id, type, position: pos, data: { label: item?.label || type, assignedGroup: type === 'reviewTask' ? 'ECM_REVIEWER' : undefined } }])
    setSelectedNodeId(id)
  }, [screenToFlowPosition, setNodes, snapGrid, pushHistory])

  // ── Node/edge update ────────────────────────────────────────────────────────

  const onUpdateNode = useCallback((nid, data) => { setNodes(nds => nds.map(n => n.id === nid ? { ...n, data } : n)) }, [setNodes])
  const onUpdateEdge = useCallback((eid, field, value) => {
    setEdges(eds => eds.map(e => {
      if (e.id !== eid) return e
      if (field === 'label') return { ...e, label: value, data: { ...e.data, label: value } }
      if (field === 'type') return { ...e, type: value }
      if (field === 'waypoints') return { ...e, data: { ...e.data, waypoints: value } }
      return e
    }))
  }, [setEdges])

  // ── Auto-layout ─────────────────────────────────────────────────────────────

  const doAutoLayout = useCallback(() => {
    pushHistory()
    const laid = getAutoLayout(nodes, edges)
    setNodes(laid)
    setTimeout(() => fitView({ padding: 0.3, duration: 300 }), 50)
  }, [nodes, edges, setNodes, fitView, pushHistory])

  // ── Keyboard ────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (readOnly) return
    const handler = (e) => {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) { onDeleteNode(selectedNodeId); e.preventDefault() }
        else if (selectedEdgeId) { pushHistory(); setEdges(eds => eds.filter(ed => ed.id !== selectedEdgeId)); setSelectedEdgeId(null); e.preventDefault() }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); if (onSave) onSave(nodesWithCallbacks.map(n => ({ ...n, data: { ...n.data, _onDelete: undefined, _onDuplicate: undefined, _onLabelChange: undefined, _onQuickAdd: undefined } })), edges) }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo() }
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') { e.preventDefault(); doAutoLayout() }
      if (e.key === 'Escape') { setSelectedNodeId(null); setSelectedEdgeId(null); setCtxMenu(null); setQuickAdd(null) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [readOnly, selectedNodeId, selectedEdgeId, nodesWithCallbacks, edges, onSave, onDeleteNode, undo, redo, doAutoLayout, pushHistory, setEdges])

  // ── Validation ──────────────────────────────────────────────────────────────

  const hasStart = nodes.some(n => n.type === 'start')
  const hasEnd = nodes.some(n => n.type?.startsWith('end'))
  const isValid = hasStart && hasEnd && nodes.length >= 3

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 500, background: '#f8fafc', overflow: 'hidden' }}>
      {/* Palette */}
      {!readOnly && (
        <div style={{ width: 210, borderRight: '1px solid #e2e8f0', background: 'white', overflowY: 'auto', flexShrink: 0 }}>
          <Palette />
        </div>
      )}

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' }} ref={wrapperRef}>
        <div style={{ flex: 1 }}>
          <ReactFlow
            nodes={nodesWithCallbacks} edges={edges}
            onNodesChange={readOnly ? undefined : onNodesChange}
            onEdgesChange={readOnly ? undefined : onEdgesChange}
            onConnect={readOnly ? undefined : onConnect}
            onReconnect={readOnly ? undefined : onReconnect}
            isValidConnection={checkValid}
            onNodeClick={onNodeClick} onEdgeClick={onEdgeClick} onPaneClick={onPaneClick}
            onNodeContextMenu={onNodeContextMenu}
            onDragOver={onDragOver} onDrop={onDrop}
            nodeTypes={nodeTypes} edgeTypes={edgeTypes} defaultEdgeOptions={DEF_EDGE}
            fitView fitViewOptions={{ padding: 0.3 }}
            snapToGrid={snapGrid} snapGrid={[20, 20]}
            nodesDraggable={!readOnly} nodesConnectable={!readOnly}
            elementsSelectable edgesFocusable={!readOnly}
            selectionOnDrag={!readOnly}
            proOptions={{ hideAttribution: true }}
            connectionLineStyle={{ strokeWidth: 2, stroke: '#3b82f6' }}
            connectionLineType="smoothstep"
          >
            <Background color="#e2e8f0" gap={20} size={1} variant="dots" />
            <Controls showInteractive={false} />
            <FlowMinimap />

            {/* Toolbar */}
            {!readOnly && (
              <Panel position="top-left">
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, background: 'rgba(255,255,255,0.95)', borderRadius: 10, border: '1px solid #e2e8f0', padding: '3px 6px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <button onClick={undo} disabled={history.length === 0} title="Undo (Ctrl+Z)"
                    style={{ padding: 5, borderRadius: 6, border: 'none', background: 'none', cursor: history.length ? 'pointer' : 'default', opacity: history.length ? 1 : 0.3 }}>
                    <Undo2 size={14} color="#475569" />
                  </button>
                  <button onClick={redo} disabled={future.length === 0} title="Redo (Ctrl+Shift+Z)"
                    style={{ padding: 5, borderRadius: 6, border: 'none', background: 'none', cursor: future.length ? 'pointer' : 'default', opacity: future.length ? 1 : 0.3 }}>
                    <Redo2 size={14} color="#475569" />
                  </button>
                  <div style={{ width: 1, height: 18, background: '#e2e8f0', margin: '0 2px' }} />
                  <button onClick={doAutoLayout} title="Auto-layout (Ctrl+L)"
                    style={{ padding: 5, borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer' }}>
                    <Wand2 size={14} color="#475569" />
                  </button>
                  <button onClick={() => fitView({ padding: 0.3, duration: 300 })} title="Fit view"
                    style={{ padding: 5, borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer' }}>
                    <Maximize2 size={14} color="#475569" />
                  </button>
                  <button onClick={() => setSnapGrid(s => !s)} title={`Snap: ${snapGrid ? 'ON' : 'OFF'}`}
                    style={{ padding: 5, borderRadius: 6, border: 'none', background: snapGrid ? '#dbeafe' : 'none', cursor: 'pointer' }}>
                    <Grid3X3 size={14} color={snapGrid ? '#2563eb' : '#94a3b8'} />
                  </button>
                </div>
              </Panel>
            )}

            {/* Save */}
            {!readOnly && onSave && (
              <Panel position="top-right">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {!isValid && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#d97706', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 8, padding: '4px 8px' }}>
                      <AlertCircle size={10} />
                      {!hasStart ? 'Add Start' : !hasEnd ? 'Add End' : 'Need more steps'}
                    </span>
                  )}
                  <button onClick={() => onSave(nodes, edges)} disabled={!isValid}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', fontSize: 12, fontWeight: 600, color: 'white', background: isValid ? '#2563eb' : '#94a3b8', border: 'none', borderRadius: 10, cursor: isValid ? 'pointer' : 'default', boxShadow: isValid ? '0 2px 8px rgba(37,99,235,0.3)' : 'none', transition: 'all 0.15s' }}>
                    <Save size={13} /> Save
                  </button>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {/* Status bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px', background: 'rgba(255,255,255,0.9)', borderTop: '1px solid #e2e8f0', fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>
          <span>{nodes.length} nodes &middot; {edges.length} edges{snapGrid ? ' &middot; Grid' : ''}</span>
          {!readOnly && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Keyboard size={10} /> Del &middot; Ctrl+S &middot; Ctrl+Z &middot; Ctrl+L=layout &middot; Dbl-click=rename
            </span>
          )}
        </div>
      </div>

      {/* Properties (for advanced config — basic editing is inline) */}
      {!readOnly && (
        <div style={{ width: 220, borderLeft: '1px solid #e2e8f0', background: 'white', overflowY: 'auto', flexShrink: 0 }}>
          <PropertiesPanel selectedNode={selectedNode} selectedEdge={selectedEdge}
            onUpdateNode={onUpdateNode} onUpdateEdge={onUpdateEdge} />
        </div>
      )}

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu x={ctxMenu.x} y={ctxMenu.y} nodeId={ctxMenu.nodeId}
          onDelete={onDeleteNode} onDuplicate={onDuplicateNode} onClose={() => setCtxMenu(null)} />
      )}

      {/* Quick-add picker */}
      {quickAdd && (
        <QuickAddPicker x={quickAdd.x} y={quickAdd.y}
          onSelect={handleQuickAddSelect} onClose={() => setQuickAdd(null)} />
      )}
    </div>
  )
}

// ── Export ─────────────────────────────────────────────────────────────────────

export default function FlowDesignerCanvas({ initialNodes = [], initialEdges = [], onSave, onChange, readOnly = false }) {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: 500 }}>
      <ReactFlowProvider>
        <FlowCanvasInner initialNodes={initialNodes} initialEdges={initialEdges}
          onSave={onSave} onChange={onChange} readOnly={readOnly} />
      </ReactFlowProvider>
    </div>
  )
}
