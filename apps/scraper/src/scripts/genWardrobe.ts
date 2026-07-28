/*
  Gera o manifesto de outfits/mounts (apps/web/public/wardrobe.json) a partir
  das sprites em apps/web/public/sprites. Usado pelo seletor visual de filtro.

  Uso: npm run wardrobe   (na raiz do monorepo)
*/
import fs from 'fs'
import path from 'path'

const SPRITES = path.resolve(__dirname, '../../../web/public/sprites')
const OUT = path.resolve(__dirname, '../../../web/public/wardrobe.json')

/** Nomes únicos de outfit numa pasta ({Nome}_{addon}.gif). */
function outfitNames(dir: string): Set<string> {
  const names = new Set<string>()
  if (!fs.existsSync(dir)) return names
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/^(.+)_[0-3]\.(gif|png)$/i)
    if (m) names.add(m[1])
  }
  return names
}

/** Nomes de mount ({Nome}.gif). */
function mountNames(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .map(f => f.replace(/\.(gif|png)$/i, ''))
    .sort()
}

const outfitsMale = outfitNames(path.join(SPRITES, 'outfits/male'))
const outfitsFemale = outfitNames(path.join(SPRITES, 'outfits/female'))
const storeMale = outfitNames(path.join(SPRITES, 'storeoutfits/male'))
const storeFemale = outfitNames(path.join(SPRITES, 'storeoutfits/female'))

const outfitAll = new Map<string, { name: string; store: boolean; male: boolean; female: boolean }>()
const addOutfit = (name: string, store: boolean, sex: 'male' | 'female') => {
  const cur = outfitAll.get(name) ?? { name, store, male: false, female: false }
  cur[sex] = true
  cur.store = cur.store || store
  outfitAll.set(name, cur)
}
outfitsMale.forEach(n => addOutfit(n, false, 'male'))
outfitsFemale.forEach(n => addOutfit(n, false, 'female'))
storeMale.forEach(n => addOutfit(n, true, 'male'))
storeFemale.forEach(n => addOutfit(n, true, 'female'))

const outfits = [...outfitAll.values()].sort((a, b) => a.name.localeCompare(b.name))

const regularMounts = new Set(mountNames(path.join(SPRITES, 'mounts')))
const storeMounts = mountNames(path.join(SPRITES, 'storemounts'))
const mountAll = new Map<string, { name: string; store: boolean }>()
regularMounts.forEach(n => mountAll.set(n, { name: n, store: false }))
storeMounts.forEach(n => {
  if (!mountAll.has(n)) mountAll.set(n, { name: n, store: true })
})
const mounts = [...mountAll.values()].sort((a, b) => a.name.localeCompare(b.name))

fs.writeFileSync(OUT, JSON.stringify({ outfits, mounts }, null, 0))
console.log(`✅ wardrobe.json: ${outfits.length} outfits | ${mounts.length} mounts`)
