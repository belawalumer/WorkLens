const PKT = 'Asia/Karachi'
const pktFmt = new Intl.DateTimeFormat('en-CA', { timeZone: PKT })

/** Current date in PKT timezone as YYYY-MM-DD */
export const getPKTDate = (d = new Date()): string => pktFmt.format(d)

/** YYYY-MM-DD offset by N days from today in PKT */
export const getPKTDateOffset = (days: number): string =>
  getPKTDate(new Date(Date.now() + days * 86_400_000))

/** Monday of the current PKT week as YYYY-MM-DD */
export function getPKTWeekStart(): string {
  const today = getPKTDate()
  const [y, m, d] = today.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  const dow = date.getUTCDay()
  date.setUTCDate(date.getUTCDate() - (dow === 0 ? 6 : dow - 1))
  return getPKTDate(date)
}
