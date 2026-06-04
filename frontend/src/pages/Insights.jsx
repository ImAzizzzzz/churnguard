import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { formatTenure, riskLabel } from '../utils/format'
import { useTheme } from '../hooks/useTheme'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import EmptyState from '../components/EmptyState'
import ChartCard from '../components/ChartCard'
import { usePermissions } from '../hooks/usePermissions'
import { toast } from '../store/uiStore'
import { exportElementToPDF } from '../utils/pdf'

/* ── KYC risk classification (bank data dictionary) ── */
const KYC_LABELS = {
  LR: 'Low Risk', MR: 'Medium Risk',
  H1: 'High Risk – Tier 1', H2: 'High Risk – Tier 2', H3: 'High Risk – Tier 3',
}
const KYC_COLORS = {
  LR: '#22c55e', MR: '#f59e0b', H1: '#f87171', H2: '#ef4444', H3: '#b91c1c',
}
const KYC_DATA = [
  { code: 'LR', name: 'Low Risk',                          type: 'Low'    },
  { code: 'MR', name: 'Medium Risk',                       type: 'Medium' },
  { code: 'H1', name: 'High Risk – Tier 1 (least severe)', type: 'High'   },
  { code: 'H2', name: 'High Risk – Tier 2',                type: 'High'   },
  { code: 'H3', name: 'High Risk – Tier 3 (most severe)',  type: 'High'   },
]
const KYC_TYPE_COLOR = { Low: '#22c55e', Medium: '#f59e0b', High: '#ef4444' }

function KycRef() {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-3 border-t border-gray-100 dark:border-gray-700 pt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 transition-colors">
        <span className="text-[10px]">{open ? '▴' : '▾'}</span>
        Show classification reference
      </button>
      {open && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-gray-500 dark:text-gray-500">
                <th className="text-left py-1 pr-3 font-semibold">Code</th>
                <th className="text-left py-1 pr-3 font-semibold">Description</th>
                <th className="text-left py-1 font-semibold">Level</th>
              </tr>
            </thead>
            <tbody>
              {KYC_DATA.map(({ code, name, type }) => (
                <tr key={code} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="py-1 pr-3 font-mono font-semibold text-gray-700 dark:text-gray-300">{code}</td>
                  <td className="py-1 pr-3 text-gray-600 dark:text-gray-400">{name}</td>
                  <td className="py-1">
                    <span className="inline-block px-2 py-0.5 rounded-full text-white text-[10px] font-medium"
                          style={{ background: KYC_TYPE_COLOR[type] || '#94a3b8' }}>
                      {type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
const MARITAL_LABEL = {
  C: 'Single', M: 'Married', D: 'Divorced',
  V: 'Widowed', S: 'Separated',
}
const maritalLabel = (code) => MARITAL_LABEL[String(code).toUpperCase()] ?? code

/* ── Party class reference data ───────────────────────── */
const PARTY_CLASS_DATA = [
  { code: 'PPH',      fr: 'Individual',              type: 'Individual'   },
  { code: 'TRPP',     fr: 'Third-party Individual',  type: 'Individual'   },
  { code: 'PRO',      fr: 'Professional',            type: 'Legal entity' },
  { code: 'PM',       fr: 'Legal Entity',            type: 'Legal entity' },
  { code: 'TRPM',     fr: 'Third-party Legal Entity', type: 'Legal entity' },
  { code: 'CB',       fr: 'Bank Account',            type: 'Special case' },
  { code: 'TIERS',    fr: 'Third-party Account',     type: 'Special case' },
  { code: 'PROSPECT', fr: 'Prospect',                type: 'Special case' },
  { code: 'TRBQ',     fr: 'Very High Quality',       type: 'Special case' },
]
const PARTY_TYPE_COLOR = {
  'Individual':   '#3b82f6',
  'Legal entity': '#8b5cf6',
  'Special case': '#f59e0b',
}

function PartyClassRef() {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-3 border-t border-gray-100 dark:border-gray-700 pt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1 transition-colors">
        <span className="text-[10px]">{open ? '▴' : '▾'}</span>
        Show classification reference
      </button>
      {open && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="text-gray-500 dark:text-gray-500">
                <th className="text-left py-1 pr-3 font-semibold">Code</th>
                <th className="text-left py-1 pr-3 font-semibold">Description</th>
                <th className="text-left py-1 font-semibold">Classification</th>
              </tr>
            </thead>
            <tbody>
              {PARTY_CLASS_DATA.map(({ code, fr, type }) => (
                <tr key={code} className="border-t border-gray-100 dark:border-gray-700">
                  <td className="py-1 pr-3 font-mono font-semibold text-gray-700 dark:text-gray-300">{code}</td>
                  <td className="py-1 pr-3 text-gray-600 dark:text-gray-400">{fr}</td>
                  <td className="py-1">
                    <span className="inline-block px-2 py-0.5 rounded-full text-white text-[10px] font-medium"
                          style={{ background: PARTY_TYPE_COLOR[type] || '#94a3b8' }}>
                      {type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ── Table skeleton rows ─────────────────────────────── */
function ExplorerSkeleton() {
  return [...Array(5)].map((_, i) => (
    <tr key={i} className="border-b border-gray-50 dark:border-gray-800/60">
      <td className="px-4 py-3"><div className="shimmer h-4 w-20 rounded-md" /></td>
      <td className="px-4 py-3"><div className="shimmer h-4 w-24 rounded-md" /></td>
      <td className="px-4 py-3"><div className="shimmer h-4 w-10 rounded-md" /></td>
      <td className="px-4 py-3"><div className="shimmer h-4 w-12 rounded-md" /></td>
      <td className="px-4 py-3"><div className="shimmer h-4 w-20 rounded-md" /></td>
      <td className="px-4 py-3"><div className="shimmer h-5 w-16 rounded-full" /></td>
      <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="shimmer h-1.5 w-16 rounded-full" /><div className="shimmer h-4 w-8 rounded-md" /></div></td>
      <td className="px-4 py-3"><div className="shimmer h-7 w-14 rounded-lg" /></td>
    </tr>
  ))
}

/* ── Customer Explorer ──────────────────────────────── */
function CustomerExplorer() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [riskFilter, setRiskFilter] = useState('')
  const [page, setPage] = useState(1)
  const [customers, setCustomers] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef(null)
  const PAGE_SIZE = 10

  const openCustomer = (c) => {
    if (!c?.customer_no) return
    // Pass the row's account so the profile shows this exact account's churn % —
    // a customer can hold several accounts with different predictions.
    const acct = c.account_no != null ? `?account=${encodeURIComponent(c.account_no)}` : ''
    navigate(`/customers/${encodeURIComponent(c.customer_no)}${acct}`)
  }

  const fetchCustomers = useCallback(async (q, risk, pg) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: pg - 1, page_size: PAGE_SIZE })
      if (q) params.append('q', q)
      if (risk) params.append('risk_filter', risk)
      const { data } = await api.get(`/customers/search?${params}`)
      setCustomers(data.customers || data.data || data.items || [])
      setTotal(data.total || 0)
    } catch {
      setCustomers([])
      setTotal(0)
    } finally { setLoading(false) }
  }, [])

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      fetchCustomers(query, riskFilter, 1)
    }, 300)
    return () => clearTimeout(debounceRef.current)
  }, [query, riskFilter, fetchCustomers])

  const changePage = (dir) => {
    const next = page + dir
    setPage(next)
    fetchCustomers(query, riskFilter, next)
  }

  const pages = Math.ceil(total / PAGE_SIZE)

  const RISK_COLOR = {
    'Élevé': '#ef4444', High: '#ef4444', high: '#ef4444',
    Moyen: '#f59e0b', Medium: '#f59e0b', medium: '#f59e0b',
    Faible: '#22c55e', Low: '#22c55e', low: '#22c55e',
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Customer Explorer</p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">Search and browse individual customer risk profiles</p>
      </div>

      {/* Search + filter bar (sticky) */}
      <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-gray-50/90 dark:bg-gray-950/90 backdrop-blur-sm rounded-xl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-600"
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by customer no, account no, nationality, segment…"
            className="input-field pl-9 h-9"
          />
          {query && (
            <button onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>

        <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)}
          className="px-3 py-2 h-9 text-sm rounded-xl cursor-pointer appearance-none
                     bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800
                     text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all">
          <option value="">All risk levels</option>
          <option value="Élevé">High</option>
          <option value="Moyen">Medium</option>
          <option value="Faible">Low</option>
        </select>

        <span className="text-xs text-gray-400 dark:text-gray-600 ml-auto tabular-nums">
          {total.toLocaleString()} result{total !== 1 ? 's' : ''}
        </span>
      </div>

      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-gray-400 dark:text-gray-600 text-[11px] uppercase tracking-wide border-b border-gray-100 dark:border-gray-800">
                {['Customer', 'Account', 'Age', 'Tenure', 'Balance', 'Risk', 'Churn risk', ''].map((h, idx) => (
                  <th key={idx} className="text-left font-semibold py-2.5 px-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <ExplorerSkeleton />
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState
                      icon="users"
                      title="No customers found"
                      description={query || riskFilter
                        ? 'Try adjusting your search or filters.'
                        : 'Customer data will appear here once loaded.'}
                      action={query || riskFilter ? () => { setQuery(''); setRiskFilter('') } : undefined}
                      actionLabel={query || riskFilter ? 'Clear filters' : undefined}
                    />
                  </td>
                </tr>
              ) : (
                customers.map((c, i) => {
                  const risk = c.segment_risque || c.risk_level || ''
                  const pct = c.probabilite_churn != null ? Math.round(c.probabilite_churn * 100) : null
                  const barColor = RISK_COLOR[risk] || '#9ca3af'
                  return (
                    <tr key={`${c.customer_no}-${i}`}
                      className="group border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors cursor-pointer"
                      onClick={() => openCustomer(c)}>
                      <td className="py-2.5 px-4">
                        <span className="font-semibold text-blue-600 dark:text-blue-400 hover:underline tabular-nums">
                          {c.customer_no || '—'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-gray-400 dark:text-gray-600">
                        {c.account_no || '—'}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-gray-600 dark:text-gray-400">
                        {c.age != null ? formatTenure(c.age, 'short') : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-gray-600 dark:text-gray-400">
                        {formatTenure(c.tenure, 'short')}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-gray-600 dark:text-gray-400 tabular-nums">
                        {c.acct_balance != null ? c.acct_balance.toLocaleString() : '—'}
                      </td>
                      <td className="py-2.5 px-4">
                        {risk ? (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                                style={{ background: barColor }}>
                            {riskLabel(risk)}
                          </span>
                        ) : <span className="text-gray-400 dark:text-gray-600">—</span>}
                      </td>
                      <td className="py-2.5 px-4">
                        {pct == null ? <span className="text-gray-400 dark:text-gray-600 text-xs">—</span> : (
                          <div className="flex items-center gap-2">
                            <div className="w-14 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 hidden lg:block">
                              <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: barColor }} />
                            </div>
                            <span className="text-xs font-semibold tabular-nums" style={{ color: barColor }}>{pct}%</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <span className="text-gray-300 dark:text-gray-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors">
                          <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-500 dark:text-gray-500">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <button onClick={() => changePage(-1)} disabled={page <= 1}
                className="px-3 py-1.5 text-xs rounded-xl disabled:opacity-30 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-all">
                ← Prev
              </button>
              <button onClick={() => changePage(1)} disabled={page >= pages}
                className="px-3 py-1.5 text-xs rounded-xl disabled:opacity-30 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 transition-all">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ChartTip({ active, payload, label, chart }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-3 py-2.5 text-xs shadow-lg border"
      style={{ background: chart.tooltipBg, borderColor: chart.tooltipBorder, color: chart.tooltipText }}>
      {label && <p className="font-medium mb-1" style={{ color: chart.tooltipSub }}>{label}</p>}
      {payload.map((p, i) => <p key={i} style={{ color: p.fill || p.color }}>{p.name}: <span className="font-semibold">{p.value}%</span></p>)}
    </div>
  )
}

function StatCard({ label, value, accent = '#3b82f6', icon }) {
  return (
    <div className="card p-5 hover:-translate-y-0.5 transition-transform duration-200 relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-0.5 rounded-t-2xl opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 tracking-wide uppercase mb-2">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{value ?? '—'}</p>
        </div>
        {icon && <span className="text-xl opacity-60">{icon}</span>}
      </div>
    </div>
  )
}

function RankRow({ rank, name, rate, maxRate }) {
  const pct = maxRate > 0 ? (rate / maxRate) * 100 : 0
  const color = rate > 50 ? '#ef4444' : rate > 30 ? '#f59e0b' : '#3b82f6'
  return (
    <div className="flex items-center gap-3 py-2 group">
      <span className="text-xs font-bold text-gray-400 dark:text-gray-600 w-4 text-right shrink-0">{rank}</span>
      <span className="text-sm text-gray-700 dark:text-gray-400 w-40 truncate group-hover:text-gray-900 dark:group-hover:text-gray-200 transition-colors">{name}</span>
      <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
        <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-12 text-right shrink-0 tabular-nums">{rate}%</span>
    </div>
  )
}

/* ── Skeletons ──────────────────────────────────────── */
function StatSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="shimmer h-3 w-24 rounded-md" />
          <div className="shimmer h-7 w-16 rounded-md" />
        </div>
        <div className="shimmer w-6 h-6 rounded-lg" />
      </div>
    </div>
  )
}

function ChartSkeleton({ h = 'h-[220px]' }) {
  return (
    <div className="card p-6">
      <div className="shimmer h-4 w-48 rounded-md mb-1" />
      <div className="shimmer h-3 w-64 rounded-md mb-5" />
      <div className={`${h} flex items-end gap-2 px-2`}>
        {[60, 80, 45, 70, 55].map((pct, i) => (
          <div key={i} className="flex-1 shimmer rounded-t-md" style={{ height: `${pct}%` }} />
        ))}
      </div>
    </div>
  )
}

function RankSkeleton() {
  return (
    <div className="card p-6">
      <div className="shimmer h-4 w-40 rounded-md mb-1" />
      <div className="shimmer h-3 w-60 rounded-md mb-5" />
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="shimmer w-4 h-3 rounded-md shrink-0" />
            <div className="shimmer h-4 w-36 rounded-md" />
            <div className="flex-1 shimmer h-1.5 rounded-full" />
            <div className="shimmer h-4 w-10 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Build dynamic RECS from KPI data ───────────────── */
function buildRecs(kpis, tenure) {
  const recs = []

  // Check if tenure < 1yr is the highest churn factor
  const firstYearTenure = tenure?.find(t => t.name === '< 1 yr')
  if (firstYearTenure && firstYearTenure.churn_rate > 40) {
    recs.push({
      title: 'Target first-year customers',
      detail: `< 1yr tenure customers churn at ${firstYearTenure.churn_rate}%. Assign a dedicated relationship manager and trigger a loyalty reward at 6 months.`,
      priority: 'high', icon: '🎯', accent: '#ef4444',
    })
  } else {
    recs.push({
      title: 'Target first-year customers',
      detail: '< 1yr tenure customers churn most. Assign a dedicated relationship manager and trigger a loyalty reward at 6 months.',
      priority: 'high', icon: '🎯', accent: '#ef4444',
    })
  }

  // High churn rate warning
  if (kpis?.churn_rate > 30) {
    recs.push({
      title: `High portfolio churn rate: ${kpis.churn_rate}%`,
      detail: 'Your overall churn rate exceeds 30%. Immediate portfolio-wide retention campaign is recommended to stabilize attrition.',
      priority: 'high', icon: '🚨', accent: '#ef4444',
    })
  }

  recs.push({
    title: '7-day outreach for High-risk',
    detail: 'Every High-flagged account needs a personal call within one week — delay dramatically reduces retention odds.',
    priority: 'high', icon: '📞', accent: '#ef4444',
  })
  recs.push({
    title: 'Fee waiver for low-balance accounts',
    detail: 'Accounts < 5K show elevated churn. Removing account maintenance fees eliminates the primary financial friction.',
    priority: 'high', icon: '💰', accent: '#ef4444',
  })
  recs.push({
    title: 'Simplify KYC for C/D customers',
    detail: 'Low KYC-score clients churn 2× more. Guided document support and simplified re-verification reduces frustration.',
    priority: 'medium', icon: '📋', accent: '#f59e0b',
  })
  recs.push({
    title: 'Offer multi-currency accounts',
    detail: 'Currency preferences predict switching. Flexible USD/EUR options remove the leading competitor advantage.',
    priority: 'medium', icon: '🌍', accent: '#f59e0b',
  })
  recs.push({
    title: 'Quarterly reviews for corporate',
    detail: 'SME & corporate are high-value. A quarterly satisfaction review surfaces dissatisfaction before it becomes a churn.',
    priority: 'medium', icon: '🏢', accent: '#f59e0b',
  })

  return recs
}

/* ── Cohort comparison (frontend-only, reuses fetched arrays) ──── */
function CohortSide({ label, row, rate, accent, maxRate }) {
  return (
    <div className="flex-1 rounded-xl p-4 border" style={{ background: `${accent}0d`, borderColor: `${accent}25` }}>
      <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: accent }}>{label}</p>
      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate" title={row?.name}>{row?.name ?? '—'}</p>
      <p className="text-3xl font-bold mt-2 tabular-nums" style={{ color: accent }}>{rate.toFixed(1)}%</p>
      <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-1">churn rate{row?.count != null ? ` · ${row.count.toLocaleString()} customers` : ''}</p>
      <div className="mt-3 bg-gray-100 dark:bg-gray-800 rounded-full h-2">
        <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${(rate / maxRate) * 100}%`, background: accent }} />
      </div>
    </div>
  )
}

function CohortPicker({ value, onChange, buckets }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="px-3 py-2 h-9 text-sm rounded-xl cursor-pointer appearance-none w-full
                 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800
                 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all">
      {buckets.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
    </select>
  )
}

function CohortCompare({ dimensions }) {
  const available = dimensions.filter(d => d.data.length >= 2)
  const [dimKey, setDimKey] = useState(available[0]?.key || '')

  const dim = available.find(d => d.key === dimKey) || available[0]
  const buckets = dim?.data ?? []

  // Default the two buckets to highest- and lowest-churn within the dimension.
  const sorted = [...buckets].sort((a, b) => (b.churn_rate ?? 0) - (a.churn_rate ?? 0))
  const [aName, setAName] = useState(sorted[0]?.name ?? '')
  const [bName, setBName] = useState(sorted[sorted.length - 1]?.name ?? '')

  // When the dimension changes, reset the two bucket selections.
  const onDim = (key) => {
    setDimKey(key)
    const d = available.find(x => x.key === key)
    const s = [...(d?.data ?? [])].sort((a, b) => (b.churn_rate ?? 0) - (a.churn_rate ?? 0))
    setAName(s[0]?.name ?? '')
    setBName(s[s.length - 1]?.name ?? '')
  }

  if (available.length === 0) {
    return (
      <div className="card p-6">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">Compare cohorts</p>
        <EmptyState icon="chart" title="Not enough data"
          description="Cohort comparison needs at least two segments. Load customer data to enable it." />
      </div>
    )
  }

  const rowA = buckets.find(x => x.name === aName)
  const rowB = buckets.find(x => x.name === bName)
  const rateA = rowA?.churn_rate ?? 0
  const rateB = rowB?.churn_rate ?? 0
  const delta = rateA - rateB
  const maxRate = Math.max(rateA, rateB, 1)

  return (
    <div className="card p-6">
      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">Compare cohorts</p>
      <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">Pick a dimension and two segments to compare churn side by side</p>

      {/* Dimension selector */}
      <div className="flex flex-wrap gap-1 mb-4 p-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 w-max max-w-full">
        {available.map(d => (
          <button key={d.key} onClick={() => onDim(d.key)}
            className={[
              'px-3 py-1 text-xs font-medium rounded-md transition-colors',
              dim?.key === d.key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
            ].join(' ')}>
            {d.label}
          </button>
        ))}
      </div>

      {/* Bucket pickers */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <CohortPicker value={aName} onChange={setAName} buckets={buckets} />
        <CohortPicker value={bName} onChange={setBName} buckets={buckets} />
      </div>

      {/* Comparison */}
      <div className="flex items-stretch gap-3">
        <CohortSide label="Segment A" row={rowA} rate={rateA} accent="#3b82f6" maxRate={maxRate} />
        <CohortSide label="Segment B" row={rowB} rate={rateB} accent="#8b5cf6" maxRate={maxRate} />
      </div>

      {/* Delta callout */}
      <div className="mt-4 text-center text-sm">
        {Math.abs(delta) < 0.05 ? (
          <span className="text-gray-500 dark:text-gray-400">Both segments churn at roughly the same rate.</span>
        ) : (
          <span className="text-gray-600 dark:text-gray-300">
            <span className="font-semibold" style={{ color: delta > 0 ? '#3b82f6' : '#8b5cf6' }}>
              {(delta > 0 ? rowA : rowB)?.name}
            </span>{' '}
            churns{' '}
            <span className="font-bold text-red-600 dark:text-red-400">{Math.abs(delta).toFixed(1)} pts</span>{' '}
            higher than{' '}
            <span className="font-semibold" style={{ color: delta > 0 ? '#8b5cf6' : '#3b82f6' }}>
              {(delta > 0 ? rowB : rowA)?.name}
            </span>.
          </span>
        )}
      </div>
    </div>
  )
}

export default function Insights() {
  const [kpis, setKpis] = useState(null)
  const [partyclass, setPartyclass] = useState([])
  const [age, setAge] = useState([])
  const [tenure, setTenure] = useState([])
  const [balance, setBalance] = useState([])
  const [kyc, setKyc] = useState([])
  const [marital, setMarital] = useState([])
  const [natureClient, setNatureClient] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const insightsRef = useRef(null)
  const { chart } = useTheme()
  const { can } = usePermissions()

  const exportInsightsPDF = useCallback(async () => {
    if (!insightsRef.current) return
    setExporting(true)
    try {
      await exportElementToPDF(insightsRef.current, {
        title: 'ChurnGuard — Insights Report',
        filename: `churnguard-insights-${new Date().toISOString().slice(0, 10)}.pdf`,
      })
      toast.success('Insights exported', 'Your PDF report has been downloaded.')
    } catch {
      toast.error('Export failed', 'Could not generate the PDF. Please try again.')
    } finally {
      setExporting(false)
    }
  }, [])

  useEffect(() => {
    ;(async () => {
      const [k, pc, ag, ten, bal, ky, mar, nat] = await Promise.allSettled([
        api.get('/analytics/kpis'),
        api.get('/analytics/churn-by-partyclass'),
        api.get('/analytics/churn-by-age'),
        api.get('/analytics/churn-by-tenure'),
        api.get('/analytics/churn-by-balance'),
        api.get('/analytics/churn-by-kyc'),
        api.get('/analytics/churn-by-marital'),
        api.get('/analytics/churn-by-nature-client'),
      ])
      const v  = (r) => r.status === 'fulfilled' ? r.value?.data : null
      const ar = (r) => (r.status === 'fulfilled' ? r.value?.data : null) ?? []
      setKpis(v(k)); setPartyclass(ar(pc)); setAge(ar(ag))
      setTenure(ar(ten)); setBalance(ar(bal)); setKyc(ar(ky))
      setMarital(ar(mar)); setNatureClient(ar(nat))
      setLoading(false)
    })()
  }, [])

  if (loading) return (
    <div className="space-y-5 max-w-5xl">
      {/* Customer Explorer skeleton */}
      <div className="card p-6 space-y-4">
        <div className="shimmer h-5 w-48 rounded-md" />
        <div className="flex gap-3">
          <div className="shimmer flex-1 h-9 rounded-xl" />
          <div className="shimmer h-9 w-32 rounded-xl" />
          <div className="shimmer h-9 w-32 rounded-xl" />
        </div>
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-4">
              {[...Array(8)].map((_, j) => (
                <div key={j} className="shimmer h-4 flex-1 rounded-md" />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <StatSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <RankSkeleton /><ChartSkeleton />
      </div>
      <ChartSkeleton h="h-[190px]" />
    </div>
  )

  const topAge = age.length ? [...age].sort((a, b) => b.churn_rate - a.churn_rate)[0] : null
  const topTenure = tenure.length ? [...tenure].sort((a, b) => b.churn_rate - a.churn_rate)[0] : null
  const topPartyClass = partyclass.length ? partyclass[0] : null
  const topBalance = balance.length ? [...balance].sort((a, b) => b.churn_rate - a.churn_rate)[0] : null

  const factors = [
    topTenure && { name: `Tenure: ${topTenure.name}`, rate: topTenure.churn_rate },
    topBalance && { name: `Balance: ${topBalance.name}`, rate: topBalance.churn_rate },
    topPartyClass && { name: `Segment: ${topPartyClass.name}`, rate: topPartyClass.churn_rate },
    topAge && { name: `Age: ${topAge.name}`, rate: topAge.churn_rate },
    ...kyc.slice(0, 3).map(k => ({ name: `KYC: ${KYC_LABELS[k.name] || k.name}`, rate: k.churn_rate })),
  ].filter(Boolean).sort((a, b) => b.rate - a.rate).slice(0, 8)

  const maxRate = factors.length ? factors[0].rate : 100
  const tip = (props) => <ChartTip {...props} chart={chart} />

  const RECS = buildRecs(kpis, tenure)

  return (
    <div className="space-y-6 w-full" ref={insightsRef}>

      {/* Toolbar: export everything */}
      <div className="flex justify-end">
        <button
          onClick={exportInsightsPDF}
          disabled={exporting || !kpis}
          data-export-ignore="true"
          title={kpis ? 'Export all insights as a PDF' : 'No data to export yet'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl
                     text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700
                     hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-all">
          <svg className={`w-3.5 h-3.5 ${exporting ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            {exporting
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />}
          </svg>
          {exporting ? 'Exporting…' : 'Export all (PDF)'}
        </button>
      </div>

      {/* KPIs */}
      {kpis ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Churn Rate"          value={`${kpis.churn_rate}%`}                       accent="#ef4444" icon="📉" />
          <StatCard label="High-risk Accounts"  value={kpis.high_risk_customers?.toLocaleString()}  accent="#f59e0b" icon="⚠️" />
          <StatCard label="Predicted Churners"  value={kpis.predicted_churners?.toLocaleString()}   accent="#f97316" icon="⚡" />
          <StatCard label="Avg Tenure"          value={formatTenure(kpis.avg_tenure, 'compact')}    accent="#3b82f6" icon="📅" />
        </div>
      ) : (
        <div className="card">
          <EmptyState icon="database" title="No analytics data" description="Connect the database to see insight metrics." />
        </div>
      )}

      {/* Jump to customer list */}
      <div className="flex justify-end -mt-2">
        <button
          onClick={() => document.getElementById('customer-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
          Jump to customer list
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </button>
      </div>

      {/* Ranking + Tenure */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="card p-6">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">Top churn risk factors</p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mb-5">Segments with the highest observed churn rate</p>
          {factors.length > 0 ? (
            <div className="space-y-0.5">
              {factors.map((f, i) => <RankRow key={f.name} rank={i + 1} name={f.name} rate={f.rate} maxRate={maxRate} />)}
            </div>
          ) : (
            <EmptyState icon="chart" title="No risk factors" description="Load customer data to see churn risk factors." />
          )}
        </div>

        {can('show_insights_tenure') && (
        <ChartCard title="Churn rate by tenure" subtitle="Newer customers carry the highest risk">
          {tenure.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={[...tenure].sort((a, b) => {
                const o = ['< 1 yr', '1-2 yrs', '3-4 yrs', '5-7 yrs', '8+ yrs']
                return o.indexOf(a.name) - o.indexOf(b.name)
              })} barCategoryGap="25%">
                <CartesianGrid vertical={false} stroke={chart.grid} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: chart.axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: chart.axis }} unit="%" axisLine={false} tickLine={false} width={32} />
                <Tooltip content={tip} cursor={false} />
                <Bar dataKey="churn_rate" name="Churn Rate" radius={[5, 5, 0, 0]} fill="#8b5cf6" opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState icon="chart" title="No tenure data" />}
        </ChartCard>
        )}
      </div>

      {/* KYC + Partyclass */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {can('show_insights_kyc') && (
        <ChartCard title="Churn rate by KYC score" subtitle="Risk-based KYC classification — see reference below">
          {kyc.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={kyc} barCategoryGap="30%">
                  <CartesianGrid vertical={false} stroke={chart.grid} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: chart.axis }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: chart.axis }} unit="%" axisLine={false} tickLine={false} width={32} />
                  <Tooltip content={tip} cursor={false} />
                  <Bar dataKey="churn_rate" name="Churn Rate" radius={[5, 5, 0, 0]} opacity={0.85}>
                    {kyc.map((r, i) => <Cell key={i} fill={KYC_COLORS[r.name] || '#ec4899'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <KycRef />
            </>
          ) : <EmptyState icon="chart" title="No KYC data" />}
        </ChartCard>
        )}

        <ChartCard title="Churn rate by segment" subtitle="Which client category needs most attention">
          {partyclass.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={partyclass} barCategoryGap="25%">
                <CartesianGrid vertical={false} stroke={chart.grid} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: chart.axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: chart.axis }} unit="%" axisLine={false} tickLine={false} width={32} />
                <Tooltip content={tip} cursor={false} />
                <Bar dataKey="churn_rate" name="Churn Rate" radius={[5, 5, 0, 0]} fill="#06b6d4" opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState icon="chart" title="No segment data" />}
        </ChartCard>
      </div>

      {/* Age + Balance + Client nature */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {can('show_insights_age') && (
        <ChartCard title="Churn rate by age group" subtitle="Which age bands churn the most">
          {age.length > 0 ? (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={age} barCategoryGap="20%">
                <CartesianGrid vertical={false} stroke={chart.grid} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: chart.axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: chart.axis }} unit="%" axisLine={false} tickLine={false} width={32} />
                <Tooltip content={tip} cursor={false} />
                <Bar dataKey="churn_rate" name="Churn Rate" radius={[5, 5, 0, 0]} fill="#ef4444" opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState icon="chart" title="No age data" />}
        </ChartCard>
        )}

        {can('show_insights_balance') && (
        <ChartCard title="Churn rate by balance tier" subtitle="Risk across account balance bands">
          {balance.length > 0 ? (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={balance} barCategoryGap="25%">
                <CartesianGrid vertical={false} stroke={chart.grid} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: chart.axis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: chart.axis }} unit="%" axisLine={false} tickLine={false} width={32} />
                <Tooltip content={tip} cursor={false} />
                <Bar dataKey="churn_rate" name="Churn Rate" radius={[5, 5, 0, 0]} fill="#f59e0b" opacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState icon="chart" title="No balance data" />}
        </ChartCard>
        )}
      </div>

      {/* Client nature */}
      <ChartCard title="Churn rate by client nature" subtitle="Account type classification — see reference below">
        {natureClient.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={natureClient} layout="vertical" barCategoryGap="20%">
                <CartesianGrid horizontal={false} stroke={chart.grid} />
                <XAxis type="number" tick={{ fontSize: 10, fill: chart.axis }} unit="%" axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: chart.axis }} width={90} axisLine={false} tickLine={false} />
                <Tooltip content={tip} cursor={false} />
                <Bar dataKey="churn_rate" name="Churn Rate" radius={[0, 5, 5, 0]} fill="#8b5cf6" opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
            <PartyClassRef />
          </>
        ) : <EmptyState icon="chart" title="No client nature data" description="Column nature_client not found in dataset." />}
      </ChartCard>

      {/* Marital status */}
      {can('show_insights_marital') && (
      <ChartCard title="Churn rate by marital status" subtitle="Secondary demographic signal">
        {marital.length > 0 ? (
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={marital.map(r => ({ ...r, name: maritalLabel(r.name) }))} barCategoryGap="25%">
              <CartesianGrid vertical={false} stroke={chart.grid} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: chart.axis }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: chart.axis }} unit="%" axisLine={false} tickLine={false} width={32} />
              <Tooltip content={tip} cursor={false} />
              <Bar dataKey="churn_rate" name="Churn Rate" radius={[5, 5, 0, 0]} fill="#ec4899" opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyState icon="chart" title="No marital data" />}
      </ChartCard>
      )}

      {/* Cohort comparison */}
      {can('show_cohort_compare') && (
      <CohortCompare
        dimensions={[
          { key: 'tenure',     label: 'Tenure',      data: tenure },
          { key: 'age',        label: 'Age',         data: age },
          { key: 'balance',    label: 'Balance',     data: balance },
          { key: 'partyclass', label: 'Segment',     data: partyclass },
          { key: 'kyc',        label: 'KYC',         data: kyc.map(r => ({ ...r, name: KYC_LABELS[r.name] || r.name })) },
          { key: 'marital',    label: 'Marital',     data: marital.map(r => ({ ...r, name: maritalLabel(r.name) })) },
        ]}
      />
      )}

      {/* Customer Explorer — drill down to individual at-risk customers */}
      <div id="customer-list" className="card p-6 scroll-mt-20">
        <CustomerExplorer />
      </div>

      {/* Retention playbook */}
      <div>
        <div className="mb-4">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Retention playbook</p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">Actionable steps derived from your portfolio's churn patterns</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {RECS.map(r => (
            <div key={r.title} className="card p-4 hover:-translate-y-0.5 transition-transform duration-200 relative overflow-hidden group">
              <div className="absolute top-0 inset-x-0 h-0.5 rounded-t-2xl opacity-50"
                style={{ background: `linear-gradient(90deg, transparent, ${r.accent}, transparent)` }} />
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0"
                  style={{ background: `${r.accent}14`, border: `1.5px solid ${r.accent}25` }}>
                  {r.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">{r.title}</p>
                    <span className={r.priority === 'high' ? 'badge-high' : 'badge-medium'}>{r.priority}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-500 leading-relaxed group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">
                    {r.detail}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
