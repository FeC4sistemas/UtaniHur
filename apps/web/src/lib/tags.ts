import type { Auction } from '../types'

export interface DerivedTag {
  label: string
  title: string
  emoji?: string
}

/** Estilo das tags qualitativas derivadas (distinto dos badges de augment). */
export const DERIVED_TAG_CLASS =
  'inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary'

function augmentNumber(a: Auction, re: RegExp): number | null {
  for (const aug of a.highlightAugments) {
    const m = aug.text.match(re)
    if (m) return Number(m[1].replace(/[.,]/g, ''))
  }
  return null
}

/**
 * Gera tags qualitativas a partir dos dados disponíveis. São heurísticas
 * (limiares nossos), não os critérios oficiais do Exevo Pan.
 */
export function deriveTags(a: Auction): DerivedTag[] {
  const tags: DerivedTag[] = []

  if (a.charmPoints >= 5000)
    tags.push({ label: 'Muitos charms', title: `${a.charmPoints} charm points`, emoji: '✨' })

  const bossPts = augmentNumber(a, /boss points:?\s*(\d[\d.,]*)/i)
  if (bossPts !== null && bossPts >= 3000)
    tags.push({ label: 'Muito boss points', title: `${bossPts} boss points`, emoji: '💀' })

  const bosstiary = augmentNumber(a, /bosstiary completed:?\s*(\d+)/i)
  if (bosstiary !== null && bosstiary >= 10)
    tags.push({ label: 'Bosstiary alto', title: `${bosstiary} bosses no bosstiary` })

  const bless = a.highlightAugments.find(x => /blessing/i.test(x.text))?.text.match(/(\d+)\s*\/\s*(\d+)/)
  if (bless && bless[1] === bless[2])
    tags.push({ label: 'Full bless', title: `Blessings ${bless[1]}/${bless[2]}`, emoji: '🙏' })

  const gold = augmentNumber(a, /(\d[\d.,]*)\s*gold/i)
  if (gold !== null && gold >= 1_000_000)
    tags.push({ label: 'Rico', title: `${gold.toLocaleString('pt-BR')} gold`, emoji: '💰' })

  if (a.achievementPoints >= 800)
    tags.push({ label: 'Muitas conquistas', title: `${a.achievementPoints} achievement points`, emoji: '🏆' })

  if (a.level >= 1000) tags.push({ label: 'Alto level', title: `Level ${a.level}` })

  // Campos vindos do detalhe (/api/bazaar/{id})
  const e = a.extra
  if (e) {
    if ((e.mountsCount ?? 0) >= 40)
      tags.push({ label: 'Muitas mounts', title: `${e.mountsCount} mounts`, emoji: '🐎' })
    if ((e.outfitsCount ?? 0) >= 40)
      tags.push({ label: 'Muitos outfits', title: `${e.outfitsCount} outfits`, emoji: '👕' })
    if ((e.titlesCount ?? 0) >= 20)
      tags.push({ label: 'Colecionador de títulos', title: `${e.titlesCount} títulos` })
    if (e.charmExpansion) tags.push({ label: 'Charm Expansion', title: 'Charm Expansion ativa' })
    if (e.permanentWeeklyTaskSlot) tags.push({ label: 'Weekly Task Slot', title: 'Slot permanente de weekly task' })
    if (e.thirdPrey) tags.push({ label: '3ª Prey', title: 'Terceiro slot de prey' })
    if (e.thirdHunting) tags.push({ label: '3ª Hunting Task', title: 'Terceiro slot de hunting task' })
  }

  return tags
}
