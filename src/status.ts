export { status, updateStatus, getModifiedStatus, error }

interface Program {
  items: number
  lastRefresh: Date
  lastModified: Date
  errors: number
}

interface Status {
  lastBuild: Date | null
  programs: Record<string, Program>
}

const status: Status = {
  lastBuild: null,
  programs: {}
}

function updateStatus(program: string, items: any[], modified: boolean) {
  const now = new Date()
  status.lastBuild = now

  status.programs[program] = {
    items: items.length,
    lastRefresh: now,
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
  status.programs[program].errors++
  console.error(message)
}
