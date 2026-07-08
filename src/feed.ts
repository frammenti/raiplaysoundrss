import { FeedSerializer } from './serializer.js'
import { readCache, saveCache, listCache } from './cache.js'
import { logger } from './logger.js'
import { NotFoundError, BadGatewayError } from './errors.js'
import {
  duration,
  fetchT,
  format,
  jitter,
  parseDate,
  parseDuration,
  poolLimit
} from './utils.js'

import type { ProgramItem, PlaylistItem, EpisodeItem } from './types.js'
import type { Status } from './status.js'

export { buildProgram, buildAll }

const BASE = 'https://www.raiplaysound.it'
const MP3_TTL = 1000 * 60 * 60 * 24 * 7 // 1 week

const MEDIA_URL = 'https://creativemedia'
const MEDIA_URL_FULL = 'https://creativemedia{0}-rai-it.akamaized.net/'
const PATTERN = /ostr(?<number>\d+)\/(?<file>.*?mp\d)/

async function getFeedData(url: string, program: string): Promise<ProgramItem> {
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

async function expandContainer(items: PlaylistItem[]): Promise<EpisodeItem[]> {
  // We do not make concurrent network calls here otherwise we get rate limited
  const result: EpisodeItem[] = []
  for (const item of items) {
    const playlist = await getFeedData(BASE + item.path_id, item.title)
    if (playlist.block.content_type !== 'playlist')
      result.push(...playlist.block.cards)
  }
  return result
}

async function buildProgram(
  program: string,
  status: Status,
  forceRefresh: boolean = false
): Promise<FeedSerializer> {
  const start = performance.now()

  logger.serve(program)

  const url = `${BASE}/${program}.json`
  const [data, cache] = await Promise.all([
    getFeedData(url, program),
    readCache(program)
  ])

  let modified = false

  const feed = new FeedSerializer({
    program,
    title: data.podcast_info.title,
    description: data.podcast_info.description,
    webpage: BASE + data.podcast_info.weblink,
    language: 'it',
    image: BASE + data.podcast_info.image,
    updated: new Date()
  })

  const episodes = new Map(
    (data.block.content_type === 'playlist'
      ? await expandContainer(data.block.cards)
      : data.block.cards
    ).map(ep => [ep.uniquename, ep])
  )

  const currentEps = new Set<string>()

  await poolLimit(episodes.values(), 15, async ep => {
    const id = ep.uniquename
    const now = Date.now()

    const cached = cache.get(id)

    const missing = !cached
    const expired = cached && now - cached.resolvedAt > MP3_TTL
    const shouldRefresh = missing || expired || forceRefresh

    try {
      if (shouldRefresh) {
        const episodeUrl = ep.downloadable_audio?.url ?? ep.audio?.url
        if (!episodeUrl) throw new Error(`missing url for ${id}`)

        await jitter(2.5)

        const mp3 = await resolveMp3(episodeUrl)
        const episodeString = `${program} ${ep.title}`

        if (missing) {
          logger.new(episodeString)
          modified = true
        } else {
          logger.refresh(episodeString)
          if (mp3 !== cached.mp3) modified = true
        }

        const date = parseDate(ep.track_info.date, ep.create_time)

        // Playlist episodes often share the same/random-but-close publication timestamps.
        // We convert the episode number into +10 min so sorting remains stable.
        // For non-playlists episode_number is 0
        const n = Number(ep.track_info.episode_number)
        if (Number.isFinite(n)) date.setMilliseconds(n * 60_000 * 10)

        cache.set(id, {
          mp3,
          date,
          resolvedAt: now
        })
      }
      // Episode is not listed if an error occurred
      currentEps.add(id)
    } catch (err) {
      status.error(program, (err as Error).message)
    }
  })

  // Delete missing episodes from cache
  if (cache.size === 0) {
    logger.warn(`${program} has no episodes`)
  }

  for (const id of cache.keys()) {
    if (!currentEps.has(id)) {
      logger.delete(`${program} ${id}`)
      modified = true
      cache.delete(id)
    }
  }

  // Save cache after refresh
  await saveCache(program, cache)

  const items = [...cache.entries()]
    .map(([id, ep]) => ({
      id,
      ...ep
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime())

  cache.clear()

  for (const item of items) {
    const ep = episodes.get(item.id)

    // Fail loudly in case of cache mismatch
    if (!ep) throw new Error(`${program} episode ${item.id} not in cache`)

    feed.add({
      id: item.id,
      title: ep.episode_title ?? ep.title,
      description: ep.description,
      webpage: BASE + ep.weblink,
      published: new Date(item.date),
      audio: item.mp3,
      mime: item.mp3.endsWith('3') ? 'audio/mpeg' : 'audio/mp4',
      duration: ep.audio.duration ? parseDuration(ep.audio.duration) : undefined
    })
  }

  logger.done(
    `${program} ${items.length}eps in ${duration(performance.now() - start)}`
  )
  status.update(program, items.length, modified)
  return feed
}

async function buildAll(status: Status) {
  const start = performance.now()
  const entries = await listCache()
  logger.info(`Updating catalog:\n      ${entries.join('\n      ')}`)

  // We do not build programs in parallel otherwise we get rate limited
  for (const program of entries) {
    try {
      await buildProgram(program, status)
    } catch (err) {
      status.error(program, (err as Error).message)
    }
  }

  logger.info(`Updated catalog in ${duration(performance.now() - start)}`)
}
