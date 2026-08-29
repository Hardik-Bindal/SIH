import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({ page, pageSize, total, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2/50 px-4 py-3">
      <span className="text-xs text-fg-2">
        {total === 0 ? (
          'No results'
        ) : (
          <>
            Showing <span className="font-semibold tabular-nums text-fg">{from}–{to}</span> of{' '}
            <span className="font-semibold tabular-nums text-fg">{total.toLocaleString('en-IN')}</span>
          </>
        )}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="btn-secondary gap-1 px-2.5 py-1.5 text-xs"
        >
          <ChevronLeft size={14} aria-hidden="true" /> Prev
        </button>
        <span className="px-2 py-1 text-xs tabular-nums text-fg-3 rounded-md bg-surface">
          Page <span className="font-semibold text-fg">{page}</span> of <span className="font-semibold text-fg">{totalPages}</span>
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="btn-secondary gap-1 px-2.5 py-1.5 text-xs"
        >
          Next <ChevronRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}