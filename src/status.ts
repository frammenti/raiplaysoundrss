export { status, updateStatus, getModifiedStatus, error }

import { logger } from './logger.js'
import type { Status } from './types.js'

const status: Status = {
  lastBuild: null,
  errors: 0,
  programs: {}
}

function updateStatus(program: string, items: any[], modified: boolean) {
  const now = new Date()
  status.lastBuild = now

  status.programs[program] = {
    items: items.length,
    lastBuild: now,
    lastModified: modified
      ? now
      : (status.programs[program]?.lastModified ?? now),
    errors: 0
  }
}

function getModifiedStatus(program: string) {
  return status.programs[program].lastModified
}

function error(program: string, message: string) {
  logger.error(`${program} ${message}`)
  if (!(program in status.programs)) {
    const now = new Date()
    status.programs[program] = {
      items: 0,
      lastBuild: now,
      lastModified: now,
      errors: 0
    }
  }
  status.errors++
  status.programs[program].errors++
}
