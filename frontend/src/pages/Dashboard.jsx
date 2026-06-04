import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'
import { useTheme } from '../hooks/useTheme'
import { useCountUp } from '../hooks/useCountUp'
import EmptyState from '../components/EmptyState'
import ChartCard from '../components/ChartCard'
import { usePermissions } from '../hooks/usePermissions'
import { formatTenure, formatCurrency, riskLabel } from '../utils/format'
import { toast } from '../store/uiStore'
import { exportElementToPDF } from '../utils/pdf'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from 'recharts'

/* Account-status colours for the pie */
const STATUS_COLOR = {
  Active: '#22c55e', active: '#22c55e', Actif: '#22c55e',
  Closed: '#ef4444', closed: '#ef4444', Fermé: '#ef4444', Clôturé: '#ef4444',
  Dormant: '#f59e0b', dormant: '#f59e0b', Dormante: '#f59e0b',
  Inactive: '#94a3b8', inactive: '#94a3b8',
}

const RISK_COLOR = {
  // English keys (from predict API)
  High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e',
  high: '#ef4444', medium: '#f59e0b', low: '#22c55e',
  // French keys (from churn_predictions table)
  'Élevé': '#ef4444', Moyen: '#f59e0b', Faible: '#22c55e',
}
const PALETTE = ['#3b82f6','#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899']

/* Outside donut label ("Name · NN%"). Positioned just beyond the arc with a
 * leader line, but the text x is CLAMPED to the SVG width so it never overflows
 * the chart box — outside labels that spill past the box get clipped by
 * html2canvas on PNG/PDF export, which is why the percentages went missing. */
function renderOutsideLabel({ cx, cy, midAngle, outerRadius, percent, name }) {
  if (!percent || percent < 0.03) return null
  const RAD = Math.PI / 180
  const cos = Math.cos(-midAngle * RAD)
  const sin = Math.sin(-midAngle * RAD)
  const onRight = cos >= 0
  const lx = cx + (outerRadius + 4) * cos
  const ly = cy + (outerRadius + 4) * sin
  const ex = cx + (outerRadius + 16) * cos
  const ey = cy + (outerRadius + 16) * sin
  const text = `${name} · ${Math.round(percent * 100)}%`
  const fontSize = 15
  const estW = text.length * fontSize * 0.58
  const W = cx * 2
  let tx = ex + (onRight ? 4 : -4)
  if (onRight) tx = Math.min(tx, W - estW - 2)
  else tx = Math.max(tx, estW + 2)
  tx = Math.max(2, Math.min(tx, W - 2))
  return (
    <g>
      <path d={`M${lx},${ly}L${ex},${ey}L${tx + (onRight ? -3 : 3)},${ey}`}
        stroke="#9ca3af" strokeWidth={1} fill="none" />
      <text x={tx} y={ey} textAnchor={onRight ? 'start' : 'end'} dominantBaseline="central"
        fontSize={fontSize} fontWeight={600} fill="#6b7280">
        {text}
      </text>
    </g>
  )
}

/* ── Analytics endpoints (key → URL) ──────────────────── */
const ENDPOINTS = {
  kpis:          '/analytics/kpis',
  age:           '/analytics/churn-by-age',
  tenure:        '/analytics/churn-by-tenure',
  riskSegments:  '/analytics/risk-segments',
  confusion:     '/analytics/actual-vs-predicted',
  probDist:      '/analytics/probability-distribution',
  natureClient:  '/analytics/churn-by-nature-client',
  revenueAtRisk: '/analytics/revenue-at-risk',
  churnTrend:    '/analytics/churn-trend',
  highRisk:      '/customers/high-risk?limit=5',
  accountStatus: '/analytics/account-status',
}

/* ── Metric computation from confusion matrix ─────────── */
function computeMetrics(conf) {
  if (!conf) return null
  const tp = conf.true_positive  ?? 0
  const tn = conf.true_negative  ?? 0
  const fp = conf.false_positive ?? 0
  const fn = conf.false_negative ?? 0
  const total = tp + tn + fp + fn
  if (!total) return null
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0
  const recall    = tp + fn > 0 ? tp / (tp + fn) : 0
  return {
    accuracy:  (tp + tn) / total,
    precision,
    recall,
    f1: precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0,
  }
}

/* ── Chart tooltip ─────────────────────────────────── */
function ChartTip({ active, payload, label, chart }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl px-3 py-2.5 text-xs shadow-lg border"
      style={{ background: chart.tooltipBg, borderColor: chart.tooltipBorder, color: chart.tooltipText }}>
      {label && <p className="font-medium mb-1" style={{ color: chart.tooltipSub }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }}>
          {p.name}: <span className="font-semibold">{p.value}{String(p.name).toLowerCase().includes('rate') ? '%' : ''}</span>
        </p>
      ))}
    </div>
  )
}

/* ── Failed-to-load state (distinct from "no data") ──── */
function LoadError() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <span className="text-3xl mb-2">⚠️</span>
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Couldn’t load this chart</p>
      <p className="text-xs text-gray-400 dark:text-gray-600 max-w-[240px] leading-relaxed">
        The request failed. Use the Refresh button at the top to try again.
      </p>
    </div>
  )
}

/* ── Animated KPI card (no fabricated trends) ────────── */
function KPICard({ label, rawValue, format, sub, accent = '#3b82f6', icon }) {
  const counted = useCountUp(rawValue)
  const display = rawValue != null && !isNaN(rawValue) ? format(counted) : '—'

  return (
    <div className="card p-5 hover:-translate-y-0.5 transition-transform duration-200 relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-0.5 rounded-t-2xl opacity-60"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 tracking-wide uppercase mb-2">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-none tabular-nums">{display}</p>
          {sub && <p className="text-xs text-gray-400 dark:text-gray-600 mt-1.5">{sub}</p>}
        </div>
        {icon && (
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base shrink-0"
            style={{ background: `${accent}18`, border: `1.5px solid ${accent}30` }}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Revenue-at-risk hero card ────────────────────────── */
function RevenueAtRisk({ data, failed, currencyFmt }) {
  const total   = data?.total_at_risk ?? null
  const counted = useCountUp(total ?? 0)
  const segments = data?.segments ?? []
  const totalBal = data?.total_balance || 0
  const pctOfBook = totalBal > 0 && total != null ? (total / totalBal) * 100 : null
  const maxBal = segments.reduce((m, s) => Math.max(m, s.balance || 0), 0)

  return (
    <div className="card p-5 relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-0.5 rounded-t-2xl opacity-70"
        style={{ background: 'linear-gradient(90deg, transparent, #ef4444, transparent)' }} />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Big number */}
        <div className="md:border-r md:border-gray-100 md:dark:border-gray-800 md:pr-5">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 tracking-wide uppercase mb-2">
            💸 Revenue at risk
          </p>
          {failed ? (
            <p className="text-sm text-gray-400 dark:text-gray-600">Couldn’t load</p>
          ) : total == null ? (
            <p className="text-2xl font-bold text-gray-300 dark:text-gray-700">—</p>
          ) : (
            <>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400 leading-none tabular-nums">
                {currencyFmt(counted, { compact: true })}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-2 leading-relaxed">
                {data.at_risk_customers?.toLocaleString()} high-risk customers
                {pctOfBook != null && <> · {pctOfBook.toFixed(1)}% of total balance</>}
              </p>
            </>
          )}
        </div>

        {/* Per-segment balance bars */}
        <div className="md:col-span-2">
          <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wide mb-3">
            Balance exposed by risk segment
          </p>
          {failed ? (
            <p className="text-xs text-gray-400 dark:text-gray-600">The request failed — try Refresh.</p>
          ) : segments.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-600">
              No predicted risk segments yet. Run portfolio scoring to populate this.
            </p>
          ) : (
            <div className="space-y-2.5">
              {segments.map((s) => {
                const color = RISK_COLOR[s.name] || '#9ca3af'
                const pct = maxBal > 0 ? (s.balance / maxBal) * 100 : 0
                return (
                  <div key={s.name} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-16 shrink-0 truncate">{s.name}</span>
                    <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2.5">
                      <div className="h-2.5 rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 w-28 text-right shrink-0 tabular-nums">
                      {currencyFmt(s.balance, { compact: true })}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-600 w-20 text-right shrink-0 tabular-nums">
                      {s.customers?.toLocaleString()} cust.
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Skeletons matching real layout ────────────────── */
function KPISkeleton() {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <div className="shimmer h-3 w-24 rounded-md" />
          <div className="shimmer h-7 w-20 rounded-md" />
          <div className="shimmer h-3 w-16 rounded-md" />
        </div>
        <div className="shimmer w-9 h-9 rounded-xl shrink-0" />
      </div>
    </div>
  )
}

function ChartSkeleton({ h = 'h-[260px]' }) {
  return (
    <div className="card p-5">
      <div className="shimmer h-4 w-40 rounded-md mb-1" />
      <div className="shimmer h-3 w-56 rounded-md mb-4" />
      <div className={`${h} flex items-end gap-2 px-4`}>
        {[45,70,55,85,40,75,60,90,50,65].map((pct, i) => (
          <div key={i} className="flex-1 shimmer rounded-t-md" style={{ height: `${pct}%` }} />
        ))}
      </div>
    </div>
  )
}

/* ── Metric ring (SVG arc + label) ────────────────────── */
function MetricRing({ value, label, definition, color }) {
  const pct = Math.min(Math.max(value, 0), 1)
  const r   = 28
  const circ = 2 * Math.PI * r
  const dash = pct * circ
  return (
    <div className="card p-4 flex items-center gap-3 hover:-translate-y-0.5 transition-transform duration-200"
         style={{ borderTop: `2px solid ${color}55` }}>
      <div className="shrink-0">
        <svg width="68" height="68" viewBox="0 0 68 68">
          <circle cx="34" cy="34" r={r} fill="none" stroke={`${color}22`} strokeWidth="5" />
          <circle cx="34" cy="34" r={r} fill="none" stroke={color} strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${circ}`}
                  transform="rotate(-90 34 34)" />
          <text x="34" y="38" textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>
            {(pct * 100).toFixed(1)}%
          </text>
        </svg>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{label}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-tight">{definition}</p>
      </div>
    </div>
  )
}

/* ── Top high-risk customers table ────────────────────── */
function HighRiskTable({ data, failed, currencyFmt }) {
  const customers = data?.customers ?? []
  return (
    <ChartCard
      title="Top high-risk customers"
      subtitle="Highest churn probability — click a row to open the full profile"
    >
      {failed ? <LoadError /> : customers.length > 0 ? (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-gray-400 dark:text-gray-600 text-[11px] uppercase tracking-wide">
                <th className="text-left font-semibold py-2 px-2">Customer</th>
                <th className="text-left font-semibold py-2 px-2">Segment</th>
                <th className="text-left font-semibold py-2 px-2 hidden sm:table-cell">Tenure</th>
                <th className="text-right font-semibold py-2 px-2 hidden md:table-cell">Balance</th>
                <th className="text-right font-semibold py-2 px-2">Churn risk</th>
                <th className="py-2 px-2" />
              </tr>
            </thead>
            <tbody>
              {customers.map((c, i) => {
                const prob = c.probabilite_churn
                const pct = prob != null ? Math.round(prob * 100) : null
                const riskColor = RISK_COLOR[c.segment_risque] || '#9ca3af'
                return (
                  <tr key={`${c.customer_no}-${c.account_no}-${i}`}
                      className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="py-2.5 px-2">
                      <Link to={`/customers/${encodeURIComponent(c.customer_no)}${c.account_no != null ? `?account=${encodeURIComponent(c.account_no)}` : ''}`}
                            className="font-semibold text-blue-600 dark:text-blue-400 hover:underline tabular-nums">
                        {c.customer_no}
                      </Link>
                      {c.partyclass && (
                        <span className="block text-[11px] text-gray-400 dark:text-gray-600">{c.partyclass}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                            style={{ background: riskColor }}>
                        {riskLabel(c.segment_risque)}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-gray-600 dark:text-gray-400 hidden sm:table-cell">
                      {formatTenure(c.tenure, 'short')}
                    </td>
                    <td className="py-2.5 px-2 text-right text-gray-700 dark:text-gray-300 tabular-nums hidden md:table-cell">
                      {currencyFmt(c.acct_balance, { compact: true })}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      {pct == null ? <span className="text-gray-400">—</span> : (
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-14 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 hidden lg:block">
                            <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: riskColor }} />
                          </div>
                          <span className="font-semibold tabular-nums" style={{ color: riskColor }}>{pct}%</span>
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-right">
                      <Link to={`/customers/${encodeURIComponent(c.customer_no)}${c.account_no != null ? `?account=${encodeURIComponent(c.account_no)}` : ''}`}
                            className="text-gray-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
                        <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState icon="users" title="No high-risk customers"
          description="High-risk customers appear here once predictions are run on your portfolio." />
      )}
    </ChartCard>
  )
}

/* ── Model info modal ─────────────────────────────────── */
const MODEL_FEATURES = [
  'Age', 'Tenure', 'Account balance', 'Party class', 'KYC score',
  'Marital status', 'Currency', 'Client nature', 'Account status',
]
function ModelInfoRow({ k, v }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-xs text-gray-500 dark:text-gray-500">{k}</span>
      <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 text-right">{v}</span>
    </div>
  )
}

function ModelInfoModal({ confusion, kpis, onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const m = confusion ? computeMetrics(confusion) : null
  const Row = ModelInfoRow

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-modal border border-gray-200 dark:border-gray-800 animate-scale-in max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 flex items-center justify-center text-lg">🧠</div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">About the prediction model</h3>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">How ChurnGuard scores churn risk</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-600 mb-1.5">Model</p>
            <Row k="Algorithm" v="Random Forest (scikit-learn)" />
            <Row k="Task" v="Binary classification — churn / no churn" />
            <Row k="Explainability" v="SHAP feature contributions" />
            <Row k="Risk thresholds" v="≥ 0.60 High · 0.30–0.60 Medium · < 0.30 Low" />
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-600 mb-2">Input features</p>
            <div className="flex flex-wrap gap-1.5">
              {MODEL_FEATURES.map(f => (
                <span key={f} className="text-[11px] px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700">{f}</span>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-600 mb-1.5">Performance on current dataset</p>
            {m ? (
              <div className="grid grid-cols-4 gap-2">
                {[['Accuracy', m.accuracy], ['Precision', m.precision], ['Recall', m.recall], ['F1', m.f1]].map(([label, val]) => (
                  <div key={label} className="rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 p-2.5 text-center">
                    <p className="text-[10px] text-gray-400 dark:text-gray-600">{label}</p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">{(val * 100).toFixed(1)}%</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400 dark:text-gray-600">Metrics appear once predictions with actual labels are available.</p>
            )}
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-600 mb-1.5">Data snapshot</p>
            <Row k="Customers tracked" v={kpis ? Math.round(kpis.total_customers || 0).toLocaleString() : '—'} />
            <Row k="Predicted churners" v={kpis ? Math.round(kpis.predicted_churners || 0).toLocaleString() : '—'} />
            <Row k="High-risk customers" v={kpis ? Math.round(kpis.high_risk_customers || 0).toLocaleString() : '—'} />
          </div>
        </div>

        <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 shrink-0 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-xl text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">Close</button>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [d, setD] = useState({})
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [updatedAt, setUpdatedAt] = useState(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const contentRef = useRef(null)
  const { chart } = useTheme()
  const { can } = usePermissions()

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    const entries = Object.entries(ENDPOINTS)
    // Promise.allSettled so one failing endpoint never wipes all charts
    const settled = await Promise.allSettled(entries.map(([, url]) => api.get(url, { silent: true })))
    const data = {}
    const errs = {}
    entries.forEach(([key], i) => {
      const r = settled[i]
      if (r.status === 'fulfilled') data[key] = r.value?.data
      else errs[key] = true
    })
    setD(data)
    setErrors(errs)
    setUpdatedAt(new Date())
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  /* Full-page PDF export — single content-fitted page via the shared helper. */
  const exportDashboardPDF = useCallback(async () => {
    if (!contentRef.current) return
    setExporting(true)
    try {
      await exportElementToPDF(contentRef.current, {
        title: 'ChurnGuard — Dashboard Report',
        filename: `churnguard-dashboard-${new Date().toISOString().slice(0, 10)}.pdf`,
      })
      toast.success('Dashboard exported', 'Your PDF report has been downloaded.')
    } catch {
      toast.error('Export failed', 'Could not generate the PDF. Please try again.')
    } finally {
      setExporting(false)
    }
  }, [])

  if (loading) return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => <KPISkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartSkeleton /><ChartSkeleton />
      </div>
      <ChartSkeleton h="h-[200px]" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartSkeleton h="h-[220px]" /><ChartSkeleton h="h-[220px]" />
      </div>
    </div>
  )

  const arr = (k) => (Array.isArray(d[k]) ? d[k] : [])
  const failed = (k) => !!errors[k]
  const currencyFmt = (v, opts) => formatCurrency(v, d.revenueAtRisk?.currency || 'TND', opts)

  const {
    kpis, confusion, revenueAtRisk, churnTrend = [],
  } = d
  const age          = arr('age')
  const tenure       = arr('tenure')
  const riskSegments = arr('riskSegments')
  const probDist     = arr('probDist')
  const natureClient = arr('natureClient')
  const accountStatus = arr('accountStatus')

  const tip = (props) => <ChartTip {...props} chart={chart} />
  const hasData = !!kpis

  return (
    <div className="space-y-5">

      {/* Toolbar: headline stats (left) + last updated + actions (right) */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed min-w-0 flex-1">
          {hasData ? (
            <>
              <span className="font-bold text-gray-900 dark:text-gray-100">{Math.round(kpis.total_customers || 0).toLocaleString()}</span> customers tracked ·{' '}
              <span className="font-bold text-red-500">{Math.round(kpis.high_risk_customers || 0).toLocaleString()}</span> at high risk ·{' '}
              <span className="font-bold text-amber-500">{Math.round(kpis.predicted_churners || 0).toLocaleString()}</span> predicted to churn ·{' '}
              overall churn rate <span className="font-bold text-gray-900 dark:text-gray-100">{(kpis.churn_rate ?? 0).toFixed(1)}%</span>
            </>
          ) : <span>&nbsp;</span>}
        </p>
        <div className="flex items-center gap-3 shrink-0">
        {updatedAt && (
          <span className="text-xs text-gray-400 dark:text-gray-600 tabular-nums">
            Updated {updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        <button
          onClick={() => setInfoOpen(true)}
          title="About the prediction model"
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl
                     text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700
                     hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Model info
        </button>
        <button
          onClick={exportDashboardPDF}
          disabled={exporting || !hasData}
          title={hasData ? 'Export the full dashboard as a PDF' : 'No data to export yet'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl
                     text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700
                     hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-all">
          {exporting ? (
            <svg className="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          )}
          {exporting ? 'Exporting…' : 'Export PDF'}
        </button>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl
                     text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700
                     hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-all">
          <svg className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
        </div>
      </div>

      {/* Exportable content */}
      <div ref={contentRef} className="space-y-5">

      {/* KPIs */}
      {hasData ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard label="Total Customers"    rawValue={kpis.total_customers}    format={v => Math.round(v).toLocaleString()} accent="#3b82f6" icon="👥" />
          <KPICard label="Churn Rate"         rawValue={kpis.churn_rate}         format={v => `${v.toFixed(1)}%`}  accent="#ef4444" icon="📉" sub="of active portfolio" />
          <KPICard label="Avg Tenure"         rawValue={kpis.avg_tenure}         format={v => formatTenure(v, 'compact')} accent="#6366f1" icon="📅" />
          <KPICard label="Avg Age"            rawValue={kpis.avg_age}            format={v => `${Math.round(v)} yrs`} accent="#0ea5e9" icon="🎂" />
          <KPICard label="Predicted Churners" rawValue={kpis.predicted_churners} format={v => Math.round(v).toLocaleString()} accent="#f59e0b" icon="⚡" />
          <KPICard label="High Risk"          rawValue={kpis.high_risk_customers} format={v => Math.round(v).toLocaleString()} accent="#ef4444" icon="🔴" sub="need attention" />
        </div>
      ) : failed('kpis') ? (
        <div className="card"><LoadError /></div>
      ) : (
        <div className="card">
          <EmptyState icon="database" title="No KPI data" description="Connect the database and load customer data to see live metrics." />
        </div>
      )}

      {/* Revenue at risk */}
      {can('show_revenue_at_risk') && <RevenueAtRisk data={revenueAtRisk} failed={failed('revenueAtRisk')} currencyFmt={currencyFmt} />}

      {/* Top high-risk customers */}
      {can('show_high_risk_table') && <HighRiskTable data={d.highRisk} failed={failed('highRisk')} currencyFmt={currencyFmt} />}

      {/* Risk donut + Confusion */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {can('show_risk_chart') && (
        <ChartCard title="Risk segment distribution" subtitle="Model-classified customer segments">
          {failed('riskSegments') ? <LoadError /> : riskSegments.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={riskSegments.map(r => ({ ...r, name: riskLabel(r.name) }))} dataKey="value" nameKey="name"
                  cx="50%" cy="48%" innerRadius={50} outerRadius={74}
                  paddingAngle={3}
                  activeShape={null}
                  label={renderOutsideLabel}
                  labelLine={false}>
                  {riskSegments.map((e, i) => <Cell key={i} fill={RISK_COLOR[e.name] || PALETTE[i]} stroke="transparent" />)}
                </Pie>
                <Tooltip content={tip} cursor={false} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyState icon="chart" title="No segment data" description="Risk classification will appear after predictions are run." />}
        </ChartCard>
        )}

        {can('show_confusion_matrix') && (
        <ChartCard title="Model performance" subtitle="Accuracy, Precision, Recall, F1 — computed from predictions">
          {failed('confusion') ? <LoadError /> : confusion ? (() => {
            const m = computeMetrics(confusion)
            return m ? (
              <div className="space-y-3 mt-1">
                {/* 4 metric rings */}
                <div className="grid grid-cols-2 gap-2">
                  <MetricRing value={m.accuracy}  label="Accuracy"  color="#3b82f6" definition="Correct predictions overall" />
                  <MetricRing value={m.precision} label="Precision" color="#8b5cf6" definition="Of predicted churners, actually churned" />
                  <MetricRing value={m.recall}    label="Recall"    color="#10b981" definition="Of actual churners, caught by model" />
                  <MetricRing value={m.f1}        label="F1-Score"  color="#f59e0b" definition="Balance of precision and recall" />
                </div>
                {/* Raw counts */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'True Positive',  value: confusion.true_positive,  color: '#3b82f6' },
                    { label: 'True Negative',  value: confusion.true_negative,  color: '#10b981' },
                    { label: 'False Positive', value: confusion.false_positive, color: '#f59e0b' },
                    { label: 'False Negative', value: confusion.false_negative, color: '#f59e0b' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="rounded-xl p-3 text-center"
                         style={{ background: `${color}10`, border: `1.5px solid ${color}25` }}>
                      <p className="text-[10px] font-semibold leading-tight mb-1" style={{ color: `${color}cc` }}>{label}</p>
                      <p className="text-lg font-bold tabular-nums" style={{ color }}>{value?.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : <EmptyState icon="chart" title="Insufficient data" description="Need predictions with actual churn labels." />
          })() : <EmptyState icon="chart" title="No model metrics" description="Load prediction data to see accuracy metrics." />}
        </ChartCard>
        )}
      </div>

      {/* Probability distribution */}
      {can('show_probability_dist') && (
      <ChartCard title="Churn probability distribution" subtitle="Number of customers per probability bucket">
        {failed('probDist') ? <LoadError /> : probDist.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={probDist} barCategoryGap="20%">
              <CartesianGrid vertical={false} stroke={chart.grid} />
              <XAxis dataKey="name" tick={{ fontSize: 9, fill: chart.axis }} axisLine={false} tickLine={false} interval={0} />
              <YAxis tick={{ fontSize: 10, fill: chart.axis }} axisLine={false} tickLine={false} width={40} />
              <Tooltip content={tip} cursor={false} />
              <Bar dataKey="count" name="Customers" radius={[4, 4, 0, 0]} fill="#3b82f6" opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyState icon="chart" title="No distribution data" description="Run predictions to see probability distribution." />}
      </ChartCard>
      )}

      {/* Churn trend over time */}
      {can('show_churn_trend') && <ChartCard title="Churn risk trend (live)" subtitle="Builds automatically from predictions you run in the app — daily average">
        {failed('churnTrend') ? <LoadError /> : churnTrend.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={churnTrend} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={chart.grid} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: chart.axis }} axisLine={false} tickLine={false}
                     tickFormatter={(v) => (typeof v === 'string' ? v.slice(5) : v)} />
              <YAxis tick={{ fontSize: 10, fill: chart.axis }} unit="%" axisLine={false} tickLine={false} width={40} />
              <Tooltip content={tip} cursor={false} />
              <Area type="monotone" dataKey="avg_churn_prob" name="Avg churn rate" stroke="#3b82f6" strokeWidth={2} fill="url(#trendFill)" />
              <Area type="monotone" dataKey="high_risk_rate" name="High-risk rate" stroke="#ef4444" strokeWidth={2} fill="transparent" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState
            icon="chart"
            title="No prediction history yet"
            description="The trend builds automatically as you run predictions. Score some customers and check back."
          />
        )}
      </ChartCard>}

      {/* ─────────── Customer base overview ─────────── */}
      <div className="pt-1">
        <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-widest mb-3">
          Customer base overview
        </p>

        {/* Account status pie + Customers vs churners by age */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ChartCard title="Account status" subtitle="Active vs closed / dormant accounts">
            {failed('accountStatus') ? <LoadError /> : accountStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={accountStatus} dataKey="value" nameKey="name"
                    cx="50%" cy="48%" innerRadius={50} outerRadius={74} paddingAngle={3}
                    label={renderOutsideLabel}
                    labelLine={false}>
                    {accountStatus.map((e, i) => (
                      <Cell key={i} fill={STATUS_COLOR[e.name] || PALETTE[i % PALETTE.length]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={tip} cursor={false} />
                </PieChart>
              </ResponsiveContainer>
            ) : <EmptyState icon="chart" title="No account status data" description="Column account_status not found in dataset." />}
          </ChartCard>

          <ChartCard title="Customers vs churners by age group" subtitle="Total customers and churners side by side">
            {failed('age') ? <LoadError /> : age.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={age} barGap={4} barCategoryGap="22%">
                  <CartesianGrid vertical={false} stroke={chart.grid} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: chart.axis }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: chart.axis }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={tip} cursor={false} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="total" name="Total customers" radius={[4, 4, 0, 0]} fill="#3b82f6" opacity={0.85} />
                  <Bar dataKey="churned" name="Churners" radius={[4, 4, 0, 0]} fill="#ef4444" opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState icon="chart" title="No age data" />}
          </ChartCard>
        </div>

        {/* Customers vs churners by tenure + by account nature */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <ChartCard title="Customers vs churners by tenure" subtitle="Total customers and churners side by side">
            {failed('tenure') ? <LoadError /> : tenure.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={[...tenure].sort((a, b) => {
                  const o = ['< 1 yr', '1-2 yrs', '3-4 yrs', '5-7 yrs', '8+ yrs']
                  return o.indexOf(a.name) - o.indexOf(b.name)
                })} barGap={4} barCategoryGap="22%">
                  <CartesianGrid vertical={false} stroke={chart.grid} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: chart.axis }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: chart.axis }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip content={tip} cursor={false} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="total" name="Total customers" radius={[4, 4, 0, 0]} fill="#3b82f6" opacity={0.85} />
                  <Bar dataKey="churned" name="Churners" radius={[4, 4, 0, 0]} fill="#ef4444" opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState icon="chart" title="No tenure data" />}
          </ChartCard>

          <ChartCard title="Customers vs churners by account nature" subtitle="Total customers and churners side by side">
            {failed('natureClient') ? <LoadError /> : natureClient.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={natureClient} layout="vertical" barGap={4} barCategoryGap="22%">
                  <CartesianGrid horizontal={false} stroke={chart.grid} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: chart.axis }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: chart.axis }} width={90} axisLine={false} tickLine={false} />
                  <Tooltip content={tip} cursor={false} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="total" name="Total customers" radius={[0, 4, 4, 0]} fill="#3b82f6" opacity={0.85} />
                  <Bar dataKey="churned" name="Churners" radius={[0, 4, 4, 0]} fill="#ef4444" opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState icon="chart" title="No account nature data" description="Column nature_client not found in dataset." />}
          </ChartCard>
        </div>
      </div>

      </div>{/* /exportable content */}

      {infoOpen && <ModelInfoModal confusion={confusion} kpis={kpis} onClose={() => setInfoOpen(false)} />}
    </div>
  )
}
