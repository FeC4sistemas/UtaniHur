export interface QuestMeta {
  key: string
  label: string
  emoji: string
}

/** Quests destacadas no card e no filtro. */
export const QUESTS: QuestMeta[] = [
  { key: 'soulWar', label: 'Soul War', emoji: '💀' },
  { key: 'primalOrdeal', label: 'Primal Ordeal', emoji: '⚔️' },
]

export function questMeta(key: string): QuestMeta {
  return QUESTS.find(q => q.key === key) ?? { key, label: key, emoji: '❓' }
}
