import Fastify from 'fastify'
import rateLimit from '@fastify/rate-limit'

import { buildFeed } from './feed.js'
import { cache, loadCache } from './cache.js'
import { status, error, getModifiedStatus } from './status.js'
import { checkHash } from './hash.js'
import { duration } from './utils.js'

const fastify = Fastify({
  connectionTimeout: 10_000, // 10s
  keepAliveTimeout: 5_000,
  requestTimeout: 10_000
})

const PORT: number = Number(process.env.PORT || 3000)
const start = Date.now()
let served = 0

await fastify.register(rateLimit, {
  max: 30,
  timeWindow: '1 minute'
})

await loadCache()

fastify.get<{ Params: { program: string } }>(
  '/rss/:program.xml',
  async (req, reply) => {
    const xml = await buildFeed(req.params.program)

    const lastModified = getModifiedStatus(req.params.program)

    const { modified, etag } = checkHash(xml, req, lastModified)

    if (!modified) return reply.code(304).send()

    reply
      .header('Content-Type', 'application/rss+xml')
      .header('Cache-Control', 'public, max-age=300') // 5 min
      .header('ETag', etag)
      .header('Last-Modified', lastModified.toUTCString())
      .send(xml)
    served++
  }
)

fastify.get('/health', async () => {
  return {
    status: 'ok',
    runningFor: duration(Date.now() - start),
    served,
    lastBuild: status.lastBuild,
    programs: status.programs
  }
})

await fastify.listen({
  port: PORT,
  host: '127.0.0.1'
})

setInterval(
  () => {
    Object.keys(cache).forEach(program => {
      buildFeed(program).catch(message => error(program, message))
    })
  },
  1000 * 60 * 60
)
