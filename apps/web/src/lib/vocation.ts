/** Mapeia ids de vocação do RubinOT para nomes curtos e cores. */

export interface VocationMeta {
  short: string
  label: string
}

const BY_NAME: Record<string, VocationMeta> = {
  'none': { short: 'None', label: 'Rookie' },
  'sorcerer': { short: 'MS', label: 'Sorcerer' },
  'master sorcerer': { short: 'MS', label: 'Master Sorcerer' },
  'druid': { short: 'ED', label: 'Druid' },
  'elder druid': { short: 'ED', label: 'Elder Druid' },
  'paladin': { short: 'RP', label: 'Paladin' },
  'royal paladin': { short: 'RP', label: 'Royal Paladin' },
  'knight': { short: 'EK', label: 'Knight' },
  'elite knight': { short: 'EK', label: 'Elite Knight' },
  'monk': { short: 'EM', label: 'Monk' },
  'exalted monk': { short: 'EM', label: 'Exalted Monk' },
}

export function vocationMeta(vocationName: string): VocationMeta {
  return (
    BY_NAME[vocationName.toLowerCase()] ?? { short: vocationName.slice(0, 2).toUpperCase(), label: vocationName }
  )
}

export interface SkillEntry {
  key: string
  label: string
  value: number
  /** skill principal da vocação — destacada no card */
  highlight: boolean
}

/** Qual skill é a "principal" de cada vocação (recebe destaque de cor). */
function highlightKey(vocationName: string, skills: Record<string, number>): string {
  const v = vocationName.toLowerCase()
  if (v.includes('sorcerer') || v.includes('druid')) return 'magic'
  if (v.includes('paladin')) return 'dist'
  if (v.includes('monk')) return 'fist'
  if (v.includes('knight')) {
    // maior entre as skills de arma corpo a corpo
    const melee = [
      ['sword', skills.sword ?? 0],
      ['axe', skills.axe ?? 0],
      ['club', skills.club ?? 0],
    ] as const
    return melee.reduce((a, b) => (b[1] > a[1] ? b : a))[0]
  }
  return 'magic'
}

/**
 * Todas as skills do personagem na ordem padrão do Tibia (8 no total),
 * marcando a principal da vocação. Fist e Fishing não vêm no feed do bazar
 * do RubinOT — quando ausentes, mostram o valor base 10.
 */
export function skillList(
  vocationName: string,
  magLevel: number,
  skills: Record<string, number>,
): SkillEntry[] {
  const hl = highlightKey(vocationName, skills)
  const order: Array<{ key: string; label: string; value: number }> = [
    { key: 'magic', label: 'Magic', value: magLevel },
    { key: 'fist', label: 'Fist', value: skills.fist ?? 10 },
    { key: 'club', label: 'Club', value: skills.club ?? 10 },
    { key: 'sword', label: 'Sword', value: skills.sword ?? 10 },
    { key: 'axe', label: 'Axe', value: skills.axe ?? 10 },
    { key: 'dist', label: 'Dist', value: skills.dist ?? 10 },
    { key: 'shielding', label: 'Shield', value: skills.shielding ?? 10 },
    { key: 'fishing', label: 'Fishing', value: skills.fishing ?? 10 },
  ]
  return order.map(s => ({ ...s, highlight: s.key === hl }))
}
