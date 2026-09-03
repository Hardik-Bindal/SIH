import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import { Waypoints, MousePointerClick, RotateCcw, Search } from 'lucide-react'
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

/* ── 3D Graph Canvas ──────────────────────────────────────────────────── */

function Graph3DCanvas({ graph, onNodeClick, selectedNodeId }) {
  const fgRef = useRef()
  const containerRef = useRef()
  const [dimensions, setDimensions] = useState({ width: 800, height: 560 })
  const [searchTerm, setSearchTerm] = useState('')

  // Responsive sizing
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setDimensions({
        width: entry.contentRect.width || 800,
        height: 560,
      })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const barrierIds = useMemo(
    () => new Set((graph.top_barrier_centrality || []).map((b) => b.node)),
    [graph.top_barrier_centrality]
  )

  // Build data for force-graph
  const graphData = useMemo(() => {
    const nodes = graph.nodes.map((n) => ({
      id: n.data.id,
      label: n.data.label,
      kind: n.data.kind,
      isTopBarrier: barrierIds.has(n.data.id),
      val: barrierIds.has(n.data.id) ? 6 : n.data.kind === 'report' ? 1 : 3,
    }))

    const nodeIds = new Set(nodes.map(n => n.id))
    const edges = (graph.edges || [])
      .filter(e => {
        const src = e.data?.source
        const tgt = e.data?.target
        return src && tgt && nodeIds.has(src) && nodeIds.has(tgt)
      })
      .map(e => ({
        source: e.data.source,
        target: e.data.target,
      }))

    return { nodes, links: edges }
  }, [graph, barrierIds])

  // Filter by search
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return graphData
    const term = searchTerm.toLowerCase()
    const matchingNodeIds = new Set(
      graphData.nodes
        .filter(n => n.label?.toLowerCase().includes(term) || n.kind?.toLowerCase().includes(term))
        .map(n => n.id)
    )
    // Include neighbors
    graphData.links.forEach(l => {
      const src = typeof l.source === 'object' ? l.source.id : l.source
      const tgt = typeof l.target === 'object' ? l.target.id : l.target
      if (matchingNodeIds.has(src)) matchingNodeIds.add(tgt)
      if (matchingNodeIds.has(tgt)) matchingNodeIds.add(src)
    })
    return {
      nodes: graphData.nodes.filter(n => matchingNodeIds.has(n.id)),
      links: graphData.links.filter(l => {
        const src = typeof l.source === 'object' ? l.source.id : l.source
        const tgt = typeof l.target === 'object' ? l.target.id : l.target
        return matchingNodeIds.has(src) && matchingNodeIds.has(tgt)
      }),
    }
  }, [graphData, searchTerm])

  const handleResetCamera = useCallback(() => {
    fgRef.current?.cameraPosition({ x: 0, y: 0, z: 400 }, { x: 0, y: 0, z: 0 }, 800)
  }, [])

  const handleNodeClick = useCallback((node) => {
    if (onNodeClick) onNodeClick(node)
    // Zoom to node
    const distance = 120
    const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z)
    fgRef.current?.cameraPosition(
      { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
      node,
      800
    )
  }, [onNodeClick])

  return (
    <div ref={containerRef} className="relative w-full" style={{ height: 560 }}>
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

      <ForceGraph3D
        ref={fgRef}
        graphData={filteredData}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="rgba(0,0,0,0)"
        nodeLabel={(node) => `<div style="background:#1e293b;color:#e2e8f0;padding:6px 10px;border-radius:8px;font-size:11px;font-weight:600;border:1px solid #334155;box-shadow:0 4px 12px rgba(0,0,0,0.3)"><span style="color:${colorForKind(node.kind)};text-transform:uppercase;font-size:9px;letter-spacing:0.05em">${node.kind}</span><br/>${node.label}</div>`}
        nodeColor={(node) => {
          if (selectedNodeId && node.id === selectedNodeId) return '#ef4444'
          return colorForKind(node.kind)
        }}
        nodeOpacity={0.92}
        nodeResolution={12}
        linkColor={() => 'rgba(100,130,170,0.2)'}
        linkWidth={0.5}
        linkDirectionalArrowLength={3}
        linkDirectionalArrowRelPos={1}
        onNodeClick={handleNodeClick}
        enableNodeDrag
        enableNavigationControls
        showNavInfo={false}
      />
    </div>
  )
}

/* ── Main page ────────────────────────────────────────────────────────── */

export default function KnowledgeGraph() {
  const [limit, setLimit] = useState(150)
  const graphQuery = useGraph({ limit })
  const [selectedNode, setSelectedNode] = useState(null)

  const handleNodeClick = useCallback((node) => {
    setSelectedNode({
      id: node.id,
      label: node.label,
      kind: node.kind,
      isTopBarrier: node.isTopBarrier,
    })
  }, [])

  return (
    <div className="space-y-6">
      <section className="card p-5 bg-gradient-to-br from-surface to-surface-2/10">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-500 ring-1 ring-brand-500/20 dark:bg-brand-500/20 dark:text-brand-300 dark:ring-brand-500/30 shadow-sm">
              <Waypoints size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold tracking-tight text-fg">Safety Knowledge Graph</h2>
              <p className="mt-0.5 max-w-3xl text-xs leading-relaxed text-fg-2 font-medium">
                Interactive 3D visualization of safety relationships. Rotate, zoom, and click nodes to explore
                site → activity → hazard → barrier → outcome pathways.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <label className="eyebrow text-fg-3" htmlFor="graph-limit">
              Node limit
            </label>
            <select
              id="graph-limit"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="h-8 rounded-lg border border-line bg-surface px-2.5 text-xs font-semibold text-fg-2 transition-all hover:bg-surface-2 focus:outline-none"
            >
              {[50, 100, 150, 300].map((n) => (
                <option key={n} value={n}>
                  {n} nodes
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3.5">
          <span className="eyebrow text-fg-3 font-bold">Node legend</span>
          {KIND_LEGEND.map(([kind, label]) => (
            <span key={kind} className="flex items-center gap-1.5 text-xs text-fg-2 font-semibold">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 rounded-full ring-2 ring-surface shadow-[0_0_6px_0_currentColor]"
                style={{ background: KIND_COLORS[kind], color: KIND_COLORS[kind] }}
              />
              {label}
            </span>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="card overflow-hidden" style={{ background: '#0a0f1a' }}>
          <AsyncSection
            query={graphQuery}
            componentName="Knowledge graph canvas"
            skeleton={<SkeletonBlock className="h-[560px] w-full rounded-none" />}
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
              />
            )}
          </AsyncSection>
        </section>

        <aside className="space-y-6">
          <section className="card bg-gradient-to-br from-surface to-surface-2/10">
            <div className="card-header bg-gradient-to-r from-surface to-surface-2/10">
              <h2 className="card-title text-fg font-bold">Selected node</h2>
            </div>
            <div className="p-4">
              {!selectedNode ? (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <MousePointerClick size={22} className="text-fg-3 animate-pulse-soft" aria-hidden="true" />
                  <p className="text-xs leading-relaxed text-fg-3 font-semibold">
                    Click a node on the 3D canvas to inspect its kind, id and connections.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5 animate-fade-up">
                  <div className="flex items-start gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-surface shadow-[0_0_6px_0_currentColor]"
                      style={{ background: colorForKind(selectedNode.kind), color: colorForKind(selectedNode.kind) }}
                    />
                    <p className="min-w-0 break-words font-display text-sm font-bold tracking-tight text-fg">
                      {selectedNode.label}
                    </p>
                  </div>
                  <dl className="space-y-2 text-xs border-t border-line/60 pt-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="eyebrow text-fg-3">Kind</dt>
                      <dd className="font-bold text-fg-2 uppercase text-[10px] tracking-wide">{selectedNode.kind}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="eyebrow text-fg-3 shrink-0">Id</dt>
                      <dd className="min-w-0 break-all text-right font-mono text-2xs text-fg-2 font-semibold">
                        {selectedNode.id}
                      </dd>
                    </div>
                  </dl>
                  {selectedNode.isTopBarrier && (
                    <p className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
                      High betweenness centrality — critical control point
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>

          <section className="card bg-gradient-to-br from-surface to-surface-2/10">
            <div className="card-header bg-gradient-to-r from-surface to-surface-2/10">
              <h2 className="card-title text-fg font-bold">Top barrier centrality</h2>
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
                        className="flex items-center gap-2 rounded-xl bg-surface/50 border border-line px-2.5 py-2 transition-all duration-180 hover:-translate-y-px hover:border-line-2 hover:shadow-sm"
                      >
                        <span
                          aria-hidden="true"
                          className="grid h-5 w-5 shrink-0 place-items-center rounded bg-surface-2 font-mono text-2xs font-extrabold tabular-nums text-fg-3"
                        >
                          {i + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-semibold text-fg-2" title={b.label}>
                          {b.label}
                        </span>
                        <span className="shrink-0 font-bold tabular-nums text-fg-3">
                          {b.centrality.toFixed(3)}
                        </span>
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