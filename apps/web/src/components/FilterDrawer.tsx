import { useEffect, useRef, useState } from 'react'
import type { AuctionFilters, FilterOptions } from '../types'
import { EMPTY_FILTERS } from '../types'
import { CloseIcon, FemaleIcon, MaleIcon, SearchIcon } from './Icons'

const VOCATION_CHIPS = [
  { id: 8, label: 'EK', title: 'Knight' },
  { id: 7, label: 'RP', title: 'Paladin' },
  { id: 5, label: 'MS', title: 'Sorcerer' },
  { id: 6, label: 'ED', title: 'Druid' },
  { id: 10, label: 'EM', title: 'Monk' },
]

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0">
      <legend className="mb-2 text-[11px] font-bold uppercase tracking-wider text-onSurface/50">{title}</legend>
      {children}
    </fieldset>
  )
}

const inputCls =
  'h-9 w-full rounded-md border border-separator bg-surface px-3 text-sm outline-none transition-colors duration-150 placeholder:text-onSurface/35 focus:border-primary focus:ring-2 focus:ring-primary/20'

const chipCls = (active: boolean) =>
  `pressable inline-flex h-9 min-w-11 items-center justify-center gap-1.5 rounded-md border px-2.5 text-sm font-bold transition-colors duration-150 ${
    active
      ? 'border-primary bg-primary text-white dark:text-background'
      : 'border-separator bg-surface text-onSurface/70 [@media(hover:hover)]:hover:border-primary/50'
  }`

interface Props {
  open: boolean
  onClose: () => void
  filters: AuctionFilters
  onApply: (filters: AuctionFilters) => void
  options: FilterOptions
}

export function FilterDrawer({ open, onClose, filters, onApply, options }: Props) {
  const [draft, setDraft] = useState<AuctionFilters>(filters)
  const panelRef = useRef<HTMLDivElement>(null)

  // Sincroniza o rascunho quando o drawer abre
  useEffect(() => {
    if (open) setDraft(filters)
  }, [open, filters])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  const set = <K extends keyof AuctionFilters>(key: K, value: AuctionFilters[K]) =>
    setDraft(d => ({ ...d, [key]: value }))

  const apply = () => {
    onApply(draft)
    onClose()
  }

  return (
    <div className={open ? 'pointer-events-auto' : 'pointer-events-none'} aria-hidden={!open}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Painel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Filtrar leilões"
        className={`fixed inset-y-0 left-0 z-50 flex w-full max-w-xs flex-col bg-background shadow-2xl transition-transform duration-300 ease-drawer motion-reduce:transition-none ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-separator/60 px-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-onSurface/70">Filtros</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar filtros"
            className="pressable grid h-8 w-8 place-items-center rounded-md text-onSurface/60 transition-colors duration-150 hover:bg-onSurface/5"
          >
            <CloseIcon size={16} />
          </button>
        </header>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
          <Section title="Nome do personagem">
            <div className="relative">
              <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-onSurface/35" />
              <input
                type="search"
                value={draft.search}
                onChange={e => set('search', e.target.value)}
                onKeyDown={e => e.key === 'Enter' && apply()}
                placeholder="Buscar nickname…"
                className={`${inputCls} pl-8`}
              />
            </div>
          </Section>

          <Section title="Vocação">
            <div className="flex flex-wrap gap-1.5">
              {VOCATION_CHIPS.map(v => (
                <button
                  key={v.id}
                  type="button"
                  title={v.title}
                  aria-pressed={draft.vocation === v.id}
                  onClick={() => set('vocation', draft.vocation === v.id ? null : v.id)}
                  className={chipCls(draft.vocation === v.id)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Sexo">
            <div className="flex gap-1.5">
              <button
                type="button"
                aria-pressed={draft.sex === 0}
                onClick={() => set('sex', draft.sex === 0 ? null : 0)}
                className={chipCls(draft.sex === 0)}
              >
                <MaleIcon size={14} /> Masc.
              </button>
              <button
                type="button"
                aria-pressed={draft.sex === 1}
                onClick={() => set('sex', draft.sex === 1 ? null : 1)}
                className={chipCls(draft.sex === 1)}
              >
                <FemaleIcon size={14} /> Fem.
              </button>
            </div>
          </Section>

          <Section title="Mundo">
            <select
              value={draft.world ?? ''}
              onChange={e => set('world', e.target.value || null)}
              className={inputCls}
            >
              <option value="">Todos os mundos</option>
              {options.worlds.map(w => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </Section>

          <Section title="Level">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={draft.minLevel}
                onChange={e => set('minLevel', e.target.value)}
                placeholder="Mín."
                aria-label="Level mínimo"
                className={inputCls}
              />
              <span className="text-onSurface/40">–</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={draft.maxLevel}
                onChange={e => set('maxLevel', e.target.value)}
                placeholder="Máx."
                aria-label="Level máximo"
                className={inputCls}
              />
            </div>
          </Section>

          <Section title="Magic level mínimo">
            <input
              type="number"
              min={0}
              inputMode="numeric"
              value={draft.minMagLevel}
              onChange={e => set('minMagLevel', e.target.value)}
              placeholder="Ex.: 100"
              aria-label="Magic level mínimo"
              className={inputCls}
            />
          </Section>
        </div>

        <footer className="flex shrink-0 gap-2 border-t border-separator/60 p-4">
          <button
            type="button"
            onClick={() => setDraft(EMPTY_FILTERS)}
            className="pressable h-10 flex-1 rounded-md border border-separator text-sm font-semibold text-onSurface/70 transition-colors duration-150 [@media(hover:hover)]:hover:border-red/60 [@media(hover:hover)]:hover:text-red"
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={apply}
            className="pressable h-10 flex-[2] rounded-md bg-primary text-sm font-bold text-white transition-colors duration-150 [@media(hover:hover)]:hover:bg-primaryHighlight dark:text-background"
          >
            Aplicar filtros
          </button>
        </footer>
      </div>
    </div>
  )
}
