import { Feed } from 'feed'

import { readCache, saveCache, listCache } from './cache.js'
import { updateStatus, error } from './status.js'
import { log, duration, fetchT, format, parseDate, mapLimit } from './utils.js'

export { buildFeed, buildAll }

const BASE = 'https://www.raiplaysound.it'
const MP3_TTL = 1000 * 60 * 60 * 24 * 7 // 1 week

const MEDIA_URL = 'https://creativemedia'
const MEDIA_URL_FULL = 'https://creativemedia{0}-rai-it.akamaized.net/'
const PATTERN = /ostr(?<number>\d+)\/(?<file>.*?mp\d)/

async function resolveMp3(relinker: string) {
  const res = await fetchT(relinker, {
    method: 'HEAD',
    redirect: 'follow'
  })
  let url = res.url
  if (!url.startsWith(MEDIA_URL)) {
    const { number, file } = PATTERN.exec(url)?.groups ?? {}
    if (!file) throw new Error(`Could not resolve ${url}`)
    url = format(MEDIA_URL_FULL, number ?? 3) + file
  }
  return url
}

async function isAlive(url: string) {
  try {
    const res = await fetchT(url, { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}

async function buildFeed(program: string, forceRefresh: boolean = false) {
  const start = performance.now()

  log('SERVE', program)

  const url = `${BASE}/${program}.json`
  const [data, cache] = await Promise.all([
    fetchT(url).then(r => r.json()),
    readCache(program)
  ])

  let modified = false

  const feed = new Feed({
    title: data.podcast_info.title,
    description: data.podcast_info.description,
    id: BASE + data.podcast_info.weblink,
    link: BASE + data.podcast_info.weblink,
    language: 'it',
    image: BASE + data.podcast_info.image,
    updated: new Date(),
    generator: 'https://github.com/frammenti/raiplaysoundrss',
    feed: `https://api.frammenti.dev/rss/${program}.xml`,
    podcast: true
  })

  const episodes = data.block.cards
  const currentEps = new Set<string>()

  for (const ep of episodes) {
    const id = ep.uniquename
    currentEps.add(id)
    const now = Date.now()

    const cached = cache[id]

    const expired =
      cached && (forceRefresh || now - Number(cached.resolvedAt) > MP3_TTL)

    if (expired) {
      const alive = await isAlive(cached.mp3)

      if (!alive) {
        log('REFRESH', program, ep.title)
        modified = true

        const mp3 = await resolveMp3(ep.downloadable_audio?.url ?? ep.audio.url)

        cache[id] = {
          mp3,
          date: parseDate(ep.track_info.date, ep.create_time),
          resolvedAt: now
        }
      }
    } else if (!cached) {
      log('NEW', program, ep.title)
      modified = true

      const mp3 = await resolveMp3(ep.downloadable_audio?.url ?? ep.audio.url)

      cache[id] = {
        mp3,
        date: parseDate(ep.track_info.date, ep.create_time),
        resolvedAt: now
      }
    }
  }

  // Delete missing episodes from cache
  const missing = Object.keys(cache).filter(id => !currentEps.has(id))

  for (const id of missing) {
    log('DELETE', program, id)
    delete cache[id]
  }

  // Save cache after refresh
  await saveCache(program, cache)

  const items = Object.entries(cache)
    .map(([id, val]) => ({
      id,
      ...val
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  for (const item of items) {
    const ep = episodes.find((e: any) => e.uniquename === item.id)

    feed.addItem({
      title: ep.episode_title ?? ep.title,
      id: item.id,
      link: BASE + ep.weblink,
      description: ep.description,
      date: new Date(item.date),
      enclosure: {
        url: item.mp3,
        type: item.mp3.endsWith('mp3') ? 'audio/mpeg' : 'audio/mp4'
      }
    })
  }

  log('DONE', `${items.length}eps in`, duration(performance.now() - start))
  updateStatus(program, items, modified)
  return feed.rss2()
}

async function buildAll() {
  const entries = await listCache()

  await mapLimit(entries, 5, async program => {
    // Jitter
    await new Promise(r => setTimeout(r, 50 + Math.random() * 150))

    try {
      await buildFeed(program)
    } catch (err) {
      error(program, (err as Error).message)
    }
  })
}
