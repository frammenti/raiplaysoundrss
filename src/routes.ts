import type { FastifyPluginAsync } from 'fastify'

import { buildProgram } from './feed.js'
import { checkHash } from './hash.js'
import { updateStats, getStats, countStats, today, yesterday } from './stats.js'
import { duration, time } from './utils.js'
import type { ProgramType } from './types.js'
import type { Status } from './status.js'

const schema = {
  params: {
    type: 'object',
    properties: {
      type: {
        type: 'string',
        enum: ['programmi', 'audiolibri', 'playlist']
      },
      name: { type: 'string' }
    },
    required: ['type', 'name']
  }
}

const routes: FastifyPluginAsync<{
  prefix: string
  status: Status
}> = async (fastify, { prefix, status }) => {
  fastify.get<{
    Params: { type: ProgramType; name: string }
  }>(`/:type/:name`, { schema }, async (req, reply) => {
    const program = `${req.params.type}/${req.params.name.replace(/\.xml$/, '')}`
    const feed = await buildProgram(program)
    const { body, mime } = feed.serialize(prefix === '/m3u' ? 'm3u' : 'rss')

    updateStats(program)

      const lastModified = status.getModifiedStatus(program)
      const { modified, etag } = checkHash(body, req, lastModified)

    if (!modified) return reply.code(304).send()

      reply
        .header('Content-Type', `${mime}; charset=utf-8`)
        .header('Cache-Control', 'public, max-age=300') // 5 min
        .header('ETag', etag)
        .header('Last-Modified', lastModified.toUTCString())
        .send(body)
      status.served++
    }
  )

  fastify.get<{ Params: { type: ProgramType; name: string } }>(
    '/refresh/:type/:name',
    { schema },
    async (req, reply) => {
      const program = `${req.params.type}/${req.params.name}`
      await buildProgram(program, status, true).catch(err =>
        status.error(program, (err as Error).message)
      )

      reply.code(200).send(`Manually refreshed ${program}!`)
    }
  )

  fastify.get('/health', async () => {
    return {
      status: 'ok',
      runningFor: duration(Date.now() - status.start),
      served: status.served,
      lastBuild: time(status.lastBuild),
      errors: status.errors,
      programs: status.listPrograms().map(([k, v]) => [
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
    '/stats',
    async (req, _reply) => {
      const { from, to } = req.query

      for (const date of [from, to]) {
        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))
          throw new ValidationError(
            `Invalid date '${date}', expected YYYY-MM-DD`
          )
      }

      const programs = await getStats(from, to)

      return {
        from: from ?? '2026-06-10', // beginning of stats collection
        to: to ?? today(),
        total: countStats(programs),
        programs
      }
    }
  )
}

export default routes
