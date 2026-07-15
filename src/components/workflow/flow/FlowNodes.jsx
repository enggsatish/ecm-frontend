/* eslint-disable react-refresh/only-export-components */
/**
 * FlowNodes.jsx — Miro-style custom React Flow nodes.
 *
 * Features:
 *   - Inline label editing (double-click → contentEditable)
 *   - Hover-only connection handles (hidden by default, shown on hover)
 *   - Quick-add "+" button on right side → onQuickAdd callback
 *   - NodeToolbar with actions on selection
 *   - Clean modern styling with inline styles (no dynamic Tailwind)
 */
import { memo, useState, useRef, useEffect, useCallback } from 'react'
import { Handle, Position, NodeToolbar } from '@xyflow/react'
import {
  Play, UserCheck, MessageSquare, Mail, PenTool, GitBranch,
  CheckCircle, XCircle, Ban, Plus, Trash2, Copy, StickyNote,
} from 'lucide-react'

// ── Styles ────────────────────────────────────────────────────────────────────

const HANDLE_BASE = {
  width: 10, height: 10, border: '2px solid white',
  transition: 'transform 0.15s, opacity 0.15s',
}

// ── Inline Editable Label ─────────────────────────────────────────────────────

function EditableLabel({ value, onChange, style = {}, editable = true }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus() }, [editing])

  const commit = useCallback(() => {
    setEditing(false)
    if (draft.trim() && draft !== value) onChange(draft.trim())
  }, [draft, value, onChange])

  if (editing && editable) {
    return (
      <input ref={inputRef} value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
        onClick={e => e.stopPropagation()}
        style={{
          ...style, border: '1px solid #3b82f6', borderRadius: 4, padding: '1px 4px',
          outline: 'none', background: 'white', width: '100%', boxSizing: 'border-box',
        }}
      />
    )
  }

  return (
    <div onDoubleClick={editable ? () => setEditing(true) : undefined}
      style={{ ...style, cursor: editable ? 'text' : 'default', minHeight: 16 }}
      title={editable ? 'Double-click to edit' : undefined}>
      {value || '(untitled)'}
    </div>
  )
}

// ── Node Card ─────────────────────────────────────────────────────────────────

function NodeCard({ children, label, onLabelChange, Icon, color, selected, badge, nodeId, onQuickAdd, onDelete, onDuplicate, editable = true }) { // eslint-disable-line no-unused-vars
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'white', border: `2px solid ${selected ? color : '#e2e8f0'}`,
        borderRadius: 12, padding: '10px 14px', minWidth: 165, maxWidth: 220,
        boxShadow: selected ? `0 0 0 3px ${color}22, 0 4px 12px rgba(0,0,0,0.08)` : '0 1px 4px rgba(0,0,0,0.08)',
        transition: 'all 0.2s ease', position: 'relative',
      }}
    >
      {/* NodeToolbar — floating actions on select */}
      {selected && editable && (
        <NodeToolbar isVisible position={Position.Top} offset={8}>
          <div style={{ display: 'flex', gap: 2, background: 'white', borderRadius: 8, border: '1px solid #e2e8f0', padding: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            {onDuplicate && (
              <button onClick={() => onDuplicate(nodeId)} title="Duplicate"
                style={{ padding: '4px 6px', borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <Copy size={12} color="#6b7280" />
              </button>
            )}
            {onDelete && (
              <button onClick={() => onDelete(nodeId)} title="Delete"
                style={{ padding: '4px 6px', borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                <Trash2 size={12} color="#ef4444" />
              </button>
            )}
          </div>
        </NodeToolbar>
      )}

      {/* Handles — visible on hover */}
      <Handle type="target" position={Position.Left}
        style={{ ...HANDLE_BASE, background: color, opacity: hovered || selected ? 1 : 0, transform: hovered ? 'scale(1.3)' : 'scale(1)' }} />
      <Handle type="source" position={Position.Right}
        style={{ ...HANDLE_BASE, background: color, opacity: hovered || selected ? 1 : 0, transform: hovered ? 'scale(1.3)' : 'scale(1)' }} />

      {/* Content */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: `linear-gradient(135deg, ${color}15, ${color}30)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={15} color={color} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <EditableLabel value={label} onChange={onLabelChange} editable={editable}
            style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', lineHeight: 1.3 }} />
          {badge && (
            <div style={{ fontSize: 9, fontWeight: 600, color, background: `${color}15`, borderRadius: 4, padding: '1px 6px', marginTop: 3, display: 'inline-block' }}>
              {badge}
            </div>
          )}
        </div>
      </div>
      {children}

      {/* Quick-add "+" button — shown on hover */}
      {onQuickAdd && hovered && !selected && (
        <button onClick={(e) => { e.stopPropagation(); onQuickAdd(nodeId) }}
          style={{
            position: 'absolute', right: -14, top: '50%', transform: 'translateY(-50%)',
            width: 22, height: 22, borderRadius: '50%', border: '2px solid #e2e8f0',
            background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)', transition: 'all 0.15s',
            zIndex: 10,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = color; e.currentTarget.style.borderColor = color }}
          onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#e2e8f0' }}
        >
          <Plus size={12} color="#6b7280" />
        </button>
      )}
    </div>
  )
}

// ── Circle Node (Start / End) ─────────────────────────────────────────────────

function CircleNode({ Icon, color, bg, label, onLabelChange, selected, hovered, size = 56, editable = false }) { // eslint-disable-line no-unused-vars
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      <div style={{
        width: size, height: size, borderRadius: '50%',
        border: `2.5px solid ${selected ? color : bg}`,
        background: `linear-gradient(135deg, ${bg}, white)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: selected ? `0 0 0 3px ${color}22, 0 4px 12px rgba(0,0,0,0.08)` : '0 2px 6px rgba(0,0,0,0.06)',
        transition: 'all 0.2s ease',
      }}>
        <Icon size={size > 50 ? 22 : 16} color={color} />
      </div>
      <EditableLabel value={label} onChange={onLabelChange} editable={editable}
        style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }} />
    </div>
  )
}

// ── Start Node ────────────────────────────────────────────────────────────────

export const StartNode = memo(function StartNode({ selected }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <CircleNode Icon={Play} color="#16a34a" bg="#dcfce7" label="Start" selected={selected} hovered={hovered} />
      <Handle type="source" position={Position.Right}
        style={{ ...HANDLE_BASE, background: '#16a34a', opacity: hovered || selected ? 1 : 0 }} />
    </div>
  )
})

// ── Task Nodes ────────────────────────────────────────────────────────────────

export const ReviewTaskNode = memo(function ReviewTaskNode({ id, data, selected }) {
  return (
    <NodeCard nodeId={id} label={data.label || 'Review Task'} onLabelChange={l => data._onLabelChange?.(id, l)}
      Icon={UserCheck} color="#2563eb" selected={selected}
      badge={data.assignedGroup?.replace('ECM_', '')}
      onQuickAdd={data._onQuickAdd} onDelete={data._onDelete} onDuplicate={data._onDuplicate} />
  )
})

export const InfoWaitNode = memo(function InfoWaitNode({ id, data, selected }) {
  return (
    <NodeCard nodeId={id} label={data.label || 'Wait for Response'} onLabelChange={l => data._onLabelChange?.(id, l)}
      Icon={MessageSquare} color="#d97706" selected={selected} badge="Submitter"
      onQuickAdd={data._onQuickAdd} onDelete={data._onDelete} onDuplicate={data._onDuplicate} />
  )
})

export const NotificationNode = memo(function NotificationNode({ id, data, selected }) {
  return (
    <NodeCard nodeId={id} label={data.label || 'Send Email'} onLabelChange={l => data._onLabelChange?.(id, l)}
      Icon={Mail} color="#9333ea" selected={selected}
      badge={data.subject ? data.subject.slice(0, 20) : null}
      onQuickAdd={data._onQuickAdd} onDelete={data._onDelete} onDuplicate={data._onDuplicate} />
  )
})

export const DocuSignNode = memo(function DocuSignNode({ id, data, selected }) {
  return (
    <NodeCard nodeId={id} label={data.label || 'Send for Signature'} onLabelChange={l => data._onLabelChange?.(id, l)}
      Icon={PenTool} color="#4f46e5" selected={selected} badge="DocuSign"
      onQuickAdd={data._onQuickAdd} onDelete={data._onDelete} onDuplicate={data._onDuplicate} />
  )
})

// ── Decision Node ─────────────────────────────────────────────────────────────

export const DecisionNode = memo(function DecisionNode({ id, data, selected }) {
  const [hovered, setHovered] = useState(false)
  const color = '#ea580c'
  // One source handle per outcome, fanned vertically along the right edge —
  // falls back to a plain 2-way default/alt pair for a freshly-placed node
  // that has no outcomes yet (nothing loaded from DSL).
  const outcomes = data.outcomes?.length > 0 ? data.outcomes : [{ id: 'default' }, { id: 'alt' }]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {selected && data._onDelete && (
        <NodeToolbar isVisible position={Position.Top} offset={8}>
          <div style={{ display: 'flex', gap: 2, background: 'white', borderRadius: 8, border: '1px solid #e2e8f0', padding: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            {data._onDuplicate && <button onClick={() => data._onDuplicate(id)} style={{ padding: '4px 6px', borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer' }}><Copy size={12} color="#6b7280" /></button>}
            <button onClick={() => data._onDelete(id)} style={{ padding: '4px 6px', borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer' }}><Trash2 size={12} color="#ef4444" /></button>
          </div>
        </NodeToolbar>
      )}
      <div style={{ position: 'relative', width: 56, height: 56 }}>
        <Handle type="target" position={Position.Left}
          style={{ ...HANDLE_BASE, background: color, top: '50%', opacity: hovered || selected ? 1 : 0 }} />
        <div style={{
          width: 56, height: 56, clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
          position: 'relative',
        }}>
          <div style={{ position: 'absolute', inset: 0, clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', background: selected ? color : '#fdba74' }} />
          <div style={{ position: 'absolute', inset: 2.5, clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)', background: selected ? '#fff7ed' : 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <GitBranch size={16} color={color} />
          </div>
        </div>
        {outcomes.map((o, i) => (
          <Handle key={o.id || i} type="source" position={Position.Right} id={o.id || `out_${i}`}
            style={{
              ...HANDLE_BASE, background: color,
              top: `${((i + 1) / (outcomes.length + 1)) * 100}%`,
              opacity: hovered || selected ? 1 : 0,
            }} />
        ))}
      </div>
      <EditableLabel value={data.label || 'Decision'} onChange={l => data._onLabelChange?.(id, l)}
        style={{ fontSize: 10, fontWeight: 600, color, textAlign: 'center' }} />
    </div>
  )
})

// ── End Nodes ─────────────────────────────────────────────────────────────────

function EndNode({ id, data, selected, Icon, color, bg, defaultLabel }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      {selected && data._onDelete && (
        <NodeToolbar isVisible position={Position.Top} offset={8}>
          <div style={{ display: 'flex', gap: 2, background: 'white', borderRadius: 8, border: '1px solid #e2e8f0', padding: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <button onClick={() => data._onDelete(id)} style={{ padding: '4px 6px', borderRadius: 6, border: 'none', background: 'none', cursor: 'pointer' }}><Trash2 size={12} color="#ef4444" /></button>
          </div>
        </NodeToolbar>
      )}
      <Handle type="target" position={Position.Left}
        style={{ ...HANDLE_BASE, background: color, opacity: hovered || selected ? 1 : 0 }} />
      <CircleNode Icon={Icon} color={color} bg={bg} label={data.label || defaultLabel}
        onLabelChange={l => data._onLabelChange?.(id, l)} selected={selected} hovered={hovered} size={48} editable />
    </div>
  )
}

export const EndApprovedNode = memo(function EndApprovedNode(props) {
  return <EndNode {...props} Icon={CheckCircle} color="#16a34a" bg="#dcfce7" defaultLabel="Approved" />
})
export const EndRejectedNode = memo(function EndRejectedNode(props) {
  return <EndNode {...props} Icon={XCircle} color="#dc2626" bg="#fee2e2" defaultLabel="Rejected" />
})
export const EndCancelledNode = memo(function EndCancelledNode(props) {
  return <EndNode {...props} Icon={Ban} color="#6b7280" bg="#f3f4f6" defaultLabel="Cancelled" />
})

// ── Sticky Note Node ──────────────────────────────────────────────────────────

export const StickyNoteNode = memo(function StickyNoteNode({ id, data, selected }) {
  return (
    <div style={{
      background: '#fefce8', border: `1.5px solid ${selected ? '#eab308' : '#fde68a'}`,
      borderRadius: 8, padding: '8px 10px', minWidth: 120, maxWidth: 200,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)', fontStyle: 'italic',
    }}>
      {selected && data._onDelete && (
        <NodeToolbar isVisible position={Position.Top} offset={6}>
          <div style={{ background: 'white', borderRadius: 6, border: '1px solid #e2e8f0', padding: 2, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
            <button onClick={() => data._onDelete(id)} style={{ padding: '3px 5px', borderRadius: 4, border: 'none', background: 'none', cursor: 'pointer' }}><Trash2 size={11} color="#ef4444" /></button>
          </div>
        </NodeToolbar>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <StickyNote size={10} color="#ca8a04" />
        <span style={{ fontSize: 9, fontWeight: 700, color: '#a16207', textTransform: 'uppercase' }}>Note</span>
      </div>
      <EditableLabel value={data.label || 'Add note...'} onChange={l => data._onLabelChange?.(id, l)}
        style={{ fontSize: 11, color: '#713f12', lineHeight: 1.4 }} />
    </div>
  )
})

// ── Registry ──────────────────────────────────────────────────────────────────

export const nodeTypes = {
  start:        StartNode,
  reviewTask:   ReviewTaskNode,
  infoWait:     InfoWaitNode,
  notification: NotificationNode,
  docusign:     DocuSignNode,
  decision:     DecisionNode,
  endApproved:  EndApprovedNode,
  endRejected:  EndRejectedNode,
  endCancelled: EndCancelledNode,
  stickyNote:   StickyNoteNode,
}

// ── Palette ───────────────────────────────────────────────────────────────────

export const PALETTE_GROUPS = [
  { title: 'Actions', items: [
    { type: 'reviewTask',   label: 'Review Task',        icon: UserCheck,     color: '#2563eb', desc: 'Assign to group for review' },
    { type: 'infoWait',     label: 'Wait for Response',  icon: MessageSquare, color: '#d97706', desc: 'Request info from submitter' },
    { type: 'notification', label: 'Send Email',         icon: Mail,          color: '#9333ea', desc: 'Send notification' },
    { type: 'docusign',     label: 'Send for Signature', icon: PenTool,       color: '#4f46e5', desc: 'DocuSign signing' },
  ]},
  { title: 'Logic', items: [
    { type: 'decision', label: 'Decision', icon: GitBranch, color: '#ea580c', desc: 'Route by outcome' },
  ]},
  { title: 'End', items: [
    { type: 'endApproved',  label: 'Approved',  icon: CheckCircle, color: '#16a34a', desc: 'Complete (approved)' },
    { type: 'endRejected',  label: 'Rejected',  icon: XCircle,     color: '#dc2626', desc: 'Complete (rejected)' },
    { type: 'endCancelled', label: 'Cancelled',  icon: Ban,         color: '#6b7280', desc: 'Complete (cancelled)' },
  ]},
  { title: 'Annotate', items: [
    { type: 'stickyNote', label: 'Sticky Note', icon: StickyNote, color: '#ca8a04', desc: 'Canvas annotation' },
  ]},
]

export const PALETTE_ITEMS = PALETTE_GROUPS.flatMap(g => g.items)

// ── Connection validation ─────────────────────────────────────────────────────

export function isValidConnection(connection, nodes) {
  const src = nodes.find(n => n.id === connection.source)
  const tgt = nodes.find(n => n.id === connection.target)
  if (!src || !tgt) return false
  if (tgt.type === 'start') return false
  if (src.type?.startsWith('end')) return false
  if (src.type === 'stickyNote' || tgt.type === 'stickyNote') return false
  if (connection.source === connection.target) return false
  return true
}
