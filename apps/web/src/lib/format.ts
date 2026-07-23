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

/** URL da imagem do outfit (gerador padrão de servidores OT). Configurável via VITE_OUTFIT_URL. */
export function outfitUrl(a: {
  lookType: number
  lookAddons: number
  lookHead?: number
  lookBody?: number
  lookLegs?: number
  lookFeet?: number
}): string {
  const template =
    (import.meta.env.VITE_OUTFIT_URL as string | undefined) ??
    'https://outfits.rubinot.com.br/animoutfit.php?id={type}&addons={addons}&head={head}&body={body}&legs={legs}&feet={feet}&mount=0&direction=3'
  return template
    .replace('{type}', String(a.lookType))
    .replace('{addons}', String(a.lookAddons))
    .replace('{head}', String(a.lookHead ?? 0))
    .replace('{body}', String(a.lookBody ?? 0))
    .replace('{legs}', String(a.lookLegs ?? 0))
    .replace('{feet}', String(a.lookFeet ?? 0))
}

/** URL da imagem de um item. Configurável via VITE_ITEM_URL. */
export function itemUrl(clientId: number): string {
  const template =
    (import.meta.env.VITE_ITEM_URL as string | undefined) ??
    'https://static.rubinot.com.br/images/items/{id}.png'
  return template.replace('{id}', String(clientId))
}

/** Link para o leilão no site oficial. */
export function auctionUrl(id: number): string {
  const template =
    (import.meta.env.VITE_AUCTION_URL as string | undefined) ??
    'https://rubinot.com.br/bazaar?auction={id}'
  return template.replace('{id}', String(id))
}
