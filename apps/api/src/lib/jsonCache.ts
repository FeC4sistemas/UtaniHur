import fs from 'fs'

/**
 * Cache em memória para os JSONs do scraper, invalidado por mtime do arquivo.
 *
 * As rotas liam e faziam JSON.parse de vários MB (AuctionDetails ~3.6MB,
 * HistoryAuctions ~14MB) a CADA request. Como esses arquivos só mudam quando o
 * scraper regrava, basta reparsear quando o mtime muda. Reduz o custo por
 * request de "parsear MBs" para "um statSync + lookup".
 */

function mtime(file: string): number {
  try {
    return fs.statSync(file).mtimeMs
  } catch {
    return -1 // arquivo ausente
  }
}

const single = new Map<string, { mtimeMs: number; value: unknown }>()

/** Lê e transforma um JSON, com cache invalidado por mtime. */
export function readCached<T>(file: string, build: (raw: string) => T, fallback: T): T {
  const m = mtime(file)
  if (m < 0) return fallback
  const hit = single.get(file)
  if (hit && hit.mtimeMs === m) return hit.value as T
  try {
    const value = build(fs.readFileSync(file, 'utf-8'))
    single.set(file, { mtimeMs: m, value })
    return value
  } catch {
    return fallback
  }
}

const derived = new Map<string, { sig: string; value: unknown }>()

/**
 * Memoiza um cálculo derivado de vários arquivos. Recalcula só quando o mtime
 * de qualquer um deles muda. Use para merges/agregações (ex.: leilões +
 * detalhe + quests, ou estatísticas sobre o histórico).
 *
 * ⚠️ O valor é compartilhado entre requests — nunca mute o retorno in-place
 * (ex.: `.sort()`); ordene/filtre sobre cópia.
 */
export function memoByFiles<T>(key: string, files: string[], compute: () => T): T {
  const sig = files.map(mtime).join(':')
  const hit = derived.get(key)
  if (hit && hit.sig === sig) return hit.value as T
  const value = compute()
  derived.set(key, { sig, value })
  return value
}
