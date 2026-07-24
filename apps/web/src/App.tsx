import { useCallback, useMemo, useState } from 'react'
import { Header } from './components/Header'
import { AdSpace } from './components/AdSpace'
import { AuctionCard } from './components/AuctionCard'
import { BoostedToday } from './components/BoostedToday'
import { FilterDrawer } from './components/FilterDrawer'
import { Toolbar, type ActiveChip } from './components/Toolbar'
import { useAuctions, useFilterOptions } from './hooks/useAuctions'
import { useDebounce } from './hooks/useDebounce'
import type { AuctionFilters, SortBy, SortOrder } from './types'
import { EMPTY_FILTERS } from './types'
import { vocationMeta } from './lib/vocation'

const PAGE_SIZE = 24
/** Um espaço de anúncio é inserido na grade a cada N cards. */
const AD_EVERY = 8

function SkeletonCard({ index }: { index: number }) {
  return (
    <div
      className="card-enter h-[340px] animate-pulse rounded-lg bg-surface shadow-card"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <div className="h-[104px] rounded-t-lg bg-surface-2" />
    </div>
  )
}

export default function App() {
  const [filters, setFilters] = useState<AuctionFilters>(EMPTY_FILTERS)
  const [sortBy, setSortBy] = useState<SortBy>('auctionEnd')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [page, setPage] = useState(1)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const debouncedFilters = useDebounce(filters, 300)
  const { data, loading, error } = useAuctions({
    filters: debouncedFilters,
    sortBy,
    sortOrder,
    page,
    limit: PAGE_SIZE,
  })
  const options = useFilterOptions()

  const applyFilters = useCallback((next: AuctionFilters) => {
    setFilters(next)
    setPage(1)
  }, [])

  const removeChip = useCallback((key: keyof AuctionFilters) => {
    setFilters(f => ({ ...f, [key]: EMPTY_FILTERS[key] }))
    setPage(1)
  }, [])

  const onSortChange = useCallback((by: SortBy, order: SortOrder) => {
    setSortBy(by)
    setSortOrder(order)
    setPage(1)
  }, [])

  const onPage = useCallback((p: number) => {
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const activeChips = useMemo<ActiveChip[]>(() => {
    const chips: ActiveChip[] = []
    if (filters.search) chips.push({ key: 'search', label: `“${filters.search}”` })
    if (filters.vocation !== null) {
      const name =
        options.vocations.find(v => v.id === filters.vocation)?.name ?? `Vocação ${filters.vocation}`
      chips.push({ key: 'vocation', label: vocationMeta(name).label })
    }
    if (filters.world) chips.push({ key: 'world', label: filters.world })
    if (filters.sex !== null) chips.push({ key: 'sex', label: filters.sex === 0 ? 'Masculino' : 'Feminino' })
    if (filters.minLevel) chips.push({ key: 'minLevel', label: `Level ≥ ${filters.minLevel}` })
    if (filters.maxLevel) chips.push({ key: 'maxLevel', label: `Level ≤ ${filters.maxLevel}` })
    if (filters.minMagLevel) chips.push({ key: 'minMagLevel', label: `ML ≥ ${filters.minMagLevel}` })
    return chips
  }, [filters, options.vocations])

  const auctions = data?.auctions ?? []

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pb-10 pt-4">
        {/* Área de propaganda: banner topo */}
        <div className="mb-4">
          <AdSpace variant="leaderboard" slot="bazaar-top" />
        </div>

        <div className="mb-4">
          <BoostedToday />
        </div>

        <Toolbar
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={onSortChange}
          pagination={data?.pagination ?? null}
          onPage={onPage}
          onOpenFilters={() => setDrawerOpen(true)}
          activeChips={activeChips}
          onRemoveChip={removeChip}
          filterCount={activeChips.length}
        />

        {error && (
          <div className="mt-6 rounded-lg border border-red/30 bg-red/10 p-4 text-sm font-medium text-red">
            {error}
          </div>
        )}

        {!error && !loading && auctions.length === 0 && (
          <div className="mt-16 flex flex-col items-center gap-2 text-center">
            <p className="text-lg font-bold">Nenhum leilão encontrado</p>
            <p className="text-sm text-onSurface/60">Tente ajustar ou limpar os filtros.</p>
            <button
              type="button"
              onClick={() => applyFilters(EMPTY_FILTERS)}
              className="pressable mt-2 rounded-md bg-primary px-4 py-2 text-sm font-bold text-white dark:text-background"
            >
              Limpar filtros
            </button>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loading
            ? Array.from({ length: 9 }, (_, i) => <SkeletonCard key={i} index={i} />)
            : auctions.flatMap((a, i) => {
                const nodes = [<AuctionCard key={a.id} auction={a} index={i} />]
                // Área de propaganda: card in-feed no meio da grade
                if ((i + 1) % AD_EVERY === 0 && i < auctions.length - 1) {
                  nodes.push(
                    <AdSpace key={`ad-${i}`} variant="inFeed" slot={`bazaar-feed-${Math.floor(i / AD_EVERY)}`} />,
                  )
                }
                return nodes
              })}
        </div>

        {data && data.pagination.totalPages > 1 && !loading && (
          <div className="mt-6 flex justify-end">
            <Toolbar
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSortChange={onSortChange}
              pagination={data.pagination}
              onPage={onPage}
              onOpenFilters={() => setDrawerOpen(true)}
              activeChips={[]}
              onRemoveChip={removeChip}
              filterCount={activeChips.length}
            />
          </div>
        )}

        {/* Área de propaganda: banner antes do rodapé */}
        <div className="mt-8">
          <AdSpace variant="footer" slot="bazaar-bottom" />
        </div>
      </main>

      <footer className="border-t border-separator/60 bg-surface py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-1 px-4 text-center text-xs text-onSurface/50">
          <p>
            <strong className="font-semibold text-onSurface/70">UtaniHur</strong> — bazar de personagens do
            RubinOT. Projeto de fã, sem vínculo com a CipSoft ou RubinOT.
          </p>
          <p>Dados atualizados periodicamente a partir do bazar oficial.</p>
        </div>
      </footer>

      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        filters={filters}
        onApply={applyFilters}
        options={options}
      />
    </div>
  )
}
