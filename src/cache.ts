import fs from 'fs/promises'
import path from 'path'

import type { Cache, CachedEpisode } from './types.js'

export { initCache, readCache, saveCache, listCache }

const CACHE_DIR = './cache'

async function initCache() {
  await fs.mkdir(CACHE_DIR, { recursive: true })
}

function cacheReviver(key: string, value: unknown) {
  if (key === 'date' && typeof value === 'string') {
    return new Date(value)
  }

  return value
}

async function readCache(program: string): Promise<Cache> {
  const cacheFile = `${CACHE_DIR}/${program}.json`
  let cache: Record<string, CachedEpisode> = {}
  try {
    cache = JSON.parse(await fs.readFile(cacheFile, 'utf-8'), cacheReviver)
  } catch {
    await fs.mkdir(path.dirname(cacheFile), { recursive: true })
  } finally {
    return new Map(Object.entries(cache))
  }
}

async function saveCache(program: string, cache: Cache) {
  const cacheFile = `${CACHE_DIR}/${program}.json`
  await fs.writeFile(
    cacheFile,
    JSON.stringify(Object.fromEntries(cache), null, 2)
  )
}

async function listCache() {
  return (
    await fs.readdir(CACHE_DIR, {
      recursive: true
    })
  )
    .filter(e => e.endsWith('.json'))
    .map(e => e.slice(0, -5))
}
