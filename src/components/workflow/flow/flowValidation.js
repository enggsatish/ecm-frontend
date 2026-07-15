/**
 * flowValidation.js
 *
 * Validates a React Flow graph before saving as DSL.
 * Returns { valid: boolean, errors: string[] }
 */

export function validateFlow(nodes, edges) {
  const errors = []

  // 1. Must have exactly one start node
  const startNodes = nodes.filter(n => n.type === 'start')
  if (startNodes.length === 0) errors.push('Missing start node')
  if (startNodes.length > 1) errors.push('Multiple start nodes — only one allowed')

  // 2. Must have at least one end node
  const endNodes = nodes.filter(n => n.type?.startsWith('end'))
  if (endNodes.length === 0) errors.push('Missing end node — add at least one (Approved, Rejected, or Cancelled)')

  // 3. Must have at least one step between start and end
  const stepNodes = nodes.filter(n => n.type !== 'start' && !n.type?.startsWith('end'))
  if (stepNodes.length === 0) errors.push('Add at least one step between start and end')

  // 4. All nodes must be connected (no orphans)
  const connectedIds = new Set()
  for (const edge of edges) {
    connectedIds.add(edge.source)
    connectedIds.add(edge.target)
  }
  for (const node of nodes) {
    if (!connectedIds.has(node.id)) {
      errors.push(`"${node.data?.label || node.id}" is not connected to any other step`)
    }
  }

  // 5. Start node must have outgoing edge
  if (startNodes.length === 1) {
    const startOutgoing = edges.filter(e => e.source === startNodes[0].id)
    if (startOutgoing.length === 0) errors.push('Start node has no outgoing connection')
  }

  // 6. End nodes must have incoming edge
  for (const endNode of endNodes) {
    const incoming = edges.filter(e => e.target === endNode.id)
    if (incoming.length === 0) {
      errors.push(`"${endNode.data?.label || endNode.id}" has no incoming connection`)
    }
  }

  // 7. Review task nodes must have assigned group
  for (const node of nodes) {
    if (node.type === 'reviewTask' && !node.data?.assignedGroup) {
      errors.push(`"${node.data?.label || node.id}" needs an assigned group`)
    }
  }

  // 8. Decision nodes should have at least 2 outgoing edges
  for (const node of nodes) {
    if (node.type === 'decision') {
      const outgoing = edges.filter(e => e.source === node.id)
      if (outgoing.length < 2) {
        errors.push(`Decision "${node.data?.label || node.id}" should have at least 2 outgoing paths`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}
