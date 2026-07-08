import fs from 'fs/promises'
import { DateTime } from 'luxon'
import { logger } from './logger.js'
import { poolLimit } from './utils.js'
import type { Stats } from './types.js'

export {
  initStats,
  updateStats,
  flushStats,
  getStats,
  countStats,
  today,
  yesterday
}

const STATS_DIR = './stats'
const BATCH_SIZE = 20

const today = () => DateTime.now().setZone('Europe/Rome').toISODate()!
const yesterday = () =>
  DateTime.now().minus({ days: 1 }).setZone('Europe/Rome').toISODate()!

let totalStats: Stats = {}
let dailyStats: Stats = {}
let currentDay = today()
let dirty = false

async function saveStats(day: string, stats: Stats) {
  const snapshot = { ...stats }
  const statsFile = `${STATS_DIR}/${day}.json`

  try {
    // Atomic rename, so a crash mid-write cannot truncate the file
    await fs.writeFile(`${statsFile}.tmp`, JSON.stringify(snapshot, null, 2))
    await fs.rename(`${statsFile}.tmp`, statsFile)
  } catch (err) {
    logger.error(`stats ${(err as Error).message}`)
  }
}

// Can be called either synchronously or asynchronously
// Can run in sync because if the write happens it is never on the same day
async function syncDay() {
  const day = today()
  if (currentDay !== day) {
    // Final flush of the ended day
    await saveStats(currentDay, dailyStats)
    currentDay = day
    dailyStats = {}
    dirty = false
  }
}

async function flushStats() {
  await syncDay()
  if (!dirty) return
  dirty = false
  await saveStats(currentDay, dailyStats)
}

async function readStats(day: string): Promise<Stats> {
  try {
    return JSON.parse(await fs.readFile(`${STATS_DIR}/${day}.json`, 'utf-8'))
  } catch {
    return {}
  }
}

async function listStats() {
  return (await fs.readdir(STATS_DIR))
    .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map(f => f.slice(0, -5))
}

async function initStats() {
  await fs.mkdir(STATS_DIR, { recursive: true })

  // Populate daily stats if file is present
  dailyStats = await readStats(currentDay)

  // Rebuild total from daily files as the source of truth
  const days = await listStats()
  // Process batches of json files
  await poolLimit(days, BATCH_SIZE, async day => {
    const stats = await readStats(day)
    for (const [program, count] of Object.entries(stats)) {
      totalStats[program] = (totalStats[program] ?? 0) + (count ?? 0)
    }
  })

  const timer = setInterval(flushStats, 60_000) // 1 min
  timer.unref()
}

function updateStats(program: string) {
  syncDay()
  totalStats[program] = (totalStats[program] ?? 0) + 1
  dailyStats[program] = (dailyStats[program] ?? 0) + 1
  dirty = true
}

function sortStats(stats: Stats) {
  return Object.fromEntries(Object.entries(stats).sort((a, b) => b[1] - a[1]))
}

async function getStats(
  from?: string,
  to: string = currentDay
): Promise<Stats> {
  syncDay()

  if (!from && to >= currentDay) return sortStats(totalStats)

  const laterThanFrom = from
    ? (day: string) => day >= from
    : (_day: string) => true

  const soonerThanTo =
    to >= currentDay
      ? (day: string) => day < currentDay
      : (day: string) => day <= to

  const dayFilter = (day: string) => laterThanFrom(day) && soonerThanTo(day)

  const days = (await listStats()).filter(dayFilter)

  const result: Stats = to >= currentDay ? { ...dailyStats } : {}

  await poolLimit(days, BATCH_SIZE, async day => {
    const stats = await readStats(day)
    for (const [program, count] of Object.entries(stats)) {
      result[program] = (result[program] ?? 0) + (count ?? 0)
    }
  })

  return sortStats(result)
}

function countStats(stats: Stats) {
  return Object.values(stats).reduce<number>((sum, n) => sum + (n ?? 0), 0)
}
