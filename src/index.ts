import Fastify from 'fastify'
import rateLimit from '@fastify/rate-limit'

import { buildFeed, buildAll } from './feed.js'
import { initCache } from './cache.js'
import { status, error, getModifiedStatus } from './status.js'
import { checkHash } from './hash.js'
import {
  initStats,
  updateStats,
  flushStats,
  getStats,
  countStats,
  today
} from './stats.js'
import { duration, time } from './utils.js'

const fastify = Fastify({
  connectionTimeout: 600_000, // 10 minutes
  keepAliveTimeout: 5_000,
  requestTimeout: 10_000
})

const PORT: number = Number(process.env.PORT || 3000)
const HOST: string = process.env.HOST || '127.0.0.1'
const start = Date.now()
let served = 0

await fastify.register(rateLimit, {
  max: 30,
  timeWindow: '1 minute'
})

await initCache()
await initStats()
buildAll()

fastify.get<{ Params: { type: string; name: string } }>(
  '/rss/:type/:name.xml',
  async (req, reply) => {
    const program = `${req.params.type}/${req.params.name}`
    const xml = await buildFeed(program)

    updateStats(program)

    const lastModified = getModifiedStatus(program)

    const { modified, etag } = checkHash(xml, req, lastModified)

    if (!modified) return reply.code(304).send()

    reply
      .header('Content-Type', 'application/xml; charset=utf-8')
      .header('Cache-Control', 'public, max-age=300') // 5 min
      .header('ETag', etag)
      .header('Last-Modified', lastModified.toUTCString())
      .send(xml)
    served++
  }
)

fastify.get<{ Params: { type: string; name: string } }>(
  '/rss/refresh/:type/:name',
  async (req, reply) => {
    const program = `${req.params.type}/${req.params.name}`
    await buildFeed(program, true).catch(message => error(program, message))

    reply.code(200).send(`Manually refreshed ${program}!`)
  }
)

fastify.get('/rss/health', async () => {
  return {
    status: 'ok',
    runningFor: duration(Date.now() - start),
    served,
    lastBuild: time(status.lastBuild),
    errors: status.errors,
    programs: Object.entries(status.programs).map(([k, v]) => [
      k,
      {
        ...v,
        lastBuild: time(v.lastBuild),
        lastModified: time(v.lastModified)
      }
    ])
  }
})

fastify.get<{ Querystring: { from?: string; to?: string } }>(
  '/rss/stats',
  async (req, reply) => {
    const { from, to } = req.query

    for (const date of [from, to]) {
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return reply
          .code(400)
          .send({ error: `Invalid date '${date}', expected YYYY-MM-DD` })
      }
    }

    const programs = await getStats(from, to)

    return {
      from: from ?? '2026-06-10', // stats collection start date
      to: to ?? today(),
      total: countStats(programs),
      programs
    }
  }
)

await fastify.listen({
  port: PORT,
  host: HOST
})

const shutdown = async () => {
  try {
    await fastify.close()
    await flushStats()
  } catch (err) {
    console.error(err)
  } finally {
    process.exit(0)
  }
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
