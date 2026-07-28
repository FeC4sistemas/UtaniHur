/*
  Mapa curado: lookType → sprite local nomeada (apps/web/public/sprites/outfits).

  Cobre os outfits clássicos do Tibia, que respondem pela maioria dos leilões.
  Os lookTypes ausentes aqui (outfits novos/custom do RubinOT) são resolvidos
  pelas imagens baixadas por lookType em /sprites/looktypes — gere-as com:

      npm run sprites   (na raiz do monorepo)
*/

export interface OutfitSprite {
  /** Nome exato do arquivo (sem o sufixo _addons.gif) */
  name: string
  /** Subpasta: sprites de outfit são separadas por sexo */
  sex: 'male' | 'female'
}

export const OUTFIT_BY_LOOKTYPE: Record<number, OutfitSprite> = {
  // Outfits básicos
  128: { name: 'Citizen', sex: 'male' },
  136: { name: 'Citizen', sex: 'female' },
  129: { name: 'Hunter', sex: 'male' },
  137: { name: 'Hunter', sex: 'female' },
  130: { name: 'Mage', sex: 'male' },
  138: { name: 'Mage', sex: 'female' },
  131: { name: 'Knight', sex: 'male' },
  139: { name: 'Knight', sex: 'female' },
  132: { name: 'Nobleman', sex: 'male' },
  140: { name: 'Nobleman', sex: 'female' },
  133: { name: 'Summoner', sex: 'male' },
  141: { name: 'Summoner', sex: 'female' },
  134: { name: 'Warrior', sex: 'male' },
  142: { name: 'Warrior', sex: 'female' },

  // Outfits de quest/addon clássicos
  143: { name: 'Barbarian', sex: 'male' },
  147: { name: 'Barbarian', sex: 'female' },
  144: { name: 'Druid', sex: 'male' },
  148: { name: 'Druid', sex: 'female' },
  145: { name: 'Wizard', sex: 'male' },
  149: { name: 'Wizard', sex: 'female' },
  146: { name: 'Oriental', sex: 'male' },
  150: { name: 'Oriental', sex: 'female' },
  151: { name: 'Pirate', sex: 'male' },
  155: { name: 'Pirate', sex: 'female' },
  152: { name: 'Assassin', sex: 'male' },
  156: { name: 'Assassin', sex: 'female' },
  153: { name: 'Beggar', sex: 'male' },
  157: { name: 'Beggar', sex: 'female' },
  154: { name: 'Shaman', sex: 'male' },
  158: { name: 'Shaman', sex: 'female' },
  251: { name: 'Norseman', sex: 'male' },
  252: { name: 'Norseman', sex: 'female' },
  268: { name: 'Nightmare', sex: 'male' },
  269: { name: 'Nightmare', sex: 'female' },
  273: { name: 'Jester', sex: 'male' },
  270: { name: 'Jester', sex: 'female' },
  278: { name: 'Brotherhood', sex: 'male' },
  279: { name: 'Brotherhood', sex: 'female' },
  289: { name: 'Demon Hunter', sex: 'male' },
  288: { name: 'Demon Hunter', sex: 'female' },
  325: { name: 'Yalaharian', sex: 'male' },
  324: { name: 'Yalaharian', sex: 'female' },
  335: { name: 'Warmaster', sex: 'male' },
  336: { name: 'Warmaster', sex: 'female' },
  367: { name: 'Wayfarer', sex: 'male' },
  366: { name: 'Wayfarer', sex: 'female' },
  430: { name: 'Afflicted', sex: 'male' },
  431: { name: 'Afflicted', sex: 'female' },
  432: { name: 'Elementalist', sex: 'male' },
  433: { name: 'Elementalist', sex: 'female' },
  463: { name: 'Deepling', sex: 'male' },
  464: { name: 'Deepling', sex: 'female' },
  465: { name: 'Insectoid', sex: 'male' },
  466: { name: 'Insectoid', sex: 'female' },
  512: { name: 'Crystal Warlord', sex: 'male' },
  513: { name: 'Crystal Warlord', sex: 'female' },
  516: { name: 'Soil Guardian', sex: 'male' },
  514: { name: 'Soil Guardian', sex: 'female' },
  542: { name: 'Demon Outfit', sex: 'male' },
  541: { name: 'Demon Outfit', sex: 'female' },
  575: { name: 'Cave Explorer', sex: 'male' },
  574: { name: 'Cave Explorer', sex: 'female' },
  577: { name: 'Dream Warden', sex: 'male' },
  578: { name: 'Dream Warden', sex: 'female' },
  610: { name: 'Glooth Engineer', sex: 'male' },
  618: { name: 'Glooth Engineer', sex: 'female' },
  1211: { name: 'Golden Outfit', sex: 'male' },
  1210: { name: 'Golden Outfit', sex: 'female' },
}

/** Caminho da sprite local nomeada, se o lookType for conhecido. */
export function namedOutfitPath(lookType: number, addons: number): string | null {
  const outfit = OUTFIT_BY_LOOKTYPE[lookType]
  if (!outfit) return null
  return `/sprites/outfits/${outfit.sex}/${outfit.name}_${addons}.gif`
}
