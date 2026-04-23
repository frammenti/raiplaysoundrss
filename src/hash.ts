import crypto from 'crypto'
import type { FastifyRequest } from 'fastify'

export { checkHash }

function generateETag(content: string) {
  return crypto.createHash('sha1').update(content).digest('hex')
}

function checkHash(xml: string, req: FastifyRequest, lastModified: Date) {
  let modified = true
  const etag = generateETag(xml)

  const ifNoneMatch = req.headers['if-none-match']
  const ifModifiedSince = req.headers['if-modified-since']

  // ETag check
  if (ifNoneMatch === etag) {
    modified = false
  } else if (ifModifiedSince) {
    const since = new Date(ifModifiedSince)
    if (since >= lastModified) {
      modified = false
    }
  }

  return { modified, etag }
}
