import { useEffect, useState } from 'react'

interface Boosted {
  name: string
}

interface BoostedResponse {
  boss: Boosted | null
  creature: Boosted | null
  date: string | null
}

// Pedestal do próprio Tibia (configurável). O app roda localmente e alcança o CDN.
const PEDESTAL_URL =
  (import.meta.env.VITE_PEDESTAL_URL as string | undefined) ??
  'https://static.tibia.com/images/global/header/pedestal.gif'

function creatureSprite(name: string): string {
  return `/sprites/bosses/${name}.gif`
}

/** Um personagem/boss sobre o pedestal, com rótulo abaixo. */
function Pedestal({ label, name }: { label: string; name: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="flex flex-col items-center gap-1" title={`${label}: ${name}`}>
      <div
        className="relative grid h-[58px] w-[72px] place-items-end justify-center bg-bottom bg-no-repeat pb-1"
        style={{ backgroundImage: `url("${PEDESTAL_URL}")`, backgroundSize: 'auto 24px' }}
      >
        {failed ? (
          <div className="mb-1 grid h-8 w-8 place-items-center rounded-full bg-onSurface/10 text-[10px] font-bold text-onSurface/40">
            ?
          </div>
        ) : (
          <img
            src={creatureSprite(name)}
            alt={name}
            onError={() => setFailed(true)}
            className="pixelated relative z-10 mb-2 max-h-[40px] max-w-[52px] object-contain"
          />
        )}
      </div>
      <div className="text-center leading-tight">
        <p className="text-[9px] font-bold uppercase tracking-wide text-onSurface/45">{label}</p>
        <p className="max-w-[96px] truncate text-[11px] font-semibold text-onSurface">{name}</p>
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
      aria-label="Boost de hoje"
      className="inline-flex items-end gap-5 rounded-lg bg-surface px-4 py-2 shadow-card"
    >
      {data.creature && <Pedestal label="Criatura" name={data.creature.name} />}
      {data.boss && <Pedestal label="Boss" name={data.boss.name} />}
    </section>
  )
}
