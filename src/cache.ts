import fs from 'fs/promises'
import path from 'path'

export { initCache, readCache, saveCache, listCache }

const CACHE_DIR = './cache'

interface Episode {
  mp3: string
  date: Date | string
  resolvedAt: number | string
}

type Cache = Record<string, Episode>

async function initCache() {
  await fs.mkdir(CACHE_DIR, { recursive: true })
}

async function readCache(program: string): Promise<Cache> {
  const cacheFile = `${CACHE_DIR}/${program}.json`
  try {
    return JSON.parse(await fs.readFile(cacheFile, 'utf-8'))
  } catch {
    await fs.mkdir(path.dirname(cacheFile), { recursive: true })
    return {}
  }
}

async function saveCache(program: string, cache: Cache) {
  const cacheFile = `${CACHE_DIR}/${program}.json`
  await fs.writeFile(cacheFile, JSON.stringify(cache, null, 2))
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
