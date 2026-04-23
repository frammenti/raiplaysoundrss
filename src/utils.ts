export { log, duration, parseDate, fetchT }

type UnitDisplay = 'short' | 'long' | 'narrow'

function log(...args: any[]) {
  console.log(new Date().toISOString(), ...args)
}

function parseDate(dateStr: string, timeStr: string) {
  const [d, m, y] = dateStr.split('-')
  return new Date(`${y}-${m}-${d}T${timeStr}:00Z`)
}

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

let duration = createDurationFormatter('en-US')

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
