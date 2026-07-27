import { useEffect, useMemo, useState } from 'react'
import { SearchIcon } from './Icons'

export interface WardrobeItem {
  name: string
  store: boolean
  male?: boolean
  female?: boolean
}

interface Wardrobe {
  outfits: WardrobeItem[]
  mounts: WardrobeItem[]
}

let cache: Wardrobe | null = null

export function useWardrobe(): Wardrobe {
  const [data, setData] = useState<Wardrobe>(cache ?? { outfits: [], mounts: [] })
  useEffect(() => {
    if (cache) return
    fetch('/wardrobe.json')
      .then(r => (r.ok ? r.json() : { outfits: [], mounts: [] }))
      .then((d: Wardrobe) => {
        cache = d
        setData(d)
      })
      .catch(() => {})
  }, [])
  return data
}

function outfitSrc(item: WardrobeItem, sex: 'male' | 'female', addon: number): string {
  const folder = item.store ? 'storeoutfits' : 'outfits'
  return `/sprites/${folder}/${sex}/${encodeURIComponent(item.name)}_${addon}.gif`
}

function mountSrc(item: WardrobeItem): string {
  const folder = item.store ? 'storemounts' : 'mounts'
  return `/sprites/${folder}/${encodeURIComponent(item.name)}.gif`
}

/** Thumb com fallback de addon (3→2→1→0). */
function Thumb({
  item,
  kind,
  sex,
  selected,
  onToggle,
}: {
  item: WardrobeItem
  kind: 'outfit' | 'mount'
  sex: 'male' | 'female'
  selected: boolean
  onToggle: () => void
}) {
  const addons = [3, 2, 1, 0]
  const [addonIdx, setAddonIdx] = useState(0)
  const [failed, setFailed] = useState(false)
  const src = kind === 'outfit' ? outfitSrc(item, sex, addons[addonIdx]) : mountSrc(item)

  return (
    <button
      type="button"
      title={item.name}
      aria-pressed={selected}
      onClick={onToggle}
      className={`pressable grid aspect-square place-items-center rounded border transition-colors duration-100 ${
        selected ? 'border-primary bg-primary/15 ring-1 ring-primary' : 'border-separator/70 bg-surface-2 hover:border-primary/40'
      }`}
    >
      {failed ? (
        <span className="px-0.5 text-center text-[7px] leading-tight text-onSurface/40">{item.name}</span>
      ) : (
        <img
          src={src}
          alt={item.name}
          loading="lazy"
          onError={() => (kind === 'outfit' && addonIdx < addons.length - 1 ? setAddonIdx(i => i + 1) : setFailed(true))}
          className="pixelated max-h-8 max-w-8"
        />
      )}
    </button>
  )
}

interface Props {
  title: string
  kind: 'outfit' | 'mount'
  items: WardrobeItem[]
  selected: string[]
  onChange: (next: string[]) => void
}

export function WardrobePicker({ title, kind, items, selected, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [sex, setSex] = useState<'male' | 'female'>('male')

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    let list = items
    if (kind === 'outfit') list = list.filter(i => (sex === 'male' ? i.male : i.female))
    if (term) list = list.filter(i => i.name.toLowerCase().includes(term))
    return list
  }, [items, search, sex, kind])

  const toggle = (name: string) =>
    onChange(selected.includes(name) ? selected.filter(n => n !== name) : [...selected, name])

  return (
    <div className="rounded-md border border-separator/60">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-[11px] font-bold uppercase tracking-wider text-onSurface/60">
          {title}
          {selected.length > 0 && <span className="ml-1.5 text-primary">({selected.length})</span>}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-onSurface/40 transition-transform ${open ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="flex flex-col gap-2 border-t border-separator/60 p-2.5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <SearchIcon size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-onSurface/35" />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Procurar por nome…"
                className="h-8 w-full rounded-md border border-separator bg-surface pl-7 pr-2 text-xs outline-none focus:border-primary"
              />
            </div>
            {kind === 'outfit' && (
              <div className="flex overflow-hidden rounded-md border border-separator text-[11px] font-semibold">
                <button type="button" onClick={() => setSex('male')} className={`px-2 py-1.5 ${sex === 'male' ? 'bg-primary text-white dark:text-background' : 'text-onSurface/60'}`}>
                  ♂
                </button>
                <button type="button" onClick={() => setSex('female')} className={`px-2 py-1.5 ${sex === 'female' ? 'bg-primary text-white dark:text-background' : 'text-onSurface/60'}`}>
                  ♀
                </button>
              </div>
            )}
          </div>

          {selected.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="self-start text-[11px] font-medium text-red hover:underline">
              Limpar seleção ({selected.length})
            </button>
          )}

          <div className="grid max-h-64 grid-cols-6 gap-1 overflow-y-auto">
            {filtered.map(item => (
              <Thumb
                key={item.name}
                item={item}
                kind={kind}
                sex={sex}
                selected={selected.includes(item.name)}
                onToggle={() => toggle(item.name)}
              />
            ))}
          </div>
          <p className="text-[10px] text-onSurface/40">
            {filtered.length} disponíveis · seleciona os que o personagem deve possuir (requer npm run details)
          </p>
        </div>
      )}
    </div>
  )
}
