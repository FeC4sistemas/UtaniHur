import type { HighlightAugment } from '../types'

export type AugmentTone = 'level' | 'magic' | 'charm' | 'boss' | 'gold' | 'bless' | 'dust' | 'default'

export interface AugmentBadge {
  label: string
  /** texto original completo, usado no tooltip */
  title: string
  tone: AugmentTone
}

function firstNumber(text: string): string | null {
  const m = text.match(/\d[\d.,]*/)
  return m ? m[0].replace(/[.,]+$/, '') : null
}

/** Encurta números grandes: 903096 → 903k, 1500000 → 1.5M */
function short(nStr: string): string {
  const n = Number(nStr.replace(/[.,]/g, ''))
  if (!Number.isFinite(n)) return nStr
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  return new Intl.NumberFormat('pt-BR').format(n)
}

/**
 * Converte um highlightAugment do RubinOT num badge curto.
 * Mantém o texto original como tooltip para não perder informação.
 */
export function formatAugment(a: HighlightAugment): AugmentBadge {
  const text = a.text.trim()
  const title = text
  const num = firstNumber(text)

  // Magic Level (ex.: "113 Magic Level (Loyalty bonus not included)")
  if (/magic level/i.test(text)) return { label: `Magic ${num ?? ''}`.trim(), title, tone: 'magic' }

  // Level (ex.: "640 Level")
  if (/^\s*\d[\d.,]*\s+level\b/i.test(text)) return { label: `Level ${num ?? ''}`.trim(), title, tone: 'level' }

  // Boss Points (ex.: "Total Boss Points: 110")
  if (/boss points/i.test(text)) {
    const m = text.match(/boss points:?\s*(\d[\d.,]*)/i)
    return { label: `Boss Pts ${m ? m[1] : num ?? ''}`.trim(), title, tone: 'boss' }
  }

  // Bosstiary (ex.: "Bosses in Bosstiary completed: 4")
  if (/bosstiary/i.test(text)) {
    const m = text.match(/completed:?\s*(\d+)/i)
    return { label: `Bosstiary ${m ? m[1] : num ?? ''}`.trim(), title, tone: 'boss' }
  }

  // Charm Points (ex.: "Total Charm Points: 1890, Unused Charm Points: 370")
  if (/charm points/i.test(text)) {
    const total = text.match(/total charm points:?\s*(\d[\d.,]*)/i)
    const v = (total ? total[1] : num ?? '').replace(/[.,]+$/, '')
    return { label: `Charms ${v}`.trim(), title, tone: 'charm' }
  }

  // Gold (ex.: "903096 Gold total in bank, inventory and depot")
  if (/gold/i.test(text)) return { label: `${num ? short(num) : ''} Gold`.trim(), title, tone: 'gold' }

  // Blessings (ex.: "Blessings active: 7/7")
  if (/blessing/i.test(text)) {
    const m = text.match(/(\d+\s*\/\s*\d+)/)
    return { label: `Bless ${m ? m[1].replace(/\s/g, '') : ''}`.trim(), title, tone: 'bless' }
  }

  // Dust (ex.: "Exalted Dust/Dust Limit: 86/197")
  if (/dust/i.test(text)) {
    const m = text.match(/(\d+\s*\/\s*\d+)/)
    return { label: `Dust ${m ? m[1].replace(/\s/g, '') : ''}`.trim(), title, tone: 'dust' }
  }

  // Fallback: texto original (truncado no CSS)
  return { label: text, title, tone: 'default' }
}

/** Estilo unificado de "tag" laranja para os badges de destaque. */
export const AUGMENT_TAG_CLASS =
  'rounded-md border border-amber-500/35 bg-amber-500/12 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300'

export const AUGMENT_TONE_CLASS: Record<AugmentTone, string> = {
  level: 'bg-primary/12 text-primary',
  magic: 'bg-primary/12 text-primary',
  charm: 'bg-rare/15 text-rare',
  boss: 'bg-red/12 text-red',
  gold: 'bg-amber-400/15 text-amber-600 dark:text-amber-400',
  bless: 'bg-battleGreen/15 text-battleGreen',
  dust: 'bg-purple-400/15 text-purple-500 dark:text-purple-300',
  default: 'bg-onSurface/8 text-onSurface/70',
}
