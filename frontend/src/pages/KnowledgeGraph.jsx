import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import { Waypoints, MousePointerClick, RotateCcw, Search, X, ChevronRight, Filter, Maximize2 } from 'lucide-react'
import { useGraph } from '../api/queries'
import AsyncSection from '../components/common/AsyncSection'
import { SkeletonBlock } from '../components/common/Skeleton'
import EmptyState from '../components/common/EmptyState'

const KIND_COLORS = {
  site: '#0064a6',
  area: '#009ef0',
  activity: '#6dcfff',
  hazard: '#ea580c',
  barrier: '#7c3aed',
  root_cause: '#64748b',
  outcome: '#dc2626',
  department: '#16a34a',
  report: '#94a3b8',
  control: '#0ea5e9',
}

const KIND_LEGEND = [
  ['site', 'Site'],
  ['area', 'Area'],
  ['activity', 'Activity'],
  ['hazard', 'Hazard'],
  ['barrier', 'Barrier'],
  ['root_cause', 'Root cause'],
  ['outcome', 'Outcome'],
  ['department', 'Department'],
  ['report', 'Report'],
]

function colorForKind(kind) {
  return KIND_COLORS[String(kind || '').toLowerCase()] || '#94a3b8'
}

/* ── helper: build adjacency map ────────────────────────────────────── */
function buildAdjacency(links) {
  const adj = {}
  links.forEach((l) => {
    const s = typeof l.source === 'object' ? l.source.id : l.source
    const t = typeof l.target === 'object' ? l.target.id : l.target
    if (!adj[s]) adj[s] = new Set()
    if (!adj[t]) adj[t] = new Set()
    adj[s].add(t)
    adj[t].add(s)
  })
  return adj
}

/* ── 3D Graph Canvas ──────────────────────────────────────────────────── */

function Graph3DCanvas({ graph, onNodeClick, selectedNodeId, highlightNodes, highlightLinks, hiddenKinds, hoveredId, setHoveredId }) {
  const fgRef = useRef()
  const containerRef = useRef()
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setDimensions({ width: entry.contentRect.width || 800, height: entry.contentRect.height || 600 })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const barrierIds = useMemo(
    () => new Set((graph.top_barrier_centrality || []).map((b) => b.node)),
    [graph.top_barrier_centrality]
  )

  const graphData = useMemo(() => {
    const nodes = graph.nodes
      .filter((n) => !hiddenKinds.has(n.data.kind))
      .map((n) => ({
        id: n.data.id,
        label: n.data.label,
        kind: n.data.kind,
        isTopBarrier: barrierIds.has(n.data.id),
        val: barrierIds.has(n.data.id) ? 6 : n.data.kind === 'report' ? 1 : 3,
      }))
    const nodeIds = new Set(nodes.map((n) => n.id))
    const edges = (graph.edges || [])
      .filter((e) => {
        const src = e.data?.source
        const tgt = e.data?.target
        return src && tgt && nodeIds.has(src) && nodeIds.has(tgt)
      })
      .map((e) => ({ source: e.data.source, target: e.data.target }))
    return { nodes, links: edges }
  }, [graph, barrierIds, hiddenKinds])

  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return graphData
    const term = searchTerm.toLowerCase()
    const matchingNodeIds = new Set(
      graphData.nodes
        .filter((n) => n.label?.toLowerCase().includes(term) || n.kind?.toLowerCase().includes(term))
        .map((n) => n.id)
    )
    graphData.links.forEach((l) => {
      const src = typeof l.source === 'object' ? l.source.id : l.source
      const tgt = typeof l.target === 'object' ? l.target.id : l.target
      if (matchingNodeIds.has(src)) matchingNodeIds.add(tgt)
      if (matchingNodeIds.has(tgt)) matchingNodeIds.add(src)
    })
    return {
      nodes: graphData.nodes.filter((n) => matchingNodeIds.has(n.id)),
      links: graphData.links.filter((l) => {
        const src = typeof l.source === 'object' ? l.source.id : l.source
        const tgt = typeof l.target === 'object' ? l.target.id : l.target
        return matchingNodeIds.has(src) && matchingNodeIds.has(tgt)
      }),
    }
  }, [graphData, searchTerm])

  const handleResetCamera = useCallback(() => {
    fgRef.current?.cameraPosition({ x: 0, y: 0, z: 400 }, { x: 0, y: 0, z: 0 }, 800)
  }, [])

  const handleNodeClick = useCallback(
    (node) => {
      if (onNodeClick) onNodeClick(node, filteredData.links)
      const distance = 120
      const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z)
      fgRef.current?.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
        node,
        800
      )
    },
    [onNodeClick, filteredData.links]
  )

  const isHighlightActive = highlightNodes.size > 0

  return (
    <div ref={containerRef} className="relative w-full h-full" style={{ minHeight: 600 }}>
      {/* Controls bar */}
      <div className="absolute top-3 left-3 right-3 z-10 flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-3" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search nodes..."
            className="h-8 w-full rounded-lg border border-line bg-surface/90 pl-8 pr-3 text-xs text-fg backdrop-blur-sm placeholder:text-fg-3 focus:border-brand-500 focus:outline-none"
          />
          {searchTerm && (
            <button type="button" onClick={() => setSearchTerm('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-fg-3 hover:text-fg">
              <X size={12} />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleResetCamera}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface/90 px-3 text-xs font-bold text-fg-2 backdrop-blur-sm transition-colors hover:bg-surface-2"
          title="Reset camera"
        >
          <RotateCcw size={13} />
          Reset
        </button>
      </div>

      {/* Stats badge */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2 rounded-lg border border-line bg-surface/90 px-3 py-1.5 text-2xs font-semibold text-fg-3 backdrop-blur-sm">
        <span>{filteredData.nodes.length} nodes</span>
        <span className="text-line-2">·</span>
        <span>{filteredData.links.length} edges</span>
      </div>

      <ForceGraph3D
        ref={fgRef}
        graphData={filteredData}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="rgba(0,0,0,0)"
        nodeLabel={(node) =>
          `<div style="background:#1e293b;color:#e2e8f0;padding:6px 10px;border-radius:8px;font-size:11px;font-weight:600;border:1px solid #334155;box-shadow:0 4px 12px rgba(0,0,0,0.3)"><span style="color:${colorForKind(node.kind)};text-transform:uppercase;font-size:9px;letter-spacing:0.05em">${node.kind}</span><br/>${node.label}</div>`
        }
        nodeColor={(node) => {
          if (selectedNodeId && node.id === selectedNodeId) return '#facc15'
          if (isHighlightActive && !highlightNodes.has(node.id)) return 'rgba(60,70,90,0.25)'
          if (hoveredId && hoveredId === node.id) return '#facc15'
          return colorForKind(node.kind)
        }}
        nodeOpacity={0.92}
        nodeResolution={16}
        nodeVal={(node) => {
          if (selectedNodeId && node.id === selectedNodeId) return 8
          if (isHighlightActive && highlightNodes.has(node.id) && node.id !== selectedNodeId) return 5
          return node.val
        }}
        linkColor={(link) => {
          if (!isHighlightActive) return 'rgba(100,130,170,0.18)'
          const s = typeof link.source === 'object' ? link.source.id : link.source
          const t = typeof link.target === 'object' ? link.target.id : link.target
          if (highlightLinks.has(`${s}||${t}`) || highlightLinks.has(`${t}||${s}`)) return 'rgba(250,204,21,0.7)'
          return 'rgba(60,70,90,0.08)'
        }}
        linkWidth={(link) => {
          if (!isHighlightActive) return 0.5
          const s = typeof link.source === 'object' ? link.source.id : link.source
          const t = typeof link.target === 'object' ? link.target.id : link.target
          if (highlightLinks.has(`${s}||${t}`) || highlightLinks.has(`${t}||${s}`)) return 2
          return 0.3
        }}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        linkDirectionalParticles={(link) => {
          if (!isHighlightActive) return 0
          const s = typeof link.source === 'object' ? link.source.id : link.source
          const t = typeof link.target === 'object' ? link.target.id : link.target
          if (highlightLinks.has(`${s}||${t}`) || highlightLinks.has(`${t}||${s}`)) return 3
          return 0
        }}
        linkDirectionalParticleWidth={1.5}
        linkDirectionalParticleColor={() => '#facc15'}
        onNodeClick={handleNodeClick}
        onNodeHover={(node) => setHoveredId(node?.id || null)}
        onBackgroundClick={() => { if (onNodeClick) onNodeClick(null) }}
        enableNodeDrag
        enableNavigationControls
        showNavInfo={false}
      />
    </div>
  )
}

/* ── Neighbors panel ────────────────────────────────────────────────── */

function NeighborsList({ neighbors, nodeMap, onNavigate }) {
  const grouped = useMemo(() => {
    const g = {}
    neighbors.forEach((id) => {
      const node = nodeMap.get(id)
      if (!node) return
      const k = node.kind || 'unknown'
      if (!g[k]) g[k] = []
      g[k].push(node)
    })
    // sort groups by count desc
    return Object.entries(g).sort((a, b) => b[1].length - a[1].length)
  }, [neighbors, nodeMap])

  if (grouped.length === 0) return <p className="text-xs text-fg-3 italic">No connections found.</p>

  return (
    <div className="space-y-2 max-h-[280px] overflow-y-auto scrollbar-slim pr-1">
      {grouped.map(([kind, nodes]) => (
        <div key={kind}>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="h-2 w-2 rounded-full" style={{ background: colorForKind(kind) }} />
            <span className="text-2xs font-bold uppercase tracking-wider text-fg-3">{kind.replace('_', ' ')}</span>
            <span className="text-2xs text-fg-3/60 font-semibold">({nodes.length})</span>
          </div>
          <div className="space-y-0.5 pl-3.5">
            {nodes.slice(0, 10).map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => onNavigate(n)}
                className="group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs text-fg-2 font-medium transition-all hover:bg-surface-2 hover:text-fg"
              >
                <span className="min-w-0 flex-1 truncate">{n.label}</span>
                <ChevronRight size={11} className="shrink-0 text-fg-3/40 transition-transform group-hover:translate-x-0.5 group-hover:text-fg-3" />
              </button>
            ))}
            {nodes.length > 10 && <p className="text-2xs text-fg-3 italic pl-2">+{nodes.length - 10} more</p>}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Main page ────────────────────────────────────────────────────────── */

export default function KnowledgeGraph() {
  const [limit, setLimit] = useState(150)
  const graphQuery = useGraph({ limit })
  const [selectedNode, setSelectedNode] = useState(null)
  const [highlightNodes, setHighlightNodes] = useState(new Set())
  const [highlightLinks, setHighlightLinks] = useState(new Set())
  const [neighbors, setNeighbors] = useState([])
  const [hiddenKinds, setHiddenKinds] = useState(new Set())
  const [hoveredId, setHoveredId] = useState(null)
  const fgContainerRef = useRef()

  // Build a node map for quick lookup
  const nodeMap = useMemo(() => {
    const map = new Map()
    if (graphQuery.data?.nodes) {
      graphQuery.data.nodes.forEach((n) => map.set(n.data.id, { id: n.data.id, label: n.data.label, kind: n.data.kind }))
    }
    return map
  }, [graphQuery.data])

  const handleNodeClick = useCallback(
    (node, links) => {
      if (!node) {
        setSelectedNode(null)
        setHighlightNodes(new Set())
        setHighlightLinks(new Set())
        setNeighbors([])
        return
      }
      const adj = links ? buildAdjacency(links) : {}
      const nbrs = adj[node.id] ? [...adj[node.id]] : []
      const hl = new Set([node.id, ...nbrs])
      const hlLinks = new Set()
      if (links) {
        links.forEach((l) => {
          const s = typeof l.source === 'object' ? l.source.id : l.source
          const t = typeof l.target === 'object' ? l.target.id : l.target
          if (s === node.id || t === node.id) hlLinks.add(`${s}||${t}`)
        })
      }
      setSelectedNode({ id: node.id, label: node.label, kind: node.kind, isTopBarrier: node.isTopBarrier, degree: nbrs.length })
      setHighlightNodes(hl)
      setHighlightLinks(hlLinks)
      setNeighbors(nbrs)
    },
    []
  )

  // Navigate to neighbor node — simulate a click
  const handleNavigateToNode = useCallback(
    (targetNode) => {
      // Rebuild from current graph data
      if (!graphQuery.data) return
      const allNodes = graphQuery.data.nodes.filter((n) => !hiddenKinds.has(n.data.kind))
      const nodeIds = new Set(allNodes.map((n) => n.data.id))
      const links = (graphQuery.data.edges || [])
        .filter((e) => nodeIds.has(e.data?.source) && nodeIds.has(e.data?.target))
        .map((e) => ({ source: e.data.source, target: e.data.target }))
      handleNodeClick({ ...targetNode, isTopBarrier: false, val: 3 }, links)
    },
    [graphQuery.data, hiddenKinds, handleNodeClick]
  )

  const toggleKind = useCallback((kind) => {
    setHiddenKinds((prev) => {
      const next = new Set(prev)
      if (next.has(kind)) next.delete(kind)
      else next.add(kind)
      return next
    })
  }, [])

  return (
    <div className="space-y-5">
      {/* Header */}
      <section className="card p-5 bg-gradient-to-br from-surface to-surface-2/10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-500 ring-1 ring-brand-500/20 dark:bg-brand-500/20 dark:text-brand-300 dark:ring-brand-500/30 shadow-sm">
              <Waypoints size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold tracking-tight text-fg">Safety Knowledge Graph</h2>
              <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-fg-2 font-medium">
                Interactive 3D visualization. Click nodes to explore connections, toggle types in the legend, click neighbors to navigate.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <label className="eyebrow text-fg-3" htmlFor="graph-limit">Nodes</label>
            <select
              id="graph-limit"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="h-8 rounded-lg border border-line bg-surface px-2.5 text-xs font-semibold text-fg-2 transition-all hover:bg-surface-2 focus:outline-none"
            >
              {[50, 100, 150, 300].map((n) => (
                <option key={n} value={n}>{n} nodes</option>
              ))}
            </select>
          </div>
        </div>

        {/* Legend with interactive toggles */}
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line pt-3.5">
          <span className="flex items-center gap-1.5 eyebrow text-fg-3 font-bold"><Filter size={11} /> Filter</span>
          {KIND_LEGEND.map(([kind, label]) => {
            const isHidden = hiddenKinds.has(kind)
            return (
              <button
                key={kind}
                type="button"
                onClick={() => toggleKind(kind)}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-all border ${
                  isHidden
                    ? 'border-line bg-surface-2/50 text-fg-3/40 line-through'
                    : 'border-transparent bg-surface-2 text-fg-2 hover:bg-surface-3'
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full ring-1 ring-surface transition-opacity"
                  style={{ background: isHidden ? '#475569' : KIND_COLORS[kind], opacity: isHidden ? 0.3 : 1 }}
                />
                {label}
              </button>
            )
          })}
          {hiddenKinds.size > 0 && (
            <button
              type="button"
              onClick={() => setHiddenKinds(new Set())}
              className="text-2xs font-bold text-brand-500 hover:text-brand-400 transition-colors ml-1"
            >
              Show all
            </button>
          )}
        </div>
      </section>

      {/* Main content: graph + sidebar */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="card overflow-hidden" style={{ background: '#0a0f1a' }}>
          <AsyncSection
            query={graphQuery}
            componentName="Knowledge graph canvas"
            skeleton={<SkeletonBlock className="h-[600px] w-full rounded-none" />}
            isEmpty={(data) => !data?.nodes || data.nodes.length === 0}
            empty={
              <div className="p-4">
                <EmptyState title="Graph is empty" message="The knowledge graph populates once relationships have been extracted from reports." />
              </div>
            }
          >
            {(graph) => (
              <Graph3DCanvas
                graph={graph}
                onNodeClick={handleNodeClick}
                selectedNodeId={selectedNode?.id}
                highlightNodes={highlightNodes}
                highlightLinks={highlightLinks}
                hiddenKinds={hiddenKinds}
                hoveredId={hoveredId}
                setHoveredId={setHoveredId}
              />
            )}
          </AsyncSection>
        </section>

        <aside className="space-y-5">
          {/* Selected node detail */}
          <section className="card bg-gradient-to-br from-surface to-surface-2/10">
            <div className="card-header bg-gradient-to-r from-surface to-surface-2/10">
              <h2 className="card-title text-fg font-bold">
                {selectedNode ? 'Node Inspector' : 'Selected Node'}
              </h2>
              {selectedNode && (
                <button
                  type="button"
                  onClick={() => handleNodeClick(null)}
                  className="text-fg-3 hover:text-fg transition-colors"
                  title="Clear selection"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="p-4">
              {!selectedNode ? (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <MousePointerClick size={22} className="text-fg-3 animate-pulse" aria-hidden="true" />
                  <p className="text-xs leading-relaxed text-fg-3 font-semibold">
                    Click a node to inspect its connections and navigate the graph.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5 animate-fade-up">
                  <div className="flex items-start gap-2.5">
                    <span
                      className="mt-1.5 h-3 w-3 shrink-0 rounded-full ring-2 ring-surface shadow-lg"
                      style={{ background: colorForKind(selectedNode.kind), boxShadow: `0 0 10px ${colorForKind(selectedNode.kind)}` }}
                    />
                    <p className="min-w-0 break-words font-display text-sm font-bold tracking-tight text-fg">
                      {selectedNode.label}
                    </p>
                  </div>
                  <dl className="space-y-2 text-xs border-t border-line/60 pt-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="eyebrow text-fg-3">Kind</dt>
                      <dd className="font-bold uppercase text-[10px] tracking-wide px-2 py-0.5 rounded-full" style={{ background: colorForKind(selectedNode.kind) + '22', color: colorForKind(selectedNode.kind) }}>
                        {selectedNode.kind}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="eyebrow text-fg-3">Connections</dt>
                      <dd className="font-bold text-fg tabular-nums">{selectedNode.degree}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="eyebrow text-fg-3 shrink-0">Id</dt>
                      <dd className="min-w-0 break-all text-right font-mono text-2xs text-fg-3 font-semibold">{selectedNode.id}</dd>
                    </div>
                  </dl>
                  {selectedNode.isTopBarrier && (
                    <p className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
                      ⚡ High betweenness centrality — critical control point
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Neighbors panel */}
          {selectedNode && neighbors.length > 0 && (
            <section className="card bg-gradient-to-br from-surface to-surface-2/10">
              <div className="card-header bg-gradient-to-r from-surface to-surface-2/10">
                <h2 className="card-title text-fg font-bold">Connected Nodes</h2>
                <span className="text-2xs font-bold text-fg-3 tabular-nums bg-surface-2 rounded-full px-2 py-0.5">{neighbors.length}</span>
              </div>
              <div className="p-4">
                <NeighborsList neighbors={neighbors} nodeMap={nodeMap} onNavigate={handleNavigateToNode} />
              </div>
            </section>
          )}

          {/* Top barrier centrality */}
          <section className="card bg-gradient-to-br from-surface to-surface-2/10">
            <div className="card-header bg-gradient-to-r from-surface to-surface-2/10">
              <h2 className="card-title text-fg font-bold">Top Barrier Centrality</h2>
            </div>
            <div className="p-4">
              <AsyncSection
                query={graphQuery}
                componentName="Top barrier list"
                skeleton={<SkeletonBlock className="h-24 w-full" />}
                isEmpty={(data) => !data?.top_barrier_centrality || data.top_barrier_centrality.length === 0}
                empty={<p className="text-xs text-fg-3">No centrality data available.</p>}
              >
                {(graph) => (
                  <ol className="space-y-1.5 text-xs">
                    {graph.top_barrier_centrality.map((b, i) => (
                      <li
                        key={b.node}
                        className="flex items-center gap-2 rounded-xl bg-surface/50 border border-line px-2.5 py-2 transition-all duration-180 hover:-translate-y-px hover:border-line-2 hover:shadow-sm cursor-pointer"
                        onClick={() => {
                          const n = nodeMap.get(b.node)
                          if (n) handleNavigateToNode(n)
                        }}
                      >
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-surface-2 font-mono text-2xs font-extrabold tabular-nums text-fg-3">
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-semibold text-fg-2" title={b.label}>{b.label}</span>
                        <span className="shrink-0 font-bold tabular-nums text-fg-3">{b.centrality.toFixed(3)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </AsyncSection>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}