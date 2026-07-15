/**
 * autoLayout.js — Dagre-based auto-layout for React Flow nodes.
 *
 * Takes nodes + edges, returns nodes with updated positions.
 * Direction: left-to-right (LR).
 */
import dagre from '@dagrejs/dagre'

const NODE_WIDTH = 180
const NODE_HEIGHT = 60
const CIRCLE_SIZE = 56

export function getAutoLayout(nodes, edges, direction = 'LR') {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 120, edgesep: 30 })

  for (const node of nodes) {
    const isCircle = node.type === 'start' || node.type?.startsWith('end')
    const isDiamond = node.type === 'decision'
    g.setNode(node.id, {
      width: isCircle ? CIRCLE_SIZE : isDiamond ? 70 : NODE_WIDTH,
      height: isCircle ? CIRCLE_SIZE : isDiamond ? 70 : NODE_HEIGHT,
    })
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  return nodes.map(node => {
    const pos = g.node(node.id)
    const isCircle = node.type === 'start' || node.type?.startsWith('end')
    const isDiamond = node.type === 'decision'
    const w = isCircle ? CIRCLE_SIZE : isDiamond ? 70 : NODE_WIDTH
    const h = isCircle ? CIRCLE_SIZE : isDiamond ? 70 : NODE_HEIGHT
    return {
      ...node,
      position: { x: pos.x - w / 2, y: pos.y - h / 2 },
    }
  })
}
