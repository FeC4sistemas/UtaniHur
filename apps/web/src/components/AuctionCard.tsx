import { memo, useEffect, useState } from 'react'
import type { Auction } from '../types'
import { auctionUrl, formatCoins, formatEndDate, itemSources, outfitSources, timeLeft } from '../lib/format'
import { skillList, vocationMeta } from '../lib/vocation'
import {
  ClockIcon,
  CoinIcon,
  ExternalIcon,
  FemaleIcon,
  GlobeIcon,
  HeartIcon,
  MaleIcon,
  TrophyIcon,
} from './Icons'

function OutfitImage({ auction }: { auction: Auction }) {
  // Percorre as fontes em ordem; quando todas falham, mostra o badge da vocação
  const sources = outfitSources(auction)
  const [sourceIndex, setSourceIndex] = useState(0)
  // Nº de frames quando a fonte é uma sprite sheet horizontal (frames quadrados)
  const [frames, setFrames] = useState(1)
  const short = vocationMeta(auction.vocationName).short

  // Quadradinho que emoldura e centraliza o personagem
  const boxCls =
    'grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-md border border-separator/70 bg-background'

  if (sourceIndex >= sources.length) {
    return (
      <div aria-hidden className={`${boxCls} text-lg font-extrabold text-primary`}>
        {short}
      </div>
    )
  }
  return (
    <div className={boxCls}>
      <img
        src={sources[sourceIndex]}
        alt={`Outfit de ${auction.name}`}
        loading="lazy"
        onLoad={e => {
          const img = e.currentTarget
          setFrames(Math.max(1, Math.round(img.naturalWidth / img.naturalHeight)))
        }}
        onError={() => {
          setFrames(1)
          setSourceIndex(i => i + 1)
        }}
        className={
          frames > 1
            ? 'outfit-sheet pixelated h-full w-auto max-w-none justify-self-start'
            : 'pixelated max-h-full max-w-full object-contain'
        }
        style={
          frames > 1
            ? ({ '--frames': frames, animationDuration: `${frames * 0.09}s` } as React.CSSProperties)
            : undefined
        }
      />
    </div>
  )
}

function ItemSlot({ clientId, name, count, tier }: { clientId: number; name: string; count: number; tier: number }) {
  // Mesma estratégia do outfit: tenta cada fonte e cai na abreviação do nome
  const sources = itemSources(clientId)
  const [sourceIndex, setSourceIndex] = useState(0)
  return (
    <div
      title={tier > 0 ? `${name} (tier ${tier})` : name}
      className="relative grid h-10 w-10 place-items-center rounded border border-separator/80 bg-surface-2"
    >
      {sourceIndex >= sources.length ? (
        <span className="text-[9px] font-semibold uppercase leading-none text-onSurface/40">
          {name.slice(0, 3)}
        </span>
      ) : (
        <img
          src={sources[sourceIndex]}
          alt={name}
          loading="lazy"
          onError={() => setSourceIndex(i => i + 1)}
          className="pixelated max-h-8 max-w-8"
        />
      )}
      {tier > 0 && (
        <span
          aria-label={`Tier ${tier}`}
          className="tier-badge absolute -right-1 -top-1 grid h-3.5 min-w-3.5 place-items-center px-0.5 text-[8px] font-extrabold leading-none"
        >
          {tier}
        </span>
      )}
      {count > 1 && (
        <span className="absolute bottom-0 right-0.5 text-[10px] font-bold text-onSurface/70">{count}</span>
      )}
    </div>
  )
}

function SkillCell({ label, value, highlight }: { label: string; value: number; highlight: boolean }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-1 rounded px-1.5 py-1 ${
        highlight ? 'bg-primary/10' : ''
      }`}
    >
      <span className={`text-[11px] font-medium ${highlight ? 'text-primary' : 'text-onSurface/55'}`}>
        {label}
      </span>
      <span className={`text-xs font-bold tabular-nums ${highlight ? 'text-primary' : 'text-onSurface/85'}`}>
        {value}
      </span>
    </div>
  )
}

function Countdown({ end }: { end: number }) {
  const [now, setNow] = useState(() => Date.now())
  const t = timeLeft(end, now)

  useEffect(() => {
    if (t.expired) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [t.expired])

  return (
    <div className="flex items-center gap-1.5" title={`Fim do leilão: ${formatEndDate(end)}`}>
      <ClockIcon size={14} className={t.expired ? 'text-onSurface/40' : t.urgent ? 'text-red' : 'text-onSurface/60'} />
      <span
        className={`text-xs font-semibold tabular-nums ${
          t.expired ? 'text-onSurface/40' : t.urgent ? 'text-red' : 'text-onSurface/80'
        }`}
      >
        {t.label}
      </span>
    </div>
  )
}

const FAVORITES_KEY = 'utanihur:favorites'

function readFavorites(): Set<number> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]') as number[])
  } catch {
    return new Set()
  }
}

interface Props {
  auction: Auction
  index: number
}

export const AuctionCard = memo(function AuctionCard({ auction: a, index }: Props) {
  const [favorite, setFavorite] = useState(() => readFavorites().has(a.id))
  const voc = vocationMeta(a.vocationName)
  const skills = skillList(a.vocationName, a.magLevel, { ...a.skills })
  const hasBid = a.currentValue > 0
  const bidValue = hasBid ? a.currentValue : a.startingValue

  const toggleFavorite = () => {
    const favs = readFavorites()
    favorite ? favs.delete(a.id) : favs.add(a.id)
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs]))
    } catch {
      /* storage indisponível */
    }
    setFavorite(!favorite)
  }

  return (
    <article
      className="card-enter flex flex-col overflow-hidden rounded-lg bg-surface shadow-card transition-shadow duration-200 ease-out-strong [@media(hover:hover)]:hover:shadow-card-hover"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      {/* Cabeçalho: outfit + identidade */}
      <header className="flex items-start gap-3 bg-surface-2 p-3">
        <OutfitImage auction={a} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <a
              href={auctionUrl(a.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-[15px] font-bold text-primary transition-colors duration-150 hover:text-primaryHighlight"
            >
              {a.name}
            </a>
            {a.sex === 0 ? (
              <MaleIcon size={13} className="shrink-0 text-sky-500" aria-label="Masculino" />
            ) : (
              <FemaleIcon size={13} className="shrink-0 text-pink-400" aria-label="Feminino" />
            )}
          </div>
          <p className="mt-0.5 text-[13px] text-onSurface/70">
            Level <strong className="font-semibold text-onSurface">{a.level}</strong> — {voc.label}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded bg-battleGreen/15 px-1.5 py-0.5 text-[11px] font-semibold text-battleGreen">
              <GlobeIcon size={11} />
              {a.worldName}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleFavorite}
          aria-label={favorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          aria-pressed={favorite}
          className={`pressable -m-1 grid h-8 w-8 shrink-0 place-items-center rounded-full transition-colors duration-150 ${
            favorite ? 'text-red' : 'text-onSurface/30 [@media(hover:hover)]:hover:text-red/70'
          }`}
        >
          <HeartIcon size={16} filled={favorite} />
        </button>
      </header>

      {/* Corpo */}
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-onSurface/60">
              <img src="/sprites/charms/Charm.png" alt="" aria-hidden className="pixelated h-3.5 w-3.5" />
              Charms
            </span>
            <strong className="font-semibold tabular-nums">{formatCoins(a.charmPoints)}</strong>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1 text-onSurface/60">
              <TrophyIcon size={12} className="text-primary" />
              Achievements
            </span>
            <strong className="font-semibold tabular-nums">{formatCoins(a.achievementPoints)}</strong>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
          {skills.map(s => (
            <SkillCell key={s.key} label={s.label} value={s.value} highlight={s.highlight} />
          ))}
        </div>

        {a.highlightItems.length > 0 && (
          <div className="flex items-center gap-1.5" aria-label="Itens em destaque">
            {a.highlightItems.slice(0, 4).map(item => (
              <ItemSlot
                key={item.itemId}
                clientId={item.clientId}
                name={item.name}
                count={item.count}
                tier={item.tier}
              />
            ))}
          </div>
        )}
      </div>

      {/* Rodapé: countdown + lance */}
      <footer className="flex items-center justify-between gap-2 border-t border-separator/60 px-3 py-2.5">
        <Countdown end={a.auctionEnd} />
        <div className="flex items-center gap-2.5">
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase tracking-wide text-onSurface/50">
              {hasBid ? 'Lance atual' : 'Lance inicial'}
            </p>
            <p className="flex items-center justify-end gap-1 text-sm font-bold tabular-nums">
              <CoinIcon size={14} />
              {formatCoins(bidValue)}
            </p>
          </div>
          <a
            href={auctionUrl(a.id)}
            target="_blank"
            rel="noopener noreferrer"
            className="pressable inline-flex items-center gap-1.5 rounded-md bg-green px-3 py-1.5 text-xs font-bold text-white transition-colors duration-150 [@media(hover:hover)]:hover:brightness-110"
          >
            Dar lance
            <ExternalIcon size={11} />
          </a>
        </div>
      </footer>
    </article>
  )
})
