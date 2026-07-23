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

export const SKILL_LABELS: Record<string, string> = {
  club: 'Club',
  sword: 'Sword',
  axe: 'Axe',
  dist: 'Distance',
  shielding: 'Shielding',
}

/** Retorna as três skills de maior valor (magic level incluído). */
export function topSkills(
  magLevel: number,
  skills: Record<string, number>,
): Array<{ key: string; label: string; value: number }> {
  const all = [
    { key: 'magic', label: 'Magic', value: magLevel },
    ...Object.entries(skills).map(([key, value]) => ({
      key,
      label: SKILL_LABELS[key] ?? key,
      value,
    })),
  ]
  return all.sort((a, b) => b.value - a.value).slice(0, 3)
}
