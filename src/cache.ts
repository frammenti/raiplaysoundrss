import fs from 'fs/promises'

export { cache, loadCache, saveCache }

const CACHE_FILE = './cache.json'

interface Episode {
  mp3: string
  date: Date | string
  resolvedAt: number | string
}

let cache: Record<string, Record<string, Episode>>

async function loadCache() {
  try {
    cache = JSON.parse(await fs.readFile(CACHE_FILE, 'utf-8'))
  } catch {
    cache = {}
  }
}

async function saveCache() {
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2))
}
