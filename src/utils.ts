export { log, duration, time, fetchT, format, parseDate, mapLimit }

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

function log(...args: any[]) {
  console.log(time(new Date()).replace(',', ''), ...args)
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

async function mapLimit<T, R>(
  items: Iterable<T>,
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: Promise<R>[] = []
  const executing = new Set<Promise<R>>()

  let index = 0

  for (const item of items) {
    const currentIndex = index++

    const p = Promise.resolve().then(() => fn(item, currentIndex))
    results.push(p)
    executing.add(p)

    const clean = () => executing.delete(p)
    p.then(clean).catch(clean)

    if (executing.size >= limit) {
      await Promise.race(executing)
    }
  }

  return Promise.all(results)
}
