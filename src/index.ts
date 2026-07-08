import Fastify from 'fastify'
import rateLimit from '@fastify/rate-limit'

import { initCache } from './cache.js'
import { initStats, flushStats } from './stats.js'
import { buildAll } from './feed.js'
import routes from './routes.js'
import { logger } from './logger.js'
import type { HttpError } from './errors.js'
import { Status } from './status.js'

const fastify = Fastify({
  loggerInstance: logger,
  disableRequestLogging: true,
  connectionTimeout: 600_000, // 10 minutes
  keepAliveTimeout: 5_000,
  requestTimeout: 10_000
})

fastify.setErrorHandler(function (error: Error | HttpError, _req, reply) {
  const statusCode = 'statusCode' in error ? error.statusCode : 500
  if (statusCode >= 500) {
    logger.error(error.message)
  } else if (statusCode >= 400) {
    logger.info(error.message)
  } else {
    logger.error(error.message)
  }
  // Send error response
  reply.status(statusCode).send(error)
})

fastify.log.info('What a beautiful day to be alive')

const PORT: number = Number(process.env.PORT || 3000)
const HOST: string = process.env.HOST || '127.0.0.1'
const status = new Status()

await fastify.register(rateLimit, {
  max: 30,
  timeWindow: '1 minute'
})

await initCache()
await initStats()

buildAll(status)

// Register the same routes with no prefix, rss and m3u prefix
await fastify.register(routes, {
  prefix: '/rss',
  status
})
await fastify.register(routes, {
  prefix: '/m3u',
  status
})
await fastify.register(routes, { prefix: '', status })

await fastify.listen({
  port: PORT,
  host: HOST
})

const shutdown = async () => {
  try {
    await fastify.close()
    await flushStats()
  } catch (err) {
    logger.error(`shutdown ${(err as Error).message}`)
  } finally {
    process.exit(0)
  }
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
