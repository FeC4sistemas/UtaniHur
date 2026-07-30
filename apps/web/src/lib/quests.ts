export interface QuestHighlight {
  name: string
  emoji: string
}

/**
 * Quests destacadas no card (badge azul quando concluídas). O filtro cobre
 * TODAS as quests (vindas de /api/auctions/options); estas são só as que
 * ganham destaque visual no card.
 */
export const QUEST_HIGHLIGHTS: QuestHighlight[] = [
  { name: 'Soul War', emoji: '💀' },
  { name: 'Primal Ordeal', emoji: '⚔️' },
  { name: "Ferumbras' Ascendant", emoji: '🔥' },
]

export function questEmoji(name: string): string {
  return QUEST_HIGHLIGHTS.find(q => q.name === name)?.emoji ?? '📜'
}
