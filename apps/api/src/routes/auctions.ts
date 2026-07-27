import { Router, Request, Response } from 'express'
import fs from 'fs'
import path from 'path'

const router = Router()

const DATA_FILE = path.resolve(__dirname, '../../../scraper/output/CurrentAuctions.json')
const DETAILS_FILE = path.resolve(__dirname, '../../../scraper/output/AuctionDetails.json')

type OwnedOutfit = string | { name: string; addons?: number }
function loadDetails(): Record<string, { skills?: any; extra?: any; outfits?: OwnedOutfit[]; mounts?: string[] }> {
  if (!fs.existsSync(DETAILS_FILE)) return {}
  try {
    return JSON.parse(fs.readFileSync(DETAILS_FILE, 'utf-8')).byId || {}
  } catch {
    return {}
  }
}

function loadAuctions() {
  if (!fs.existsSync(DATA_FILE)) return []
  const raw = fs.readFileSync(DATA_FILE, 'utf-8')
  const data = JSON.parse(raw)
  const auctions = data.auctions || []
  // Mescla o detalhe (skills completas + campos extras), quando disponível
  const byId = loadDetails()
  return auctions.map((a: any) => {
    const d = byId[a.id]
    if (!d) return a
    return {
      ...a,
      // fist/fishing reais vindos do detalhe
      skills: { ...a.skills, ...(d.skills?.fist != null ? { fist: d.skills.fist } : {}), ...(d.skills?.fishing != null ? { fishing: d.skills.fishing } : {}) },
      extra: d.extra ?? undefined,
    }
  })
}

// Pares base → promovida (ex.: filtrar por Elite Knight inclui Knight)
const VOCATION_FAMILY: Record<number, number[]> = {
  1: [1, 5], 5: [1, 5],   // Sorcerer / Master Sorcerer
  2: [2, 6], 6: [2, 6],   // Druid / Elder Druid
  3: [3, 7], 7: [3, 7],   // Paladin / Royal Paladin
  4: [4, 8], 8: [4, 8],   // Knight / Elite Knight
  9: [9, 10], 10: [9, 10] // Monk / Exalted Monk
}

// Tipo de PvP por mundo (fonte: /api/worlds do RubinOT)
const WORLD_PVP: Record<string, string> = {
  Auroria: 'pvp', Belaria: 'pvp', Bellum: 'pvp-enforced', Divinian: 'no-pvp',
  Elysian: 'no-pvp', Etherian: 'no-pvp', 'Grimoria I': 'pvp', 'Grimoria II': 'pvp',
  'Grimoria III': 'pvp', 'Grimoria IV': 'pvp', Halorian: 'no-pvp', Lunarian: 'no-pvp',
  Mystian: 'no-pvp', Serenian: 'no-pvp', Solarian: 'no-pvp', Spectrum: 'pvp-enforced',
  Tenebrium: 'pvp-enforced', Vesperia: 'pvp',
}

/** Skill efetiva de um leilão pela chave (magic = magLevel). */
function skillValue(a: any, key: string): number {
  if (key === 'magic') return a.magLevel ?? 0
  return a.skills?.[key] ?? 0
}

router.get('/options', (_req: Request, res: Response) => {
  try {
    const auctions = loadAuctions()
    const worlds = [...new Set(auctions.map((a: any) => a.worldName as string))].sort()
    const vocMap = new Map<number, string>()
    for (const a of auctions) {
      if (a.vocation > 0) vocMap.set(a.vocation, a.vocationName)
    }
    const vocations = [...vocMap.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.id - b.id)
    res.json({ worlds, vocations })
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar opções de filtro' })
  }
})

router.get('/', (req: Request, res: Response) => {
  try {
    let auctions = loadAuctions()

    // Filtros
    const {
      search, vocation, world, pvp, sex,
      minLevel, maxLevel, minMagLevel, maxMagLevel,
      skillKey, minSkill,
      minPrice, maxPrice, hasBid,
      minCharm, minBoss, minMounts, minOutfits,
      charmExpansion, outfits, mounts, oAddon1, oAddon2,
      page = '1', limit = '25', sortBy = 'auctionEnd', sortOrder = 'asc',
    } = req.query

    const q = (v: any) => v !== undefined && v !== '' && v !== null
    const bidValue = (a: any) => (a.currentValue > 0 ? a.currentValue : a.startingValue)

    if (q(search)) {
      const term = String(search).toLowerCase()
      auctions = auctions.filter((a: any) => a.name.toLowerCase().includes(term))
    }
    if (q(vocation)) {
      const family = VOCATION_FAMILY[Number(vocation)] ?? [Number(vocation)]
      auctions = auctions.filter((a: any) => family.includes(a.vocation))
    }
    if (q(sex)) auctions = auctions.filter((a: any) => a.sex === Number(sex))
    if (q(world)) auctions = auctions.filter((a: any) => a.worldName.toLowerCase() === String(world).toLowerCase())
    if (q(pvp)) auctions = auctions.filter((a: any) => WORLD_PVP[a.worldName] === String(pvp))
    if (q(minLevel)) auctions = auctions.filter((a: any) => a.level >= Number(minLevel))
    if (q(maxLevel)) auctions = auctions.filter((a: any) => a.level <= Number(maxLevel))
    if (q(minMagLevel)) auctions = auctions.filter((a: any) => a.magLevel >= Number(minMagLevel))
    if (q(maxMagLevel)) auctions = auctions.filter((a: any) => a.magLevel <= Number(maxMagLevel))
    if (q(skillKey) && q(minSkill)) {
      auctions = auctions.filter((a: any) => skillValue(a, String(skillKey)) >= Number(minSkill))
    }
    if (q(minPrice)) auctions = auctions.filter((a: any) => bidValue(a) >= Number(minPrice))
    if (q(maxPrice)) auctions = auctions.filter((a: any) => bidValue(a) <= Number(maxPrice))
    if (hasBid === 'yes') auctions = auctions.filter((a: any) => a.currentValue > 0)
    if (hasBid === 'no') auctions = auctions.filter((a: any) => !(a.currentValue > 0))
    if (q(minCharm)) auctions = auctions.filter((a: any) => a.charmPoints >= Number(minCharm))
    // Filtros que dependem do detalhe (extra): excluem quem não tem o dado
    if (q(minBoss)) auctions = auctions.filter((a: any) => (a.extra?.bossPoints ?? -1) >= Number(minBoss))
    if (q(minMounts)) auctions = auctions.filter((a: any) => (a.extra?.mountsCount ?? -1) >= Number(minMounts))
    if (q(minOutfits)) auctions = auctions.filter((a: any) => (a.extra?.outfitsCount ?? -1) >= Number(minOutfits))
    if (charmExpansion === 'true') auctions = auctions.filter((a: any) => a.extra?.charmExpansion === true)
    // Filtro por posse de outfits/mounts (nomes separados por vírgula; precisa ter todos).
    // oAddon1/oAddon2 exigem que o outfit possuído tenha aquele(s) addon(s).
    if (q(outfits) || q(mounts)) {
      const byId = loadDetails()
      const norm = (s: string) => s.trim().toLowerCase()
      const wantOutfits = q(outfits) ? String(outfits).split(',').filter(Boolean).map(norm) : []
      const wantMounts = q(mounts) ? String(mounts).split(',').filter(Boolean).map(norm) : []
      const reqMask = (oAddon1 === 'true' ? 1 : 0) | (oAddon2 === 'true' ? 2 : 0)
      auctions = auctions.filter((a: any) => {
        const d = byId[a.id]
        if (!d) return false
        // mapa nome(minúsculo) → addons do que o personagem possui (tolera formato antigo string)
        const ownedO = new Map<string, number>()
        for (const o of d.outfits ?? []) {
          if (typeof o === 'string') ownedO.set(norm(o), 0)
          else ownedO.set(norm(o.name), o.addons ?? 0)
        }
        const ownedM = new Set((d.mounts ?? []).map(norm))
        const outfitsOk = wantOutfits.every(o => ownedO.has(o) && (ownedO.get(o)! & reqMask) === reqMask)
        const mountsOk = wantMounts.every(m => ownedM.has(m))
        return outfitsOk && mountsOk
      })
    }

    // Ordenação
    auctions.sort((a: any, b: any) => {
      let valA, valB
      switch (sortBy) {
        case 'level':      valA = a.level;        valB = b.level;        break
        case 'price':      valA = a.currentValue; valB = b.currentValue; break
        case 'magLevel':   valA = a.magLevel;     valB = b.magLevel;     break
        default:           valA = a.auctionEnd;   valB = b.auctionEnd;   break
      }
      return sortOrder === 'desc' ? valB - valA : valA - valB
    })

    // Paginação
    const pageNum = Math.max(1, Number(page))
    const limitNum = Math.min(100, Math.max(1, Number(limit)))
    const total = auctions.length
    const totalPages = Math.ceil(total / limitNum)
    const start = (pageNum - 1) * limitNum
    const paginated = auctions.slice(start, start + limitNum)

    res.json({
      auctions: paginated,
      pagination: { page: pageNum, limit: limitNum, total, totalPages }
    })
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar auções' })
  }
})

router.get('/:id', (req: Request, res: Response) => {
  try {
    const auctions = loadAuctions()
    const auction = auctions.find((a: any) => a.id === Number(req.params.id))
    if (!auction) return res.status(404).json({ error: 'Aução não encontrada' })
    res.json(auction)
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar aução' })
  }
})

export default router