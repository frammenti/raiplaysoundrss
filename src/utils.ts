export {
  duration,
  time,
  fetchT,
  format,
  parseDate,
  parseDuration,
  poolLimit,
  nonNullable,
  jitter
}

import { DateTime } from 'luxon'

const timeFormat = Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  hour12: false,
  timeStyle: 'short',
  timeZone: 'Europe/Rome'
})

function time(d: Date | null) {
  return d ? timeFormat.format(d).replace(',', '') : ''
}

function parseDate(dateStr: string, timeStr: string) {
  const [year, month, day] = dateStr.split('-')
  const [hour, minute] = timeStr.split(':')

  return DateTime.fromObject(
    {
      year: Number(year),
      month: Number(month),
      day: Number(day),
      hour: Number(hour),
      minute: Number(minute)
    },
    { zone: 'Europe/Rome' } // with correct time offset
  ).toJSDate()
}

function parseDuration(duration: string): number {
  const parts = duration.split(':').map(Number)

  if (parts.length === 2) {
    const [minutes, seconds] = parts
    return minutes * 60 + seconds
  }

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts
    return hours * 3600 + minutes * 60 + seconds
  }

  throw new Error(`Invalid duration: ${duration}`)
}

type UnitDisplay = 'short' | 'long' | 'narrow'

// Duration format without Temporal
const rest = (n: number, m: number) => [Math.floor(n / m), n % m]

function createDurationFormatter(
  locale: string,
  unitDisplay: UnitDisplay = 'narrow'
) {
  const TimeUnitFormat = (
      locale: string,
      unit: string,
      unitDisplay: UnitDisplay
    ) =>
      Intl.NumberFormat(locale, {
        style: 'unit',
        unit,
        unitDisplay,
        maximumSignificantDigits: 2
      }).format,
    d = TimeUnitFormat(locale, 'day', unitDisplay),
    h = TimeUnitFormat(locale, 'hour', unitDisplay),
    m = TimeUnitFormat(locale, 'minute', unitDisplay),
    s = TimeUnitFormat(locale, 'second', unitDisplay),
    mil = TimeUnitFormat(locale, 'millisecond', unitDisplay),
    list = new Intl.ListFormat(locale, {
      style: 'long',
      type: 'conjunction'
    })

  return function (milliseconds: number) {
    let days, hours, minutes, seconds
    ;[days, milliseconds] = rest(milliseconds, 864e5)
    ;[hours, milliseconds] = rest(milliseconds, 36e5)
    ;[minutes, milliseconds] = rest(milliseconds, 6e4)
    ;[seconds, milliseconds] = rest(milliseconds, 1e3)
    return list.format(
      [
        days ? d(days) : null,
        hours ? h(hours) : null,
        minutes ? m(minutes) : null,
        seconds ? s(seconds) : null,
        milliseconds && !seconds ? mil(milliseconds) : null
      ].filter(v => v !== null)
    )
  }
}

const duration = createDurationFormatter('en-US')

// Fetch with timeout
async function fetchT(url: string, options = {}, timeout = 8000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    return res
  } finally {
    clearTimeout(id)
  }
}

function format(str: string, ...values: any[]) {
  return str.replace(/{(\d+)}/g, (match, index) => values[index] ?? match)
}

async function poolLimit<T, R>(
  items: Iterable<T>,
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<(R | undefined)[]> {
  const pool = new Set<Promise<R | undefined>>()
  const results: Promise<R | undefined>[] = []

  for (const item of items) {
    // With this pattern an error in the callback is turned into a handled rejected promise
    const p = Promise.resolve()
      .then(() => fn(item))
      .catch(() => undefined)

    results.push(p)
    pool.add(p)

    // The promise removes itself from the pool when resolved
    const clean = () => pool.delete(p)
    p.finally(clean)

    if (pool.size >= limit) {
      await Promise.race(pool)
    }
  }

  return Promise.all(results)
}

function nonNullable<T>(value: T): value is NonNullable<T> {
  return value !== null && value !== undefined
}

async function jitter(factor: number = 1) {
  await new Promise(r =>
    setTimeout(r, 50 * factor + Math.random() * 150 * factor)
  )
}
