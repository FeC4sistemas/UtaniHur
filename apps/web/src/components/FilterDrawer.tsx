import { useEffect, useRef, useState } from 'react'
import type { AuctionFilters, FilterOptions, SkillKey } from '../types'
import { EMPTY_FILTERS } from '../types'
import { CloseIcon, FemaleIcon, MaleIcon, SearchIcon } from './Icons'
import { WardrobePicker, useWardrobe } from './WardrobePicker'
import { questEmoji } from '../lib/quests'

/** Lista de quests concluídas com busca e checkboxes. */
function QuestPicker({ all = [], selected, onChange }: { all?: string[]; selected: string[]; onChange: (v: string[]) => void }) {
  const [search, setSearch] = useState('')
  const term = search.trim().toLowerCase()
  const list = term ? all.filter(q => q.toLowerCase().includes(term)) : all
  const toggle = (name: string) =>
    onChange(selected.includes(name) ? selected.filter(n => n !== name) : [...selected, name])

  if (all.length === 0) {
    return <p className="text-[11px] text-onSurface/45">Rode “npm run quests” para carregar a lista de quests.</p>
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <SearchIcon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-onSurface/35" />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Procurar quest…"
          className="h-8 w-full rounded-md border border-separator bg-surface pl-7 pr-2 text-xs outline-none focus:border-primary"
        />
      </div>
      <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
        {list.map(name => (
          <label key={name} className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-[13px] hover:bg-primary/5">
            <input type="checkbox" checked={selected.includes(name)} onChange={() => toggle(name)} className="h-4 w-4 accent-primary" />
            <span className="flex-1 truncate">{name}</span>
            <span>{questEmoji(name)}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

const ICON_BASE = '/sprites/images/'
// id = vocação promovida (família); o filtro inclui a base via VOCATION_FAMILY.
// icon = png em public/sprites/images; emoji = fallback quando não há png.
const VOCATION_CHIPS: Array<{ id: number; label: string; icon?: string; emoji?: string }> = [
  { id: 0, label: 'None', icon: 'rook.png' },
  { id: 8, label: 'Knight', icon: 'knight.png' },
  { id: 7, label: 'Paladin', icon: 'paladin.png' },
  { id: 5, label: 'Sorcerer', icon: 'sorcerer.png' },
  { id: 6, label: 'Druid', icon: 'druid.png' },
  { id: 10, label: 'Monk', emoji: '🥋' },
]

const PVP_CHIPS: Array<{ value: NonNullable<AuctionFilters['pvp']>; label: string }> = [
  { value: 'pvp', label: 'Open PvP' },
  { value: 'no-pvp', label: 'Optional' },
  { value: 'pvp-enforced', label: 'Retro' },
]

const SKILL_OPTIONS: Array<{ key: SkillKey; label: string; icon: string }> = [
  { key: 'magic', label: 'Magic', icon: '🔮' },
  { key: 'dist', label: 'Distance', icon: '🏹' },
  { key: 'club', label: 'Club', icon: '🔨' },
  { key: 'sword', label: 'Sword', icon: '🗡️' },
  { key: 'axe', label: 'Axe', icon: '🪓' },
  { key: 'fist', label: 'Fist', icon: '👊' },
  { key: 'shielding', label: 'Shield', icon: '🛡️' },
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

/** Par de inputs mín/máx. */
function Range({
  minVal,
  maxVal,
  onMin,
  onMax,
  label,
}: {
  minVal: string
  maxVal: string
  onMin: (v: string) => void
  onMax: (v: string) => void
  label: string
}) {
  return (
    <div className="flex items-center gap-2">
      <input type="number" min={0} inputMode="numeric" value={minVal} onChange={e => onMin(e.target.value)} placeholder="Mín." aria-label={`${label} mínimo`} className={inputCls} />
      <span className="text-onSurface/40">–</span>
      <input type="number" min={0} inputMode="numeric" value={maxVal} onChange={e => onMax(e.target.value)} placeholder="Máx." aria-label={`${label} máximo`} className={inputCls} />
    </div>
  )
}

/** Input numérico com rótulo pequeno em cima. */
function LabeledNum({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-onSurface/45">{label}</span>
      <input type="number" min={0} inputMode="numeric" value={value} onChange={e => onChange(e.target.value)} placeholder="Mín." className={inputCls} />
    </label>
  )
}

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
  const [tab, setTab] = useState<'geral' | 'skills' | 'extras'>('geral')
  const wardrobe = useWardrobe()
  const previewAddon = (draft.reqAddon1 ? 1 : 0) | (draft.reqAddon2 ? 2 : 0) || 3
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

        <div className="flex shrink-0 border-b border-separator/60 px-2" role="tablist">
          {(['geral', 'skills', 'extras'] as const).map(t => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`relative px-4 py-2.5 text-sm font-semibold capitalize transition-colors duration-150 ${
                tab === t ? 'text-primary' : 'text-onSurface/50 hover:text-onSurface/80'
              }`}
            >
              {t}
              {tab === t && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
            </button>
          ))}
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
          {tab === 'geral' && (
            <>
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
                  title={v.label}
                  aria-pressed={draft.vocation === v.id}
                  onClick={() => set('vocation', draft.vocation === v.id ? null : v.id)}
                  className={chipCls(draft.vocation === v.id)}
                >
                  {v.icon ? (
                    <img src={ICON_BASE + v.icon} alt="" className="pixelated h-4 w-4 object-contain" />
                  ) : (
                    <span aria-hidden>{v.emoji}</span>
                  )}
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

          <Section title="Tipo de PvP">
            <div className="flex flex-wrap gap-1.5">
              {PVP_CHIPS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={draft.pvp === p.value}
                  onClick={() => set('pvp', draft.pvp === p.value ? null : p.value)}
                  className={chipCls(draft.pvp === p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Section>

          <Section title="Level">
            <Range minVal={draft.minLevel} maxVal={draft.maxLevel} onMin={v => set('minLevel', v)} onMax={v => set('maxLevel', v)} label="Level" />
          </Section>

          <Section title="Preço (lance)">
            <Range minVal={draft.minPrice} maxVal={draft.maxPrice} onMin={v => set('minPrice', v)} onMax={v => set('maxPrice', v)} label="Preço" />
          </Section>

          <Section title="Lances">
            <div className="flex gap-1.5">
              <button type="button" aria-pressed={draft.hasBid === 'yes'} onClick={() => set('hasBid', draft.hasBid === 'yes' ? null : 'yes')} className={chipCls(draft.hasBid === 'yes')}>
                Com lance
              </button>
              <button type="button" aria-pressed={draft.hasBid === 'no'} onClick={() => set('hasBid', draft.hasBid === 'no' ? null : 'no')} className={chipCls(draft.hasBid === 'no')}>
                Sem lance
              </button>
            </div>
          </Section>
            </>
          )}

          {tab === 'skills' && (
            <>
          <Section title="Skill">
            <div className="flex items-end gap-2">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-onSurface/45">Min skill</span>
                <input type="number" min={0} inputMode="numeric" value={draft.minSkill} onChange={e => set('minSkill', e.target.value)} placeholder="Mín." aria-label="Skill mínima" className={inputCls} />
              </label>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-onSurface/45">Max skill</span>
                <input type="number" min={0} inputMode="numeric" value={draft.maxSkill} onChange={e => set('maxSkill', e.target.value)} placeholder="Máx." aria-label="Skill máxima" className={inputCls} />
              </label>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {SKILL_OPTIONS.map(s => {
                const active = draft.skills.includes(s.key)
                return (
                  <button
                    key={s.key}
                    type="button"
                    title={s.label}
                    aria-pressed={active}
                    onClick={() =>
                      set('skills', active ? draft.skills.filter(k => k !== s.key) : [...draft.skills, s.key])
                    }
                    className={chipCls(active)}
                  >
                    <span aria-hidden>{s.icon}</span> {s.label}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-onSurface/45">
              Mostra quem tem <b>qualquer</b> skill marcada dentro do intervalo. Sem chip marcado, o intervalo é ignorado.
            </p>
          </Section>
            </>
          )}

          {tab === 'extras' && (
            <>
          <Section title="Quests concluídas">
            <QuestPicker all={options.quests} selected={draft.quests} onChange={v => set('quests', v)} />
          </Section>

          <Section title="Charm points mínimo">
            <input type="number" min={0} inputMode="numeric" value={draft.minCharm} onChange={e => set('minCharm', e.target.value)} placeholder="Ex.: 3000" className={inputCls} />
          </Section>

          <Section title="Coleção e progresso">
            <p className="-mt-1 mb-1 text-[11px] text-onSurface/45">
              Requer o detalhe (npm run details). Leilões sem esse dado são ocultados quando o filtro é usado.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <LabeledNum label="Boss pts" value={draft.minBoss} onChange={v => set('minBoss', v)} />
              <LabeledNum label="Mounts" value={draft.minMounts} onChange={v => set('minMounts', v)} />
              <LabeledNum label="Outfits" value={draft.minOutfits} onChange={v => set('minOutfits', v)} />
            </div>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-onSurface/80">
              <input
                type="checkbox"
                checked={draft.charmExpansion}
                onChange={e => set('charmExpansion', e.target.checked)}
                className="h-4 w-4 accent-primary"
              />
              Com Charm Expansion
            </label>
          </Section>

          <Section title="Outfits e mounts">
            <p className="-mt-1 mb-1 text-[11px] text-onSurface/45">
              Filtra por posse (o personagem deve ter os selecionados). Requer npm run details.
            </p>
            <div className="mb-1 flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-1.5 text-sm text-onSurface/80">
                <input type="checkbox" checked={draft.reqAddon1} onChange={e => set('reqAddon1', e.target.checked)} className="h-4 w-4 accent-primary" />
                Addon 1
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-sm text-onSurface/80">
                <input type="checkbox" checked={draft.reqAddon2} onChange={e => set('reqAddon2', e.target.checked)} className="h-4 w-4 accent-primary" />
                Addon 2
              </label>
            </div>
            <div className="flex flex-col gap-2">
              <WardrobePicker
                title="Outfits"
                kind="outfit"
                items={wardrobe.outfits.filter(o => !o.store)}
                selected={draft.outfits}
                onChange={v => set('outfits', v)}
                previewAddon={previewAddon}
              />
              <WardrobePicker
                title="Store Outfits"
                kind="outfit"
                items={wardrobe.outfits.filter(o => o.store)}
                selected={draft.outfits}
                onChange={v => set('outfits', v)}
                previewAddon={previewAddon}
              />
              <WardrobePicker
                title="Mounts"
                kind="mount"
                items={wardrobe.mounts.filter(m => !m.store)}
                selected={draft.mounts}
                onChange={v => set('mounts', v)}
              />
              <WardrobePicker
                title="Store Mounts"
                kind="mount"
                items={wardrobe.mounts.filter(m => m.store)}
                selected={draft.mounts}
                onChange={v => set('mounts', v)}
              />
            </div>
          </Section>
            </>
          )}
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
