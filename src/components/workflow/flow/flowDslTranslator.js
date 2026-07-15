/**
 * flowDslTranslator.js
 *
 * Bidirectional translation between React Flow graph and WorkflowTemplateDsl JSON.
 *
 * flowToDsl(nodes, edges, meta) → WorkflowTemplateDsl JSON
 * dslToFlow(dsl)                → { nodes, edges }
 *
 * DSL step types: USER_TASK, INFO_WAIT, NOTIFICATION, DOCUSIGN, PARALLEL_TASKS
 * Node types:     reviewTask, infoWait, notification, docusign, decision, endApproved, endRejected, endCancelled
 */
import { getAutoLayout } from './autoLayout'

// ── Node type → DSL step type mapping ─────────────────────────────────────────

const NODE_TO_DSL_TYPE = {
  reviewTask:   'USER_TASK',
  infoWait:     'INFO_WAIT',
  notification: 'NOTIFICATION',
  docusign:     'DOCUSIGN',
}

const DSL_TYPE_TO_NODE = {
  USER_TASK:    'reviewTask',
  INFO_WAIT:    'infoWait',
  NOTIFICATION: 'notification',
  DOCUSIGN:     'docusign',
}

const END_STATUS_MAP = {
  endApproved:  'COMPLETED',
  endRejected:  'REJECTED',
  endCancelled: 'CANCELLED',
}

const STATUS_TO_END_NODE = {
  COMPLETED: 'endApproved',
  REJECTED:  'endRejected',
  CANCELLED: 'endCancelled',
}

// ── Flow → DSL ────────────────────────────────────────────────────────────────

/**
 * Convert React Flow nodes and edges to WorkflowTemplateDsl JSON.
 *
 * @param {Array} nodes - React Flow nodes
 * @param {Array} edges - React Flow edges
 * @param {Object} meta - { processKey, name, variables }
 * @returns {Object} WorkflowTemplateDsl
 */
export function flowToDsl(nodes, edges, meta = {}) {
  const steps = []
  const endStates = []
  const variables = { ...meta.variables }

  // Build adjacency: source → [{ target, sourceHandle, label }]
  const outgoing = {}
  for (const edge of edges) {
    if (!outgoing[edge.source]) outgoing[edge.source] = []
    outgoing[edge.source].push({
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      label: edge.data?.label || edge.label || '',
    })
  }

  // Find start node
  const startNode = nodes.find(n => n.type === 'start')
  if (!startNode) return { processKey: meta.processKey, name: meta.name, variables, steps, endStates }

  // Collect end states
  for (const node of nodes) {
    if (END_STATUS_MAP[node.type]) {
      endStates.push({
        id: node.id,
        name: node.data?.label || node.type.replace('end', ''),
        status: END_STATUS_MAP[node.type],
      })
    }
  }

  // Walk from start through the graph, converting nodes to steps
  const visited = new Set()

  function processNode(nodeId) {
    if (visited.has(nodeId)) return
    visited.add(nodeId)

    const node = nodes.find(n => n.id === nodeId)
    if (!node || node.type === 'start' || END_STATUS_MAP[node.type]) return

    const dslType = NODE_TO_DSL_TYPE[node.type]
    if (!dslType && node.type !== 'decision') return

    // For decision nodes, we don't create a DSL step — the outcomes
    // are attached to the preceding step. But if decision is standalone
    // (connected from start or a step), we need to handle it.
    if (node.type === 'decision') {
      // Decision nodes route edges to downstream targets
      // The DSL expresses this as outcomes on the upstream step
      // But if a decision follows a step, we handle it in the step's outcomes
      return
    }

    const step = {
      id: node.id,
      type: dslType,
      name: node.data?.label || node.type,
      outcomes: [],
    }

    // Type-specific fields
    if (dslType === 'USER_TASK') {
      const group = node.data?.assignedGroup || 'ECM_REVIEWER'
      const varKey = 'group_' + node.id
      variables[varKey] = group
      step.candidateGroupVariable = varKey
    } else if (dslType === 'DOCUSIGN') {
      step.docusignSubjectTemplate = node.data?.subject || 'Please sign your document'
      step.docusignRecipientEmailVar = node.data?.recipientEmailVar || 'submittedBy'
      step.docusignRecipientNameVar = node.data?.recipientNameVar || ''
    }

    // Push step FIRST (before recursing into children) to maintain flow order
    steps.push(step)

    // Build outcomes from outgoing edges
    const nodeEdges = outgoing[nodeId] || []

    for (const edge of nodeEdges) {
      const targetNode = nodes.find(n => n.id === edge.target)
      if (!targetNode) continue

      // If the target is a decision node, the outcomes come from the decision's edges
      if (targetNode.type === 'decision') {
        const decisionEdges = outgoing[targetNode.id] || []
        for (const de of decisionEdges) {
          const outcomeLabel = de.label || de.sourceHandle || 'DEFAULT'
          step.outcomes.push({
            id: outcomeLabel.toUpperCase().replace(/\s+/g, '_'),
            label: outcomeLabel,
            next: de.target,
          })
          // Recursively process decision targets
          processNode(de.target)
        }
      } else {
        // Direct connection (no gateway)
        step.outcomes.push({
          id: 'next',
          label: edge.label || '',
          next: edge.target,
        })
        processNode(edge.target)
      }
    }
  }

  // Start walking from edges leaving the start node
  const startEdges = outgoing[startNode.id] || []
  console.log('[flowToDsl] Start node:', startNode.id, '| Outgoing from start:', startEdges)
  console.log('[flowToDsl] All nodes:', nodes.map(n => `${n.id}(${n.type})`).join(', '))
  console.log('[flowToDsl] All edges:', edges.map(e => `${e.source}→${e.target}`).join(', '))
  console.log('[flowToDsl] Outgoing map:', Object.entries(outgoing).map(([k, v]) => `${k}→[${v.map(e => e.target).join(',')}]`).join(' | '))

  for (const edge of startEdges) {
    processNode(edge.target)
  }

  console.log('[flowToDsl] Steps generated:', steps.map(s => `${s.id}(${s.type},outcomes=${s.outcomes.length})`).join(', '))
  console.log('[flowToDsl] End states:', endStates.map(e => e.id).join(', '))

  // Save full layout for round-trip fidelity
  // Strip function callbacks (prefixed with _) from node data before serialization
  const cleanData = (data) => {
    if (!data) return data
    const clean = {}
    for (const [k, v] of Object.entries(data)) {
      if (!k.startsWith('_') && typeof v !== 'function') clean[k] = v
    }
    return clean
  }

  const _flowLayout = {
    nodes: nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: cleanData(n.data) })),
    edges: edges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle, label: e.label || e.data?.label || '', waypoints: e.data?.waypoints || [] })),
  }

  return {
    processKey: meta.processKey || 'process_default',
    name: meta.name || 'Workflow',
    variables,
    steps,
    endStates,
    _flowLayout,
  }
}

// ── DSL → Flow ────────────────────────────────────────────────────────────────

/**
 * Convert WorkflowTemplateDsl JSON to React Flow nodes and edges.
 *
 * @param {Object} dsl - WorkflowTemplateDsl
 * @returns {{ nodes: Array, edges: Array }}
 */
export function dslToFlow(dsl) {
  if (!dsl) return { nodes: [], edges: [] }

  // If we have saved layout, use it directly (round-trip fidelity)
  if (dsl._flowLayout?.nodes?.length > 0) {
    return {
      nodes: dsl._flowLayout.nodes,
      edges: (dsl._flowLayout.edges || []).map(e => ({
        ...e,
        type: 'waypoint',
        label: e.label || '',
        data: { label: e.label || '', waypoints: e.waypoints || [] },
      })),
    }
  }

  // Otherwise, generate auto-layout from DSL steps
  const nodes = []
  const edges = []
  const variables = dsl.variables || {}
  let x = 50
  const Y_CENTER = 200
  const X_STEP = 250
  const Y_OFFSET = 120

  // Start node
  const startId = 'start_1'
  nodes.push({
    id: startId,
    type: 'start',
    position: { x, y: Y_CENTER },
    data: { label: 'Start' },
  })
  x += X_STEP

  const steps = dsl.steps || []
  const endStates = dsl.endStates || []

  // Place step nodes
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const nodeType = DSL_TYPE_TO_NODE[step.type] || 'reviewTask'

    const nodeData = { label: step.name || step.id }

    // Resolve assigned group from variables
    if (step.type === 'USER_TASK' && step.candidateGroupVariable) {
      nodeData.assignedGroup = variables[step.candidateGroupVariable] || step.candidateGroupVariable
    }
    if (step.type === 'DOCUSIGN') {
      nodeData.subject = step.docusignSubjectTemplate
      nodeData.recipientEmailVar = step.docusignRecipientEmailVar
      nodeData.recipientNameVar = step.docusignRecipientNameVar
    }

    nodes.push({
      id: step.id,
      type: nodeType,
      position: { x, y: Y_CENTER },
      data: nodeData,
    })

    // Connect from previous (start or prior step)
    if (i === 0) {
      edges.push({ id: `e_start_${step.id}`, source: startId, target: step.id })
    }

    // Handle outcomes
    const outcomes = step.outcomes || []
    if (outcomes.length === 0) {
      // No outcomes — continue to next step if exists
      if (i < steps.length - 1) {
        edges.push({ id: `e_${step.id}_${steps[i + 1].id}`, source: step.id, target: steps[i + 1].id })
      }
    } else if (outcomes.length === 1 && outcomes[0].next) {
      // Single outcome — direct edge
      edges.push({
        id: `e_${step.id}_${outcomes[0].next}`,
        source: step.id,
        target: outcomes[0].next,
        label: outcomes[0].label || '',
      })
    } else if (outcomes.length > 1) {
      // Multiple outcomes — create decision node
      x += X_STEP
      const decId = `decision_${step.id}`
      nodes.push({
        id: decId,
        type: 'decision',
        position: { x, y: Y_CENTER },
        data: { label: 'Decision', outcomes: outcomes.map(o => ({ id: o.id, label: o.label })) },
      })
      edges.push({ id: `e_${step.id}_${decId}`, source: step.id, target: decId })

      // Edges from decision to targets
      outcomes.forEach((o, oi) => {
        edges.push({
          id: `e_${decId}_${o.id || oi}_${o.next}`,
          source: decId,
          sourceHandle: o.id || `out_${oi}`,
          target: o.next,
          label: o.label || o.id,
          data: { label: o.label || o.id },
        })
      })
    }

    x += X_STEP
  }

  // End state nodes
  endStates.forEach((es, i) => {
    const nodeType = STATUS_TO_END_NODE[es.status] || 'endApproved'
    const yOff = (i - (endStates.length - 1) / 2) * Y_OFFSET
    nodes.push({
      id: es.id,
      type: nodeType,
      position: { x: x + 50, y: Y_CENTER + yOff },
      data: { label: es.name || es.status },
    })
  })

  // Positions above are a rough left-to-right placeholder — run through dagre for
  // a real layout. This matters most for loop-back edges (e.g. a "Return" outcome
  // pointing at an earlier step): a naive straight-line placement draws those
  // arrows cutting through unrelated nodes, dagre ranks the graph properly instead.
  return { nodes: getAutoLayout(nodes, edges, 'LR'), edges }
}
