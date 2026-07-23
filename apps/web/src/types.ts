export interface AuctionSkills {
  club: number
  sword: number
  axe: number
  dist: number
  shielding: number
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

export interface AuctionFilters {
  search: string
  vocation: number | null
  world: string | null
  sex: number | null
  minLevel: string
  maxLevel: string
  minMagLevel: string
}

export const EMPTY_FILTERS: AuctionFilters = {
  search: '',
  vocation: null,
  world: null,
  sex: null,
  minLevel: '',
  maxLevel: '',
  minMagLevel: '',
}
