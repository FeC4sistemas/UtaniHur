export interface AuctionListItem {
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
  lookAddons: number
  magLevel: number
  charmPoints: number
  achievementPoints: number
  skills: {
    club: number
    sword: number
    axe: number
    dist: number
    shielding: number
  }
  highlightItems: Array<{
    itemId: number
    clientId: number
    tier: number
    count: number
    name: string
  }>
  highlightAugments: Array<{
    text: string
    argType: number
  }>
  scrapedAt?: string
}

export interface AuctionListResponse {
  auctions: AuctionListItem[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}