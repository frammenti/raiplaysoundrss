import { logger } from './logger.js'

export { Status }

class ProgramStatus {
  items = 0
  lastBuild: Date | null = null
  lastModified: Date | null = null
  errors = 0

  update(items: number, modified: boolean, time: Date = new Date()) {
    this.items = items
    this.lastBuild = time
    if (modified) this.lastModified = time
  }

  error() {
    this.errors++
  }
}

class Status {
  private readonly programs: Record<string, ProgramStatus> = {}

  start = Date.now()
  served = 0
  lastBuild: Date | null = null
  errors = 0

  private getProgram(program: string): ProgramStatus {
    return (this.programs[program] ??= new ProgramStatus())
  }

  update(program: string, items: number, modified: boolean) {
    const now = new Date()

    this.lastBuild = now
    this.getProgram(program).update(items, modified, now)
  }

  error(program: string, message: string) {
    logger.error(`${program} ${message}`)

    this.errors++
    this.getProgram(program).error()
  }

  getModifiedStatus(program: string): Date {
    return this.getProgram(program).lastModified ?? new Date(0)
  }

  listPrograms(): [string, ProgramStatus][] {
    return Object.entries(this.programs)
  }
}
