import { useEffect, useRef, useState } from 'react'
import type { AuctionFilters, Pagination, SortBy, SortOrder } from '../types'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CloseIcon,
  FilterIcon,
  SortIcon,
} from './Icons'

const SORT_OPTIONS: Array<{ sortBy: SortBy; sortOrder: SortOrder; label: string }> = [
  { sortBy: 'auctionEnd', sortOrder: 'asc', label: 'Fim do leilão' },
  { sortBy: 'level', sortOrder: 'desc', label: 'Maior level' },
  { sortBy: 'level', sortOrder: 'asc', label: 'Menor level' },
  { sortBy: 'price', sortOrder: 'desc', label: 'Maior lance' },
  { sortBy: 'price', sortOrder: 'asc', label: 'Menor lance' },
  { sortBy: 'magLevel', sortOrder: 'desc', label: 'Maior magic level' },
]

interface SortingMenuProps {
  sortBy: SortBy
  sortOrder: SortOrder
  onChange: (sortBy: SortBy, sortOrder: SortOrder) => void
}

function SortingMenu({ sortBy, sortOrder, onChange }: SortingMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = SORT_OPTIONS.find(o => o.sortBy === sortBy && o.sortOrder === sortOrder) ?? SORT_OPTIONS[0]

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="pressable inline-flex h-9 items-center gap-2 rounded-md border border-separator bg-surface px-3 text-sm font-medium transition-colors duration-150 [@media(hover:hover)]:hover:border-primary/50"
      >
        <SortIcon size={15} className="text-onSurface/60" />
        <span className="hidden sm:inline">{current.label}</span>
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="Ordenar por"
          className="absolute left-0 top-full z-30 mt-1.5 w-52 origin-top-left animate-[menu-in_150ms_var(--ease-out-strong)] rounded-md border border-separator/70 bg-surface py-1 shadow-card-hover"
        >
          {SORT_OPTIONS.map(o => {
            const selected = o === current
            return (
              <li key={o.label} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(o.sortBy, o.sortOrder)
                    setOpen(false)
                  }}
                  className={`block w-full px-3 py-1.5 text-left text-sm transition-colors duration-100 hover:bg-primary/10 ${
                    selected ? 'font-semibold text-primary' : 'text-onSurface/80'
                  }`}
                >
                  {o.label}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function Paginator({ pagination, onPage }: { pagination: Pagination; onPage: (p: number) => void }) {
  const { page, limit, total, totalPages } = pagination
  const from = total === 0 ? 0 : (page - 1) * limit + 1
  const to = Math.min(page * limit, total)

  const btn =
    'pressable grid h-8 w-8 place-items-center rounded-md text-onSurface/70 transition-colors duration-150 enabled:[@media(hover:hover)]:hover:bg-primary/10 enabled:[@media(hover:hover)]:hover:text-primary disabled:opacity-30'

  return (
    <div className="flex items-center gap-0.5" aria-label="Paginação">
      <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(1)} aria-label="Primeira página">
        <ChevronsLeft size={16} />
      </button>
      <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Página anterior">
        <ChevronLeft size={16} />
      </button>
      <span className="px-2 text-[13px] font-medium tabular-nums text-onSurface/70">
        {from} – {to} <span className="text-onSurface/45">de {total}</span>
      </span>
      <button type="button" className={btn} disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Próxima página">
        <ChevronRight size={16} />
      </button>
      <button type="button" className={btn} disabled={page >= totalPages} onClick={() => onPage(totalPages)} aria-label="Última página">
        <ChevronsRight size={16} />
      </button>
    </div>
  )
}

export interface ActiveChip {
  key: string
  label: string
}

interface ToolbarProps {
  sortBy: SortBy
  sortOrder: SortOrder
  onSortChange: (sortBy: SortBy, sortOrder: SortOrder) => void
  pagination: Pagination | null
  onPage: (p: number) => void
  onOpenFilters: () => void
  activeChips: ActiveChip[]
  onRemoveChip: (key: keyof AuctionFilters) => void
  filterCount: number
}

export function Toolbar({
  sortBy,
  sortOrder,
  onSortChange,
  pagination,
  onPage,
  onOpenFilters,
  activeChips,
  onRemoveChip,
  filterCount,
}: ToolbarProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onOpenFilters}
          className="pressable relative inline-flex h-9 items-center gap-2 rounded-md border border-separator bg-surface px-3 text-sm font-medium transition-colors duration-150 [@media(hover:hover)]:hover:border-primary/50"
        >
          <FilterIcon size={15} className="text-onSurface/60" />
          Filtros
          {filterCount > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-white dark:text-background">
              {filterCount}
            </span>
          )}
        </button>

        <SortingMenu sortBy={sortBy} sortOrder={sortOrder} onChange={onSortChange} />

        <div className="ml-auto">{pagination && <Paginator pagination={pagination} onPage={onPage} />}</div>
      </div>

      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeChips.map(chip => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-2.5 pr-1 text-xs font-semibold text-primary"
            >
              {chip.label}
              <button
                type="button"
                onClick={() => onRemoveChip(chip.key as keyof AuctionFilters)}
                aria-label={`Remover filtro ${chip.label}`}
                className="grid h-5 w-5 place-items-center rounded-full p-0.5 transition-colors duration-100 hover:bg-primary/20"
              >
                <CloseIcon size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
