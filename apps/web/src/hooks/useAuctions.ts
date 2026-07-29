import { useEffect, useRef, useState } from 'react'
import type { AuctionFilters, AuctionListResponse, FilterOptions, SortBy, SortOrder } from '../types'

interface Params {
  filters: AuctionFilters
  sortBy: SortBy
  sortOrder: SortOrder
  page: number
  limit: number
}

interface State {
  data: AuctionListResponse | null
  loading: boolean
  error: string | null
}

export function useAuctions({ filters, sortBy, sortOrder, page, limit }: Params): State {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null })
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const params = new URLSearchParams()
    params.set('page', String(page))
    params.set('limit', String(limit))
    params.set('sortBy', sortBy)
    params.set('sortOrder', sortOrder)
    if (filters.search) params.set('search', filters.search)
    if (filters.vocation !== null) params.set('vocation', String(filters.vocation))
    if (filters.world) params.set('world', filters.world)
    if (filters.pvp) params.set('pvp', filters.pvp)
    if (filters.sex !== null) params.set('sex', String(filters.sex))
    if (filters.minLevel) params.set('minLevel', filters.minLevel)
    if (filters.maxLevel) params.set('maxLevel', filters.maxLevel)
    if (filters.minMagLevel) params.set('minMagLevel', filters.minMagLevel)
    if (filters.maxMagLevel) params.set('maxMagLevel', filters.maxMagLevel)
    if (filters.skillKey && filters.minSkill) {
      params.set('skillKey', filters.skillKey)
      params.set('minSkill', filters.minSkill)
    }
    if (filters.minPrice) params.set('minPrice', filters.minPrice)
    if (filters.maxPrice) params.set('maxPrice', filters.maxPrice)
    if (filters.hasBid) params.set('hasBid', filters.hasBid)
    if (filters.minCharm) params.set('minCharm', filters.minCharm)
    if (filters.minBoss) params.set('minBoss', filters.minBoss)
    if (filters.minMounts) params.set('minMounts', filters.minMounts)
    if (filters.minOutfits) params.set('minOutfits', filters.minOutfits)
    if (filters.charmExpansion) params.set('charmExpansion', 'true')
    if (filters.outfits.length) params.set('outfits', filters.outfits.join(','))
    if (filters.mounts.length) params.set('mounts', filters.mounts.join(','))
    if (filters.reqAddon1) params.set('oAddon1', 'true')
    if (filters.reqAddon2) params.set('oAddon2', 'true')
    if (filters.quests.length) params.set('quests', filters.quests.join(','))

    setState(s => ({ ...s, loading: true, error: null }))

    fetch(`/api/auctions?${params}`, { signal: controller.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<AuctionListResponse>
      })
      .then(data => setState({ data, loading: false, error: null }))
      .catch(err => {
        if (err.name === 'AbortError') return
        setState(s => ({ ...s, loading: false, error: 'Não foi possível carregar os leilões. Verifique se a API está rodando.' }))
      })

    return () => controller.abort()
  }, [filters, sortBy, sortOrder, page, limit])

  return state
}

export function useFilterOptions(): FilterOptions {
  const [options, setOptions] = useState<FilterOptions>({ worlds: [], vocations: [] })

  useEffect(() => {
    fetch('/api/auctions/options')
      .then(res => (res.ok ? res.json() : Promise.reject(res.status)))
      .then(setOptions)
      .catch(() => {
        /* filtros seguem funcionando com campos livres */
      })
  }, [])

  return options
}
