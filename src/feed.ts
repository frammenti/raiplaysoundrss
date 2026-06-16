import { Feed } from 'feed'

import { readCache, saveCache, listCache } from './cache.js'
import { logger } from './logger.js'
import { updateStatus, error } from './status.js'
import { NotFoundError, BadGatewayError } from './errors.js'
import { duration, fetchT, format, parseDate, poolLimit } from './utils.js'

export { buildFeed, buildAll }

const BASE = 'https://www.raiplaysound.it'
const MP3_TTL = 1000 * 60 * 60 * 24 * 7 // 1 week

const MEDIA_URL = 'https://creativemedia'
const MEDIA_URL_FULL = 'https://creativemedia{0}-rai-it.akamaized.net/'
const PATTERN = /ostr(?<number>\d+)\/(?<file>.*?mp\d)/

async function getFeedData(url: string, program: string) {
  const res = await fetchT(url)
  switch (res.status) {
    case 200:
      return res.json()
    case 404:
      throw new NotFoundError(`${program} not found in RaiPlay Sound catalog`)
    default:
      throw new BadGatewayError(`Upstream RaiPlay Sound error ${res.status}`)
  }
}

async function isAlive(url: string) {
  try {
    const res = await fetchT(url, { method: 'HEAD' })
    return res.ok
  } catch {
    return false
  }
}

async function resolveMp3(relinker: string) {
  const res = await fetchT(relinker, {
    method: 'HEAD',
    redirect: 'follow'
  })
  let url = res.url

  // Derive the CDN url
  if (!url.startsWith(MEDIA_URL)) {
    const { number, file } = PATTERN.exec(url)?.groups ?? {}
    if (!file) throw new Error(`could not resolve ${url}`)

    url = format(MEDIA_URL_FULL, number ?? 3) + file
  }

  // Try to fetch the mp3 if it exists
  if (url.endsWith('4')) {
    const alt = url.slice(0, -1) + '3'
    if (await isAlive(alt)) url = alt
  }

  return url
}

async function buildFeed(program: string, forceRefresh: boolean = false) {
  const start = performance.now()

  logger.serve(program)

  const url = `${BASE}/${program}.json`
  const [data, cache] = await Promise.all([
    getFeedData(url, program),
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
    feed: `https://rss.frammenti.dev/${program}`,
    podcast: true
  })

  const episodes = data.block.cards
  const currentEps = new Set<string>()

  await poolLimit(episodes, 5, async (ep: any) => {
    const id = ep.uniquename
    const now = Date.now()

    const cached = cache[id]

    try {
      if (!cached) {
        const episodeUrl = ep.downloadable_audio?.url ?? ep.audio?.url

        if (!episodeUrl) throw new Error(`missing url for ${id}`)

        const mp3 = await resolveMp3(episodeUrl)

        logger.new(`${program} ${ep.title}`)
        modified = true

        cache[id] = {
          mp3,
          date: parseDate(ep.track_info.date, ep.create_time),
          resolvedAt: now
        }
      } else if (forceRefresh || now - Number(cached.resolvedAt) > MP3_TTL) {
        const episodeUrl = ep.downloadable_audio?.url ?? ep.audio?.url

        if (!episodeUrl) throw new Error(`missing url for ${id}`)

        const mp3 = await resolveMp3(episodeUrl)

        logger.refresh(`${program} ${ep.title}`)

        if (mp3 !== cached.mp3) modified = true

        cache[id] = {
          mp3,
          date: parseDate(ep.track_info.date, ep.create_time),
          resolvedAt: now
        }
      }
    } catch (err) {
      error(program, (err as Error).message)
    }

    currentEps.add(id)
  })

  // Delete missing episodes from cache
  const entries = Object.keys(cache)

  if (entries.length === 0) logger.warn(`${program} has no episodes`)

  const missing = entries.filter(id => !currentEps.has(id))

  for (const id of missing) {
    logger.delete(`${program} ${id}`)
    delete cache[id]
  }

  // Save cache after refresh
  await saveCache(program, cache)

  const items = Object.entries(cache)
    .map(([id, val]) => ({
      id,
      ...val!
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
        type: item.mp3.endsWith('3') ? 'audio/mpeg' : 'audio/mp4'
      }
    })
  }

  logger.done(
    `${program} ${items.length}eps in ${duration(performance.now() - start)}`
  )
  updateStatus(program, items, modified)
  return feed.rss2()
}

async function buildAll() {
  const start = performance.now()
  const entries = await listCache()
  logger.info(`Updating catalog:\n      ${entries.join('\n      ')}`)

  await poolLimit(entries, 3, async program => {
    // Jitter
    await new Promise(r => setTimeout(r, 50 + Math.random() * 150))

    try {
      await buildFeed(program)
    } catch (err) {
      error(program, (err as Error).message)
    }
  })
  logger.info(`Updated catalog in ${duration(performance.now() - start)}`)
}
