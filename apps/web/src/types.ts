export interface AuctionSkills {
  club: number
  sword: number
  axe: number
  dist: number
  shielding: number
  fist?: number
  fishing?: number
}

/** Campos extras vindos do detalhe do leilão (/api/bazaar/{id} → general). */
export interface AuctionExtra {
  mountsCount?: number
  outfitsCount?: number
  titlesCount?: number
  bossPoints?: number
  wheelPoints?: number
  maxWheelPoints?: number
  dust?: number
  dustMax?: number
  huntingTaskPoints?: number
  preyWildcards?: number
  hirelingCount?: number
  thirdPrey?: boolean
  thirdHunting?: boolean
  charmExpansion?: boolean
  permanentWeeklyTaskSlot?: boolean
}

export interface HighlightItem {
  itemId: number
  clientId: number
  tier: number
  count: number
  name: string
}

export interface HighlightAugment {
  text: string
  argType: number
}

export interface Auction {
  id: number
  state: number
  stateName: string
  startingValue: number
  currentValue: number
  auctionStart: number
  auctionEnd: number
  name: string
  level: number
  vocation: number
  vocationName: string
  sex: number
  worldName: string
  lookType: number
  lookHead?: number
  lookBody?: number
  lookLegs?: number
  lookFeet?: number
  lookAddons: number
  magLevel: number
  charmPoints: number
  achievementPoints: number
  skills: AuctionSkills
  highlightItems: HighlightItem[]
  highlightAugments: HighlightAugment[]
  /** Campos extras vindos do detalhe do leilão (/api/bazaar/{id}). */
  extra?: AuctionExtra
}

export interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface AuctionListResponse {
  auctions: Auction[]
  pagination: Pagination
}

export interface FilterOptions {
  worlds: string[]
  vocations: Array<{ id: number; name: string }>
}

export type SortBy = 'auctionEnd' | 'level' | 'price' | 'magLevel'
export type SortOrder = 'asc' | 'desc'

export type SkillKey = 'magic' | 'club' | 'sword' | 'axe' | 'dist' | 'shielding' | 'fist' | 'fishing'
export type PvpType = 'pvp' | 'no-pvp' | 'pvp-enforced'
export type HasBid = 'yes' | 'no'

export interface AuctionFilters {
  search: string
  vocation: number | null
  world: string | null
  pvp: PvpType | null
  sex: number | null
  minLevel: string
  maxLevel: string
  minMagLevel: string
  maxMagLevel: string
  skillKey: SkillKey | null
  minSkill: string
  minPrice: string
  maxPrice: string
  hasBid: HasBid | null
  minCharm: string
  minBoss: string
  minMounts: string
  minOutfits: string
  charmExpansion: boolean
  outfits: string[]
  mounts: string[]
  reqAddon1: boolean
  reqAddon2: boolean
}

export const EMPTY_FILTERS: AuctionFilters = {
  search: '',
  vocation: null,
  world: null,
  pvp: null,
  sex: null,
  minLevel: '',
  maxLevel: '',
  minMagLevel: '',
  maxMagLevel: '',
  skillKey: null,
  minSkill: '',
  minPrice: '',
  maxPrice: '',
  hasBid: null,
  minCharm: '',
  minBoss: '',
  minMounts: '',
  minOutfits: '',
  charmExpansion: false,
  outfits: [],
  mounts: [],
  reqAddon1: false,
  reqAddon2: false,
}
