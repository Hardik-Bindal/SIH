import { useMemo, useRef, useState } from 'react'
import CytoscapeComponent from 'react-cytoscapejs'
import { Waypoints, MousePointerClick } from 'lucide-react'
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

export default function KnowledgeGraph() {
  const [limit, setLimit] = useState(150)
  const graphQuery = useGraph({ limit })
  const [selectedNode, setSelectedNode] = useState(null)
  const cyRef = useRef(null)

  // StyleSheet is recalculated dynamically to match theme changes
  const stylesheet = useMemo(() => {
    const isDark = document.documentElement.classList.contains('dark')
    const labelColor = isDark ? '#cbd5e1' : '#475569'
    const boldLabelColor = isDark ? '#ffffff' : '#0f1e33'
    const edgeColor = isDark ? '#334155' : '#cbd5e1'

    return [
      {
        selector: 'node',
        style: {
          'background-color': (n) => colorForKind(n.data('kind')),
          label: 'data(label)',
          'font-size': 9,
          'font-family': 'Inter, ui-sans-serif, system-ui, sans-serif',
          color: labelColor,
          'text-valign': 'bottom',
          'text-margin-y': 5,
          width: 20,
          height: 20,
          'border-width': 2,
          'border-color': isDark ? '#0f1420' : '#ffffff',
          'border-opacity': 1,
        },
      },
      {
        selector: 'node[kind = "report"]',
        style: {
          width: 12,
          height: 12,
          'font-size': 7,
          color: labelColor,
          'text-margin-y': 3,
        },
      },
      {
        selector: 'node.top-barrier',
        style: {
          width: 36,
          height: 36,
          'border-width': 4,
          'border-color': '#009ef0',
          'border-opacity': 0.85,
          'font-weight': 700,
          'font-size': 11,
          color: boldLabelColor,
        },
      },
      {
        selector: 'node.selected',
        style: {
          'border-width': 4,
          'border-color': '#dc2626',
          'border-opacity': 1,
        },
      },
      {
        selector: 'edge',
        style: {
          width: 1.1,
          'line-color': edgeColor,
          'target-arrow-color': edgeColor,
          'target-arrow-shape': 'triangle',
          'arrow-scale': 0.6,
          'curve-style': 'bezier',
          opacity: 0.55,
        },
      },
    ]
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
                Site, activity, hazard, barrier, root cause and outcome relationships. Ringed nodes have the highest
                barrier betweenness centrality — fixing that control would break the most incident pathways.
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
          <span className="eyebrow text-fg-3 font-bold">Node legends</span>
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
        <section className="card overflow-hidden">
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
            {(graph) => {
              const barrierIds = new Set((graph.top_barrier_centrality || []).map((b) => b.node))
              const elements = [
                ...graph.nodes.map((n) => ({
                  data: n.data,
                  classes: barrierIds.has(n.data.id) ? 'top-barrier' : '',
                })),
                ...graph.edges,
              ]
              return (
                <CytoscapeComponent
                  elements={CytoscapeComponent.normalizeElements(elements)}
                  style={{ width: '100%', height: '560px', background: 'transparent' }}
                  stylesheet={stylesheet}
                  layout={{
                    name: 'cose',
                    animate: false,
                    padding: 36,
                    nodeRepulsion: 14000,
                    idealEdgeLength: 80,
                    nodeOverlap: 24,
                    componentSpacing: 90,
                  }}
                  cy={(cy) => {
                    cyRef.current = cy
                    cy.off('tap', 'node')
                    cy.on('tap', 'node', (evt) => {
                      cy.$('node.selected').removeClass('selected')
                      const node = evt.target
                      node.addClass('selected')
                      setSelectedNode({ ...node.data(), centrality: (graph.top_barrier_centrality || []).find((b) => b.node === node.id())?.centrality })
                    })
                    cy.on('tap', (evt) => {
                      if (evt.target === cy) {
                        cy.$('node.selected').removeClass('selected')
                        setSelectedNode(null)
                      }
                    })
                  }}
                />
              )
            }}
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
                    Click a node on the canvas to inspect its kind, id and centrality.
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
                  {selectedNode.centrality !== undefined && (
                    <p className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-xs font-bold text-brand-700 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-300">
                      Top barrier — centrality{' '}
                      <span className="tabular-nums font-mono text-fg">{selectedNode.centrality.toFixed(3)}</span>
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