/**
 * Translate a risk-segment value (stored in French in the DB) to its English
 * display label. Pass-through for values that are already English.
 *   Élevé → High · Moyen → Medium · Faible → Low
 */
const _RISK_EN = {
  'Élevé': 'High', High: 'High', high: 'High',
  Moyen: 'Medium', Medium: 'Medium', medium: 'Medium',
  Faible: 'Low', Low: 'Low', low: 'Low',
}
export function riskLabel(seg) {
  if (seg == null || seg === '') return '—'
  return _RISK_EN[seg] ?? seg
}

/**
 * Convert a decimal-year tenure value to a human-readable duration string.
 *
 * Examples:
 *   6.07    → compact: "6 yrs 25 days"   short: "6y 25d"   long: "6 yrs 25 days"
 *   2.05546 → compact: "2 yrs 21 days"   short: "2y 21d"   long: "2 yrs 21 days"
 *   2.5     → compact: "2 yrs 6 mo"      short: "2y 6m 3d" long: "2 yrs 6 mo 3 days"
 *   0.25    → compact: "3 mo 4 days"     short: "3m 4d"    long: "3 mo 4 days"
 *
 * @param {number|string|null} years  Decimal years
 * @param {'compact'|'short'|'long'} mode
 *   - compact : yrs + mo only (no days) — good for KPI cards / averages
 *   - short   : abbreviated with days   — good for compact table cells
 *   - long    : full words with days    — good for profile modals
 */
export function formatTenure(years, mode = 'long') {
  const val = parseFloat(years)
  if (years == null || isNaN(val) || val < 0) return '—'

  const totalDays = Math.round(val * 365.25)
  if (totalDays === 0) return mode === 'short' ? '< 1d' : '< 1 day'

  const y = Math.floor(totalDays / 365)
  const rem   = totalDays - y * 365
  const m = Math.floor(rem / 30)
  const d = rem - m * 30

  if (mode === 'compact') {
    // Show years + months only (skip days — fine for averages)
    const parts = []
    if (y > 0) parts.push(`${y} yr${y !== 1 ? 's' : ''}`)
    if (m > 0) parts.push(`${m} mo`)
    if (parts.length === 0) parts.push(`${d} day${d !== 1 ? 's' : ''}`)
    return parts.join(' ')
  }

  if (mode === 'short') {
    // Abbreviated, with days (for compact table cells)
    const parts = []
    if (y > 0) parts.push(`${y}y`)
    if (m > 0) parts.push(`${m}m`)
    if (d > 0 || parts.length === 0) parts.push(`${d}d`)
    return parts.join(' ')
  }

  // 'long' mode — full words, include days
  const parts = []
  if (y > 0) parts.push(`${y} yr${y !== 1 ? 's' : ''}`)
  if (m > 0) parts.push(`${m} mo`)
  if (d > 0 || parts.length === 0) parts.push(`${d} day${d !== 1 ? 's' : ''}`)
  return parts.join(' ')
}

/**
 * Format a monetary amount with a currency suffix.
 *
 * @param {number|string|null} value
 * @param {string}  currency  Currency code suffix (default 'TND')
 * @param {object}  opts
 *   - compact {boolean} : abbreviate large values (1.2M TND, 850K TND)
 *
 * Examples:
 *   formatCurrency(1250000)              → "1,250,000 TND"
 *   formatCurrency(1250000, 'TND', {compact:true}) → "1.3M TND"
 *   formatCurrency(null)                 → "—"
 */
export function formatCurrency(value, currency = 'TND', { compact = false } = {}) {
  const n = Number(value)
  if (value == null || isNaN(n)) return '—'

  if (compact && Math.abs(n) >= 1000) {
    const units = [[1e9, 'B'], [1e6, 'M'], [1e3, 'K']]
    for (const [div, suffix] of units) {
      if (Math.abs(n) >= div) {
        const num = (n / div).toFixed(1).replace(/\.0$/, '')
        return `${num}${suffix} ${currency}`
      }
    }
  }
  return `${Math.round(n).toLocaleString()} ${currency}`
}
