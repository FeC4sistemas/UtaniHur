const nf = new Intl.NumberFormat('pt-BR')

export function formatCoins(value: number): string {
  return nf.format(value)
}

export function formatEndDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000)
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export interface TimeLeft {
  expired: boolean
  label: string
  urgent: boolean
}

export function timeLeft(unixSeconds: number, now = Date.now()): TimeLeft {
  const diff = unixSeconds * 1000 - now
  if (diff <= 0) return { expired: true, label: 'Encerrado', urgent: false }

  const s = Math.floor(diff / 1000)
  const days = Math.floor(s / 86400)
  const hours = Math.floor((s % 86400) / 3600)
  const minutes = Math.floor((s % 3600) / 60)
  const seconds = s % 60

  let label: string
  if (days > 0) label = `${days}d ${hours}h ${minutes}m`
  else if (hours > 0) label = `${hours}h ${minutes}m ${seconds}s`
  else label = `${minutes}m ${seconds}s`

  return { expired: false, label, urgent: diff < 3600_000 }
}

import { namedOutfitPath } from '../data/outfitMap'

/**
 * Fontes de imagem do outfit, em ordem de preferência:
 * 1. sprite do leilão com as cores exatas do personagem (gerada por `npm run sprites:rubinot`)
 * 2. sprite local por lookType (gerada por `npm run sprites` ou pelo fallback do sprites:rubinot)
 * 3. sprite local nomeada (mapa curado de outfits clássicos)
 * 4. imagem oficial do char bazaar por lookType (remota)
 * O componente tenta a próxima fonte quando uma falha; sem nenhuma, mostra o badge da vocação.
 */
export function outfitSources(a: {
  id: number
  lookType: number
  lookAddons: number
  lookHead?: number
  lookBody?: number
  lookLegs?: number
  lookFeet?: number
}): string[] {
  const colored = `${a.lookType}_${a.lookAddons}_${a.lookHead ?? 0}_${a.lookBody ?? 0}_${a.lookLegs ?? 0}_${a.lookFeet ?? 0}`
  const base = `${a.lookType}_${a.lookAddons}`
  const sources = [
    `/sprites/auctions/${a.id}.png`,
    `/sprites/auctions/${a.id}.gif`,
    `/sprites/looktypes/${colored}.png`,
    `/sprites/looktypes/${colored}.gif`,
    `/sprites/looktypes/${base}.gif`,
    `/sprites/looktypes/${base}.png`,
  ]
  const named = namedOutfitPath(a.lookType, a.lookAddons)
  if (named) sources.push(named)
  const remote =
    (import.meta.env.VITE_OUTFIT_URL as string | undefined) ??
    'https://static.tibia.com/images/charactertrade/outfits/{type}_{addons}.gif'
  sources.push(remote.replace('{type}', String(a.lookType)).replace('{addons}', String(a.lookAddons)))
  return sources
}

/**
 * Fontes de imagem de um item, em ordem de preferência:
 * sprites locais (baixadas por `npm run sprites:rubinot`) e depois a URL remota.
 */
export function itemSources(clientId: number): string[] {
  const remote =
    (import.meta.env.VITE_ITEM_URL as string | undefined) ??
    'https://static.tibia.com/images/charactertrade/objects/{id}.gif'
  return [
    `/sprites/items/${clientId}.gif`,
    `/sprites/items/${clientId}.png`,
    remote.replace('{id}', String(clientId)),
  ]
}

/** Link para o leilão no site oficial. */
export function auctionUrl(id: number): string {
  const template =
    (import.meta.env.VITE_AUCTION_URL as string | undefined) ??
    'https://rubinot.com.br/bazaar?auction={id}'
  return template.replace('{id}', String(id))
}
