import { useEffect, useState } from 'react'

interface Boosted {
  name: string
}

interface BoostedResponse {
  boss: Boosted | null
  creature: Boosted | null
  date: string | null
}

function bossSprite(name: string): string {
  return `/sprites/bosses/${name}.gif`
}

function Entry({ label, name, accent }: { label: string; name: string; accent: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="grid h-11 w-11 shrink-0 place-items-center rounded-md"
        style={{ background: `rgb(var(--${accent}) / 0.12)` }}
      >
        {failed ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={`rgb(var(--${accent}))`} strokeWidth="2">
            <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7.4L12 17l-6.3 4.4L8 14 2 9.4h7.6z" />
          </svg>
        ) : (
          <img
            src={bossSprite(name)}
            alt={name}
            onError={() => setFailed(true)}
            className="pixelated max-h-10 max-w-10"
          />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `rgb(var(--${accent}))` }}>
          {label}
        </p>
        <p className="truncate text-sm font-semibold text-onSurface">{name}</p>
      </div>
    </div>
  )
}

export function BoostedToday() {
  const [data, setData] = useState<BoostedResponse | null>(null)

  useEffect(() => {
    fetch('/api/boosted')
      .then(res => (res.ok ? res.json() : null))
      .then(setData)
      .catch(() => setData(null))
  }, [])

  if (!data || (!data.boss && !data.creature)) return null

  return (
    <section
      aria-label="Boost do dia"
      className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:gap-8"
    >
      <div className="flex items-center gap-1.5">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--rare))" strokeWidth="2">
          <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
        </svg>
        <h2 className="text-xs font-bold uppercase tracking-wider text-onSurface/60">Boost de hoje</h2>
      </div>
      <div className="flex flex-1 flex-wrap gap-x-8 gap-y-3">
        {data.boss && <Entry label="Boss" name={data.boss.name} accent="red" />}
        {data.creature && <Entry label="Criatura" name={data.creature.name} accent="battle-green" />}
      </div>
    </section>
  )
}
