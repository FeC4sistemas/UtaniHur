import { memo, useEffect, useState } from 'react'
import type { Auction } from '../types'
import { auctionUrl, formatCoins, formatEndDate, itemSources, outfitSources, timeLeft } from '../lib/format'
import { skillList, vocationMeta } from '../lib/vocation'
import { AUGMENT_TAG_CLASS, formatAugment } from '../lib/augment'
import { DERIVED_TAG_CLASS, deriveTags } from '../lib/tags'
import { questMeta } from '../lib/quests'
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

  const boxCls =
    'relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-separator/70 bg-background'

  if (sourceIndex >= sources.length) {
    return (
      <div aria-hidden className={`${boxCls} grid place-items-center text-lg font-extrabold text-primary`}>
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
            ? // sprite sheet: zoom + alinhamento embaixo-centro, animada por steps()
              'outfit-sheet pixelated'
            : // imagem única: centralizada no quadradinho
              'pixelated absolute inset-0 m-auto max-h-full max-w-full object-contain'
        }
        style={frames > 1 ? ({ '--frames': frames } as React.CSSProperties) : undefined}
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

function SkillBar({
  label,
  value,
  max,
  highlight,
}: {
  label: string
  value: number
  max: number
  highlight: boolean
}) {
  const pct = Math.max(4, Math.min(100, Math.round((value / max) * 100)))
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span
          className={`grid h-5 min-w-[1.5rem] place-items-center rounded px-1 text-[11px] font-bold tabular-nums text-white ${
            highlight ? 'bg-battleGreen' : 'bg-amber-500'
          }`}
        >
          {value}
        </span>
        <span className={`text-[12px] font-medium ${highlight ? 'text-battleGreen' : 'text-onSurface/70'}`}>
          {label}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-onSurface/10">
        <div
          className={`h-full rounded-full ${highlight ? 'bg-battleGreen' : 'bg-amber-500/70'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/** Linha da grade de estatísticas (charms, boss points…). */
function StatRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-[12px]">
      <span className="flex min-w-0 items-center gap-1.5 text-onSurface/60">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <strong className="shrink-0 font-semibold tabular-nums">{value}</strong>
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
  const maxSkill = Math.max(...skills.map(s => s.value), 120)
  const hasBid = a.currentValue > 0
  // Level/Magic/Charms já aparecem no cabeçalho, skills e stats — filtra duplicados
  const augmentBadges = a.highlightAugments
    .map(formatAugment)
    .filter(b => !new Set(['level', 'magic', 'charm']).has(b.tone))
  const derivedTags = deriveTags(a)
  // Campos extras (do detalhe) para a grade de stats
  const e = a.extra
  const extraStats: Array<{ label: string; value: string }> = []
  if (e) {
    if (e.bossPoints != null) extraStats.push({ label: 'Boss points', value: formatCoins(e.bossPoints) })
    if (e.mountsCount != null) extraStats.push({ label: 'Mounts', value: String(e.mountsCount) })
    if (e.outfitsCount != null) extraStats.push({ label: 'Outfits', value: String(e.outfitsCount) })
    if (e.titlesCount != null) extraStats.push({ label: 'Títulos', value: String(e.titlesCount) })
    if (e.wheelPoints != null) extraStats.push({ label: 'Wheel points', value: formatCoins(e.wheelPoints) })
    if (e.dust != null) extraStats.push({ label: 'Dust', value: e.dustMax != null ? `${e.dust}/${e.dustMax}` : String(e.dust) })
    if (e.huntingTaskPoints != null) extraStats.push({ label: 'Task points', value: formatCoins(e.huntingTaskPoints) })
    if (e.preyWildcards != null) extraStats.push({ label: 'Prey wildcards', value: String(e.preyWildcards) })
  }

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
        {/* Itens em destaque — sempre 4 slots */}
        <div className="flex items-center gap-1.5" aria-label="Itens em destaque">
          {Array.from({ length: 4 }).map((_, i) => {
            const item = a.highlightItems[i]
            return item ? (
              <ItemSlot
                key={item.itemId}
                clientId={item.clientId}
                name={item.name}
                count={item.count}
                tier={item.tier}
              />
            ) : (
              <div key={`empty-${i}`} className="h-10 w-10 rounded border border-separator/60 bg-surface-2" />
            )
          })}
        </div>

        {/* Skills em duas colunas com barras */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {skills.map(s => (
            <SkillBar key={s.key} label={s.label} value={s.value} max={maxSkill} highlight={s.highlight} />
          ))}
        </div>

        <hr className="border-separator/60" />

        {/* Estatísticas */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <StatRow
            icon={<img src="/sprites/charms/Charm.png" alt="" aria-hidden className="pixelated h-3.5 w-3.5" />}
            label="Charm points"
            value={formatCoins(a.charmPoints)}
          />
          <StatRow
            icon={<TrophyIcon size={13} className="text-primary" />}
            label="Achievements"
            value={formatCoins(a.achievementPoints)}
          />
          {/* Campos extras vindos do detalhe do leilão (quando disponíveis) */}
          {extraStats.map(s => (
            <StatRow key={s.label} icon={<span className="text-onSurface/40">•</span>} label={s.label} value={s.value} />
          ))}
        </div>

        {/* Badges quantitativos (augments) */}
        {augmentBadges.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {augmentBadges.map((badge, i) => (
              <span key={i} title={badge.title} className={`truncate ${AUGMENT_TAG_CLASS}`}>
                {badge.label}
              </span>
            ))}
          </div>
        )}

        {/* Quests disponíveis */}
        {(a.questsAvailable ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {a.questsAvailable!.map(key => {
              const qm = questMeta(key)
              return (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 rounded-full bg-sky-500/12 px-2.5 py-0.5 text-[11px] font-semibold text-sky-600 dark:text-sky-300"
                >
                  {qm.label} disponível <span>{qm.emoji}</span>
                </span>
              )
            })}
          </div>
        )}

        {/* Tags qualitativas derivadas */}
        {derivedTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {derivedTags.map(tag => (
              <span key={tag.label} title={tag.title} className={DERIVED_TAG_CLASS}>
                {tag.label}
                {tag.emoji && <span className="ml-0.5">{tag.emoji}</span>}
              </span>
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
              {formatCoins(hasBid ? a.currentValue : a.startingValue)}
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
