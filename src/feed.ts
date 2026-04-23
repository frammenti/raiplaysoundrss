import { Feed } from 'feed'

import { cache, saveCache } from './cache.js'
import { updateStatus } from './status.js'
import { log, duration, parseDate, fetchT, format } from './utils.js'

export { buildFeed }

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

async function buildFeed(program: string) {
  const start = performance.now()

  log('SERVE', program)

  const url = `${BASE}/${program}.json`
  const data = await fetchT(url).then(r => r.json())
  let modified = false

  const feed = new Feed({
    title: data.podcast_info.title,
    description: data.podcast_info.description,
    id: BASE + data.podcast_info.weblink,
    link: BASE + data.podcast_info.weblink,
    language: 'it',
    image: BASE + data.podcast_info.image,
    updated: new Date()
  })

  if (!cache[program]) cache[program] = {}

  const episodes = data.block.cards

  for (const ep of episodes) {
    const id = ep.uniquename
    const now = Date.now()

    const cached = cache[program][id]

    const expired = cached && now - Number(cached.resolvedAt) > MP3_TTL

    if (expired) {
      const alive = await isAlive(cached.mp3)

      if (!alive) {
        log('REFRESH', program, ep.title)
        modified = true

        const mp3 = await resolveMp3(ep.downloadable_audio?.url ?? ep.audio.url)

        cache[program][id] = {
          ...cached,
          mp3,
          resolvedAt: now
        }
      }
    } else if (!cached) {
      log('NEW', program, ep.title)
      modified = true

      const mp3 = await resolveMp3(ep.downloadable_audio?.url ?? ep.audio.url)

      cache[program][id] = {
        mp3,
        date: parseDate(ep.create_date, ep.create_time),
        resolvedAt: now
      }
    }
  }

  // Save cache after refresh
  await saveCache()

  const items = Object.entries(cache[program])
    .map(([id, val]) => ({
      id,
      ...val
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  for (const item of items) {
    const ep = episodes.find((e: any) => e.uniquename === item.id)

    feed.addItem({
      title: ep.title,
      id: item.id,
      link: BASE + ep.weblink,
      description: ep.description,
      date: new Date(item.date),
      enclosure: {
        url: item.mp3,
        type: 'audio/mpeg'
      }
    })
  }

  log('DONE', `${items.length}eps in`, duration(performance.now() - start))
  updateStatus(program, items, modified)
  return feed.rss2()
}
