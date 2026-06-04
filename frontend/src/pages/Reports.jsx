import { useEffect, useState, useRef, useCallback } from 'react'
import { useLocation, Link } from 'react-router-dom'
import api from '../api/axios'
import EmptyState from '../components/EmptyState'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/uiStore'
import { riskLabel } from '../utils/format'

/* ── Copy button ────────────────────────────────────── */
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(String(text)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }
  return (
    <button onClick={copy} title="Copy"
      className="ml-1.5 text-gray-300 dark:text-gray-700 hover:text-gray-500 dark:hover:text-gray-400 transition-colors opacity-0 group-hover:opacity-100">
      {copied ? (
        <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
      ) : (
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
        </svg>
      )}
    </button>
  )
}

function ChurnPill({ val, labels }) {
  const isChurn = val === 1
  return (
    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
      isChurn
        ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800/50'
        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-500 border border-gray-200 dark:border-gray-700'
    }`}>
      {isChurn ? labels[0] : labels[1]}
    </span>
  )
}

const RISK_HIGH   = 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50'
const RISK_MEDIUM = 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50'
const RISK_LOW    = 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'

/* Solid risk colours (matches the Dashboard high-risk table) */
const RISK_COLOR = {
  'Élevé': '#ef4444', Moyen: '#f59e0b', Faible: '#22c55e',
  High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e',
  high: '#ef4444', medium: '#f59e0b', low: '#22c55e',
}

/* ── Table skeleton ─────────────────────────────────── */
function TableSkeleton() {
  return [...Array(8)].map((_, i) => (
    <tr key={i} className="border-b border-gray-50 dark:border-gray-800/60">
      <td className="px-4 py-3.5"><div className="flex items-center gap-2"><div className="shimmer h-4 w-20 rounded-md" /><div className="shimmer h-3.5 w-3.5 rounded-full" /></div></td>
      <td className="px-4 py-3.5"><div className="shimmer h-4 w-24 rounded-md" /></td>
      <td className="px-4 py-3.5"><div className="flex items-center gap-2"><div className="shimmer h-1.5 w-20 rounded-full" /><div className="shimmer h-4 w-8 rounded-md" /></div></td>
      <td className="px-4 py-3.5"><div className="shimmer h-5 w-16 rounded-full" /></td>
      <td className="px-4 py-3.5"><div className="shimmer h-5 w-16 rounded-full" /></td>
      <td className="px-4 py-3.5"><div className="shimmer h-5 w-12 rounded-full" /></td>
      <td className="px-4 py-3.5"></td>
    </tr>
  ))
}

/* Priority badge for a recommendation (matches the Prediction page) */
function PriorityBadge({ priority }) {
  if (!priority) return null
  const p = priority.toLowerCase()
  if (p === 'critical') return <span className="badge-high text-[10px]">CRITICAL</span>
  if (p === 'high')     return <span className="badge-high text-[10px]">HIGH</span>
  if (p === 'medium')   return <span className="badge-medium text-[10px]">MEDIUM</span>
  return <span className="badge-low text-[10px]">{priority.toUpperCase()}</span>
}

/* ── AI Retention Modal ─────────────────────────────── */
function STAT({ label, value, accent }) {
  return (
    <div className="rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-600">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${accent || 'text-gray-900 dark:text-gray-100'}`}>{value ?? '—'}</p>
    </div>
  )
}

function RetentionModal({ row, onClose }) {
  const [recs, setRecs] = useState([])
  const [phase, setPhase] = useState('idle')   // idle → loading → done | error
  const pct = row.probabilite_churn != null ? Math.round(row.probabilite_churn * 100) : null
  const [barW, setBarW] = useState(0)

  // Animate the probability bar after the modal mounts
  useEffect(() => {
    const t = setTimeout(() => setBarW(pct ?? 0), 120)
    return () => clearTimeout(t)
  }, [pct])

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  const generate = () => {
    setPhase('loading')
    setRecs([])
    api.get(`/customers/${encodeURIComponent(row.customer_no)}/recommendations${row.account_no != null ? `?account_no=${encodeURIComponent(row.account_no)}` : ''}`, { silent: true })
      .then(({ data }) => { setRecs(Array.isArray(data.recommendations) ? data.recommendations : []); setPhase('done') })
      .catch(() => setPhase('error'))
  }

  const riskColor = pct == null ? '#9ca3af' : pct >= 60 ? '#ef4444' : pct >= 30 ? '#f59e0b' : '#22c55e'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl shadow-modal border border-gray-200 dark:border-gray-800 animate-scale-in max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 flex items-center justify-center text-lg shrink-0">
              🤖
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI Retention Strategy</h3>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">Tailored to this customer's profile</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Customer snapshot */}
          <div>
            <div className="grid grid-cols-3 gap-2.5">
              <STAT label="Customer" value={`#${row.customer_no}`} />
              <STAT label="Account" value={row.account_no ?? '—'} />
              <STAT label="Risk" value={riskLabel(row.segment_risque)}
                accent={pct >= 60 ? 'text-red-500' : pct >= 30 ? 'text-amber-500' : 'text-emerald-500'} />
            </div>
            {/* Churn probability bar */}
            <div className="mt-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 px-3 py-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-600">Churn probability</span>
                <span className="text-sm font-bold tabular-nums" style={{ color: riskColor }}>{pct != null ? `${pct}%` : '—'}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${barW}%`, background: riskColor }} />
              </div>
            </div>
          </div>

          {/* Generate button / loading / result */}
          {phase === 'idle' && (
            <button
              onClick={generate}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-white
                         bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700
                         shadow-md hover:shadow-lg transition-all duration-200 hover:scale-[1.01] active:scale-[0.99]">
              <span className="text-base">✨</span>
              Generate recommendations
            </button>
          )}

          {phase === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-8 animate-fade-in">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 rounded-full border-2 border-blue-100 dark:border-blue-900/40" />
                <svg className="absolute inset-0 w-12 h-12 animate-spin text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-lg">🤖</span>
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Analysing this customer's profile…</p>
              <p className="text-xs text-gray-400 dark:text-gray-600">Generating tailored retention actions</p>
            </div>
          )}

          {phase === 'error' && (
            <div className="text-center py-6 animate-fade-in space-y-3">
              <p className="text-sm text-red-500 dark:text-red-400">Could not generate recommendations. Check your connection.</p>
              <button onClick={generate}
                className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Try again
              </button>
            </div>
          )}

          {phase === 'done' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-600">Recommended actions</p>
                <button onClick={generate} title="Regenerate"
                  className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-blue-500 transition-colors">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Regenerate
                </button>
              </div>
              {recs.length > 0 ? (
                recs.map((rec, i) => (
                  <div key={i}
                    className="animate-item-in flex items-start gap-3 p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-colors group"
                    style={{ animationDelay: `${i * 90}ms` }}>
                    <span className="text-lg shrink-0 mt-0.5">{rec.icon || '💡'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">{rec.title}</p>
                        {rec.category && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-600 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                            {rec.category}
                          </span>
                        )}
                        <PriorityBadge priority={rec.priority} />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-500 leading-relaxed group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">
                        {rec.detail}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-600 text-center py-4">
                  No specific recommendations for this customer.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-800 shrink-0 flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium rounded-xl text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Scheduled digest (UI + backend stub — no real email is sent) ──────── */
const FREQ_OPTS = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
]
const THRESHOLD_OPTS = [
  { id: 'high', label: 'High risk only' },
  { id: 'medium', label: 'Medium & high' },
  { id: 'all', label: 'All segments' },
]

function ScheduleDigest() {
  const [cfg, setCfg] = useState({ enabled: false, frequency: 'weekly', recipients: '', risk_threshold: 'high' })
  const [lastRun, setLastRun] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    let active = true
    api.get('/schedules/digest')
      .then(({ data }) => {
        if (!active) return
        setCfg({
          enabled: !!data.enabled,
          frequency: data.frequency || 'weekly',
          recipients: data.recipients || '',
          risk_threshold: data.risk_threshold || 'high',
        })
        setLastRun(data.last_run_at || null)
      })
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [])

  const set = (k, v) => setCfg(c => ({ ...c, [k]: v }))

  const save = async () => {
    setSaving(true)
    try {
      const { data } = await api.put('/schedules/digest', cfg)
      setLastRun(data.last_run_at || lastRun)
      toast.success('Schedule saved', cfg.enabled
        ? 'Digest preferences saved. Email delivery activates once SMTP is configured.'
        : 'Digest is turned off.')
    } catch {
      /* axios interceptor already shows an error toast */
    } finally {
      setSaving(false)
    }
  }

  const runPreview = async () => {
    setPreviewing(true)
    try {
      const { data } = await api.post('/schedules/digest/preview')
      setPreview(data)
      if (data.generated_at) setLastRun(data.generated_at)
      toast.info('Preview generated', data.message || 'No email was sent — preview only.')
    } catch {
      /* interceptor toast */
    } finally {
      setPreviewing(false)
    }
  }

  if (loading) {
    return (
      <div className="card p-6 space-y-3">
        <div className="shimmer h-4 w-48 rounded-md" />
        <div className="shimmer h-3 w-72 rounded-md" />
        <div className="shimmer h-10 w-full rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Stub notice */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl text-xs
                      bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50
                      text-amber-800 dark:text-amber-300">
        <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <span>
          <span className="font-semibold">Preview feature.</span> Preferences are saved, but no emails are actually
          sent and no background job runs yet. Delivery will be wired up once an email provider is connected.
        </span>
      </div>

      <div className="card p-6 space-y-5">
        {/* Enable toggle */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Scheduled risk digest</p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
              Send a recurring summary of at-risk customers to your team.
            </p>
          </div>
          <button type="button" role="switch" aria-checked={cfg.enabled}
            onClick={() => set('enabled', !cfg.enabled)}
            className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
              cfg.enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-700'
            }`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              cfg.enabled ? 'translate-x-5' : ''
            }`} />
          </button>
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${cfg.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Frequency</label>
            <select value={cfg.frequency} onChange={e => set('frequency', e.target.value)}
              className="input-field appearance-none cursor-pointer">
              {FREQ_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Include</label>
            <select value={cfg.risk_threshold} onChange={e => set('risk_threshold', e.target.value)}
              className="input-field appearance-none cursor-pointer">
              {THRESHOLD_OPTS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">Recipients</label>
            <input value={cfg.recipients} onChange={e => set('recipients', e.target.value)}
              placeholder="analyst@bank.com, manager@bank.com"
              className="input-field" />
            <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-1">Comma-separated email addresses.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button type="button" onClick={save} disabled={saving}
            className="btn-primary h-9 px-4 disabled:opacity-50">
            {saving ? 'Saving…' : 'Save schedule'}
          </button>
          <button type="button" onClick={runPreview} disabled={previewing}
            className="flex items-center gap-2 px-4 h-9 text-sm font-semibold rounded-xl
                       bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400
                       border border-blue-200 dark:border-blue-800/50
                       hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50 transition-colors">
            {previewing ? 'Generating…' : '✉️ Generate preview'}
          </button>
          {lastRun && (
            <span className="text-xs text-gray-400 dark:text-gray-600 tabular-nums">
              Last generated {new Date(lastRun).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* Preview summary */}
      {preview && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Digest preview</p>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full
                             bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
              Not sent
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total customers', value: preview.summary?.total_customers, color: '#3b82f6' },
              { label: 'High risk', value: preview.summary?.high_risk, color: '#ef4444' },
              { label: 'Medium risk', value: preview.summary?.medium_risk, color: '#f59e0b' },
              { label: 'Predicted churners', value: preview.summary?.predicted_churners, color: '#8b5cf6' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl p-3.5 text-center"
                style={{ background: `${color}10`, border: `1.5px solid ${color}25` }}>
                <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: `${color}cc` }}>{label}</p>
                <p className="text-xl font-bold tabular-nums" style={{ color }}>{(value ?? 0).toLocaleString()}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-4">
            {preview.message}
            {cfg.recipients && <> Would be sent to: <span className="font-medium text-gray-700 dark:text-gray-300">{cfg.recipients}</span>.</>}
          </p>
        </div>
      )}
    </div>
  )
}

export default function Reports() {
  const location = useLocation()
  const { user } = useAuthStore()
  const isSuperAdmin = user?.role === 'super_admin'

  // ── Tab state ──────────────────────────────────────────────────────────────
  const [tab, setTab] = useState('batch')

  // ── Batch Results state ────────────────────────────────────────────────────
  const [data, setData] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [riskFilter, setRiskFilter] = useState(() => location.state?.riskFilter || '')
  const [loading, setLoading] = useState(true)
  const [retentionRow, setRetentionRow] = useState(null)
  const [exporting, setExporting] = useState(false)
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchMsg, setBatchMsg] = useState('')
  const fileRef = useRef(null)
  const PAGE = 50

  // ── Prediction History state ───────────────────────────────────────────────
  const [histItems, setHistItems] = useState([])
  const [histTotal, setHistTotal] = useState(0)
  const [histPage, setHistPage] = useState(0)
  const [histRisk, setHistRisk] = useState('')
  const [histDateFrom, setHistDateFrom] = useState('')
  const [histDateTo, setHistDateTo] = useState('')
  const [histLoading, setHistLoading] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [histExporting, setHistExporting] = useState(false)
  const HIST_PAGE = 20

  // ── Batch fetch ─────────────────────────────────────────────────────────────
  const fetchData = async (p = 0, risk = riskFilter) => {
    setLoading(true)
    try {
      const ps = new URLSearchParams({ limit: PAGE, offset: p * PAGE })
      if (risk) ps.append('risk', risk)
      const { data: res } = await api.get(`/reports/predictions?${ps}`)
      setData(res.data); setTotal(res.total)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchData(0, riskFilter); setPage(0) }, [riskFilter])

  const go = (dir) => { const n = page + dir; setPage(n); fetchData(n) }

  // ── Batch export ────────────────────────────────────────────────────────────
  const exportCSV = async () => {
    setExporting(true)
    try {
      const res = await api.get(`/reports/export-csv${riskFilter ? `?risk=${riskFilter}` : ''}`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
      Object.assign(document.createElement('a'), { href: url, download: 'churn_predictions.csv' }).click()
      URL.revokeObjectURL(url)
    } catch (e) { console.error(e) }
    finally { setExporting(false) }
  }

  // ── Batch upload ────────────────────────────────────────────────────────────
  const onBatch = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setBatchLoading(true); setBatchMsg('')
    try {
      const form = new FormData(); form.append('file', file)
      const res = await api.post('/reports/batch-predict', form, { responseType: 'blob', headers: { 'Content-Type': 'multipart/form-data' } })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
      Object.assign(document.createElement('a'), { href: url, download: 'batch_predictions.csv' }).click()
      URL.revokeObjectURL(url)
      setBatchMsg('success')
    } catch { setBatchMsg('error') }
    finally { setBatchLoading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  // ── History fetch ───────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async (p = 0, risk = histRisk, from = histDateFrom, to = histDateTo) => {
    setHistLoading(true)
    try {
      const ps = new URLSearchParams({ page: p, page_size: HIST_PAGE })
      if (risk) ps.append('risk_level', risk)
      if (from) ps.append('date_from', from)
      if (to)   ps.append('date_to', to)
      const { data: res } = await api.get(`/predict/history?${ps}`)
      setHistItems(res.items || [])
      setHistTotal(res.total || 0)
    } catch { setHistItems([]); setHistTotal(0) }
    finally { setHistLoading(false) }
  }, [histRisk, histDateFrom, histDateTo])

  useEffect(() => {
    if (tab === 'history') { setHistPage(0); fetchHistory(0) }
  }, [tab, histRisk, histDateFrom, histDateTo])

  const goHist = (dir) => {
    const n = histPage + dir
    setHistPage(n)
    fetchHistory(n)
  }

  // ── History export (PDF) ─────────────────────────────────────────────────────
  const exportHistoryPDF = async () => {
    setHistExporting(true)
    try {
      // Fetch all rows matching the current filters
      const ps = new URLSearchParams({ page: 0, page_size: 1000 })
      if (histRisk)     ps.append('risk_level', histRisk)
      if (histDateFrom) ps.append('date_from', histDateFrom)
      if (histDateTo)   ps.append('date_to', histDateTo)
      const { data: res } = await api.get(`/predict/history?${ps}`, { silent: true })
      const rows = res.items || []

      const { default: jsPDF } = await import('jspdf')
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const pageH = pdf.internal.pageSize.getHeight()

      pdf.setFontSize(15); pdf.setFont('helvetica', 'bold')
      pdf.text('Prediction History', 14, 15)
      pdf.setFontSize(9); pdf.setFont('helvetica', 'normal'); pdf.setTextColor(120)
      const filterTxt = [histRisk && `Risk: ${histRisk}`, histDateFrom && `From ${histDateFrom}`, histDateTo && `To ${histDateTo}`].filter(Boolean).join('  ·  ') || 'All records'
      pdf.text(`${filterTxt}  ·  ${rows.length} record(s)  ·  generated ${new Date().toLocaleString()}`, 14, 21)

      // Column layout
      const cols = [
        { h: 'Date & Time', w: 50 },
        { h: 'Admin',       w: 45 },
        { h: 'Customer',    w: 35 },
        { h: 'Churn %',     w: 25 },
        { h: 'Risk',        w: 30 },
        { h: 'Confidence',  w: 40 },
      ]
      let x0 = 14, y = 30
      const drawHeader = () => {
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); pdf.setTextColor(255)
        pdf.setFillColor(59, 130, 246)
        pdf.rect(x0, y, cols.reduce((s, c) => s + c.w, 0), 7, 'F')
        let cx = x0
        cols.forEach(c => { pdf.text(c.h, cx + 2, y + 5); cx += c.w })
        y += 7
        pdf.setFont('helvetica', 'normal'); pdf.setTextColor(40)
      }
      drawHeader()

      rows.forEach((it, i) => {
        if (y > pageH - 12) { pdf.addPage(); y = 18; drawHeader() }
        if (i % 2 === 0) { pdf.setFillColor(245, 247, 250); pdf.rect(x0, y, cols.reduce((s, c) => s + c.w, 0), 6.5, 'F') }
        const pct = it.churn_prob != null ? `${Math.round(it.churn_prob * 100)}%` : '—'
        const cells = [
          it.created_at ? new Date(it.created_at).toLocaleString() : '—',
          it.admin_name || '—',
          String(it.customer_data?.customer_no ?? '—'),
          pct,
          it.risk_level || '—',
          it.confidence || '—',
        ]
        pdf.setFontSize(8); pdf.setTextColor(40)
        let cx = x0
        cells.forEach((txt, ci) => {
          pdf.text(String(txt).slice(0, 32), cx + 2, y + 4.5)
          cx += cols[ci].w
        })
        y += 6.5
      })

      pdf.save('prediction_history.pdf')
    } catch (e) { console.error(e) }
    finally { setHistExporting(false) }
  }

  // ── History export (CSV) ─────────────────────────────────────────────────────
  const exportHistoryCSV = async () => {
    setHistExporting(true)
    try {
      const ps = new URLSearchParams()
      if (histRisk)     ps.append('risk_level', histRisk)
      if (histDateFrom) ps.append('date_from', histDateFrom)
      if (histDateTo)   ps.append('date_to', histDateTo)
      const res = await api.get(`/predict/history/export-csv?${ps}`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
      Object.assign(document.createElement('a'), { href: url, download: 'prediction_history.csv' }).click()
      URL.revokeObjectURL(url)
    } catch (e) { console.error(e) }
    finally { setHistExporting(false) }
  }

  // ── History delete ──────────────────────────────────────────────────────────
  const deleteHistItem = async (id) => {
    setDeletingId(id)
    try {
      await api.delete(`/predict/history/${id}`)
      setHistItems(prev => prev.filter(r => r.id !== id))
      setHistTotal(t => t - 1)
    } catch (e) { console.error(e) }
    finally { setDeletingId(null) }
  }

  const pages = Math.ceil(total / PAGE)
  const histPages = Math.ceil(histTotal / HIST_PAGE)

  const RISK_BADGE_HIST = {
    High: RISK_HIGH, Medium: RISK_MEDIUM, Low: RISK_LOW,
    high: RISK_HIGH, medium: RISK_MEDIUM, low: RISK_LOW,
    'Élevé': RISK_HIGH, Moyen: RISK_MEDIUM, Faible: RISK_LOW,
  }

  return (
    <div className="space-y-5 w-full">

      {/* Tab strip */}
      <div className="flex gap-1 p-1 rounded-xl bg-gray-100 dark:bg-gray-800/60 w-fit">
        {[
          { id: 'batch', label: 'Batch Results' },
          { id: 'history', label: 'Prediction History' },
          { id: 'schedule', label: 'Schedule' },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={[
              'px-4 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150',
              tab === id
                ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
            ].join(' ')}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Batch Results tab ──────────────────────────────────────────────── */}
      {tab === 'batch' && (
        <>
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl cursor-pointer appearance-none
                         bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800
                         text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all">
              <option value="">All risk levels</option>
              <option value="high">High risk</option>
              <option value="medium">Medium risk</option>
              <option value="low">Low risk</option>
            </select>

            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs
                            text-gray-500 dark:text-gray-500 bg-white dark:bg-gray-900
                            border border-gray-200 dark:border-gray-800">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16"/>
              </svg>
              <span className="tabular-nums">{total.toLocaleString()}</span> records
            </div>

            <div className="ml-auto">
              <button onClick={exportCSV} disabled={exporting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200
                           bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400
                           border border-emerald-200 dark:border-emerald-800/50
                           hover:bg-emerald-100 dark:hover:bg-emerald-900/30 disabled:opacity-50">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                {exporting ? 'Exporting…' : 'Export CSV'}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="text-gray-400 dark:text-gray-600 text-[11px] uppercase tracking-wide border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left font-semibold py-2.5 px-4">Customer</th>
                    <th className="text-left font-semibold py-2.5 px-4">Account</th>
                    <th className="text-left font-semibold py-2.5 px-4">Churn risk</th>
                    <th className="text-left font-semibold py-2.5 px-4">Risk level</th>
                    <th className="text-left font-semibold py-2.5 px-4 hidden sm:table-cell">Actual</th>
                    <th className="text-left font-semibold py-2.5 px-4 hidden sm:table-cell">Predicted</th>
                    <th className="py-2.5 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <TableSkeleton />
                  ) : data.length === 0 ? (
                    <tr>
                      <td colSpan={7}>
                        <EmptyState
                          icon="prediction"
                          title="No predictions found"
                          description={riskFilter ? `No ${{ 'Élevé': 'high', Moyen: 'medium', Faible: 'low' }[riskFilter] ?? riskFilter.toLowerCase()} risk customers in the current dataset.` : "Connect the database to see prediction history."}
                          action={riskFilter ? () => setRiskFilter('') : undefined}
                          actionLabel={riskFilter ? 'Clear filter' : undefined}
                        />
                      </td>
                    </tr>
                  ) : (
                    data.map((row, i) => {
                      const riskColor = RISK_COLOR[row.segment_risque] || '#9ca3af'
                      const pct = row.probabilite_churn != null ? Math.round(row.probabilite_churn * 100) : null
                      const acct = row.account_no != null ? `?account=${encodeURIComponent(row.account_no)}` : ''
                      const profileUrl = `/customers/${encodeURIComponent(row.customer_no)}${acct}`
                      return (
                        <tr key={`${row.customer_no}-${i}`}
                          className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors group">
                          {/* Customer — click to open the full profile */}
                          <td className="py-2.5 px-4">
                            <div className="flex items-center">
                              <Link to={profileUrl}
                                className="font-semibold text-blue-600 dark:text-blue-400 hover:underline tabular-nums">
                                {row.customer_no}
                              </Link>
                              <CopyButton text={row.customer_no} />
                            </div>
                          </td>
                          {/* Account */}
                          <td className="py-2.5 px-4">
                            <div className="flex items-center font-mono text-xs text-gray-500 dark:text-gray-500">
                              {row.account_no}
                              <CopyButton text={row.account_no} />
                            </div>
                          </td>
                          {/* Churn risk — bar + colour-coded % */}
                          <td className="py-2.5 px-4">
                            {pct == null ? <span className="text-gray-400">—</span> : (
                              <div className="flex items-center gap-2">
                                <div className="w-14 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 hidden lg:block">
                                  <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: riskColor }} />
                                </div>
                                <span className="font-semibold tabular-nums" style={{ color: riskColor }}>{pct}%</span>
                              </div>
                            )}
                          </td>
                          {/* Risk level — solid pill (Dashboard style) */}
                          <td className="py-2.5 px-4">
                            {row.segment_risque ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
                                style={{ background: riskColor }}>
                                {riskLabel(row.segment_risque)}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="py-2.5 px-4 hidden sm:table-cell"><ChurnPill val={row.churn_reel} labels={['Churned', 'Retained']} /></td>
                          <td className="py-2.5 px-4 hidden sm:table-cell"><ChurnPill val={row.churn_predit} labels={['Churn', 'Stay']} /></td>
                          {/* Actions — retention strategy + open-profile chevron */}
                          <td className="py-2.5 px-4">
                            <div className="flex items-center justify-end gap-2">
                              {row.segment_risque && (
                                <button onClick={() => setRetentionRow(row)}
                                  title="View retention strategy"
                                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg
                                             bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400
                                             border border-blue-200 dark:border-blue-800/50
                                             hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
                                  🤖 Strategy
                                </button>
                              )}
                              <Link to={profileUrl} title="Open full profile"
                                className="text-gray-300 dark:text-gray-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
                                <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                </svg>
                              </Link>
                            </div>
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
                <span className="text-xs text-gray-500 dark:text-gray-500">Page {page + 1} of {pages}</span>
                <div className="flex gap-2">
                  {[{ dir: -1, label: '← Prev', dis: page === 0 }, { dir: 1, label: 'Next →', dis: page >= pages - 1 }].map(({ dir, label, dis }) => (
                    <button key={label} onClick={() => go(dir)} disabled={dis}
                      className="px-3 py-1.5 text-xs rounded-xl transition-all duration-200 disabled:opacity-30
                                 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800
                                 border border-gray-200 dark:border-gray-700">
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {retentionRow && <RetentionModal row={retentionRow} onClose={() => setRetentionRow(null)} />}

          {/* Batch prediction upload */}
          <div className="card p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/50">
                📂
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">Batch prediction</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
                  Upload a CSV with customer data — results download automatically. Expected columns:{' '}
                  <code className="px-1.5 py-0.5 rounded text-[11px] font-mono text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                    customer_no, account_no, age, tenure, acct_balance, …
                  </code>
                </p>
                <div className="flex items-center gap-4">
                  <label className={`relative flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer select-none
                                   bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400
                                   border border-violet-200 dark:border-violet-800/50
                                   hover:bg-violet-100 dark:hover:bg-violet-900/30
                                   ${batchLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {batchLoading ? (
                      <><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Processing…</>
                    ) : (
                      <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>Choose CSV file</>
                    )}
                    <input ref={fileRef} type="file" accept=".csv" className="hidden" disabled={batchLoading} onChange={onBatch} />
                  </label>
                  {batchMsg === 'success' && <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>Results downloaded</p>}
                  {batchMsg === 'error' && <p className="text-sm font-medium text-red-600 dark:text-red-400 flex items-center gap-1.5"><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>Upload failed</p>}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Prediction History tab ─────────────────────────────────────────── */}
      {tab === 'history' && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <select value={histRisk} onChange={e => setHistRisk(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl cursor-pointer appearance-none
                         bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800
                         text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all">
              <option value="">All risk levels</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <div className="flex items-center gap-2">
              <input type="date" value={histDateFrom} onChange={e => setHistDateFrom(e.target.value)}
                className="px-2.5 py-2 text-xs rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
              <span className="text-xs text-gray-400">→</span>
              <input type="date" value={histDateTo} onChange={e => setHistDateTo(e.target.value)}
                className="px-2.5 py-2 text-xs rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>

            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-gray-500 dark:text-gray-500 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <span className="tabular-nums">{histTotal.toLocaleString()}</span> records
            </div>

            <div className="ml-auto flex gap-2">
              {(histRisk || histDateFrom || histDateTo) && (
                <button onClick={() => { setHistRisk(''); setHistDateFrom(''); setHistDateTo('') }}
                  className="px-3 py-2 text-xs font-semibold rounded-xl text-gray-500 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  Clear filters
                </button>
              )}
              <button onClick={exportHistoryCSV} disabled={histExporting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl
                           bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400
                           border border-emerald-200 dark:border-emerald-800/50
                           hover:bg-emerald-100 dark:hover:bg-emerald-900/30 disabled:opacity-50 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
                {histExporting ? 'Exporting…' : 'Export CSV'}
              </button>
              <button onClick={exportHistoryPDF} disabled={histExporting}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl
                           bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400
                           border border-red-200 dark:border-red-800/50
                           hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-50 transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                {histExporting ? 'Exporting…' : 'Export PDF'}
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    {['Date & Time', 'Admin', 'Customer No', 'Churn Prob', 'Risk', 'Confidence', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-500 tracking-wide uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
                  {histLoading ? (
                    <TableSkeleton />
                  ) : histItems.length === 0 ? (
                    <tr><td colSpan={7}>
                      <EmptyState icon="prediction" title="No prediction history" description="Predictions will be saved here automatically when you run them." />
                    </td></tr>
                  ) : (
                    histItems.map((item) => {
                      const riskBadge = RISK_BADGE_HIST[item.risk_level]
                      const custNo = item.customer_data?.customer_no ?? '—'
                      const isExpanded = expandedId === item.id
                      const pct = item.churn_prob != null ? Math.round(item.churn_prob * 100) : null
                      const probColor = pct != null ? (pct >= 60 ? '#ef4444' : pct >= 30 ? '#f59e0b' : '#22c55e') : '#9ca3af'

                      return (
                        <>
                          <tr key={item.id}
                            className="hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer transition-colors group"
                            onClick={() => setExpandedId(isExpanded ? null : item.id)}>
                            <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 tabular-nums">
                              {item.created_at ? new Date(item.created_at).toLocaleString() : '—'}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">
                              {item.admin_name || '—'}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                              {custNo}
                            </td>
                            <td className="px-4 py-3">
                              {pct != null ? (
                                <div className="flex items-center gap-2">
                                  <div className="w-16 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                                    <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: probColor }} />
                                  </div>
                                  <span className="text-xs font-semibold tabular-nums" style={{ color: probColor }}>{pct}%</span>
                                </div>
                              ) : <span className="text-gray-400 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              {riskBadge ? (
                                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${riskBadge}`}>
                                  {item.risk_level}
                                </span>
                              ) : <span className="text-gray-400 text-xs">{item.risk_level || '—'}</span>}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-500">
                              {item.confidence || '—'}
                            </td>
                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                                  className="px-2 py-1 text-[11px] font-semibold rounded-lg text-gray-500 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                                  {isExpanded ? '▴' : '▾'}
                                </button>
                                {isSuperAdmin && (
                                  <button
                                    onClick={() => deleteHistItem(item.id)}
                                    disabled={deletingId === item.id}
                                    className="px-2 py-1 text-[11px] font-semibold rounded-lg text-red-500 border border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-40"
                                    title="Delete record">
                                    {deletingId === item.id ? '…' : '✕'}
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr key={`${item.id}-detail`} className="bg-gray-50 dark:bg-gray-800/30">
                              <td colSpan={7} className="px-6 py-4">
                                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-3">Customer snapshot at time of prediction</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-2">
                                  {Object.entries(item.customer_data || {}).filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                                    <div key={k}>
                                      <p className="text-[10px] text-gray-400 dark:text-gray-600 uppercase tracking-wide font-medium">{k.replace(/_/g, ' ')}</p>
                                      <p className="text-xs text-gray-700 dark:text-gray-300 font-medium mt-0.5">{String(v)}</p>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {histPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-800">
                <span className="text-xs text-gray-500 dark:text-gray-500">Page {histPage + 1} of {histPages}</span>
                <div className="flex gap-2">
                  {[{ dir: -1, label: '← Prev', dis: histPage === 0 }, { dir: 1, label: 'Next →', dis: histPage >= histPages - 1 }].map(({ dir, label, dis }) => (
                    <button key={label} onClick={() => goHist(dir)} disabled={dis}
                      className="px-3 py-1.5 text-xs rounded-xl transition-all disabled:opacity-30 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Schedule tab ────────────────────────────────────────────────────── */}
      {tab === 'schedule' && <ScheduleDigest />}

    </div>
  )
}
