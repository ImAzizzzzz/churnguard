import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'
import SearchableSelect from '../components/SearchableSelect'
import { usePermissions } from '../hooks/usePermissions'
import { riskLabel } from '../utils/format'
import { exportElementToPDF } from '../utils/pdf'
import { toast } from '../store/uiStore'

/** Convert decimal years to "X yrs Y mo" display string */
function formatYMD(decimalYears) {
  const n = Number(decimalYears)
  if (!n || isNaN(n)) return ''
  const totalMonths = Math.round(n * 12)
  const y = Math.floor(totalMonths / 12)
  const m = totalMonths % 12
  if (y === 0) return `${m} mo`
  if (m === 0) return `${y} yr${y !== 1 ? 's' : ''}`
  return `${y} yr${y !== 1 ? 's' : ''} ${m} mo`
}

const riskCfg = {
  high:   { color: '#ef4444', bgClass: 'bg-red-50 dark:bg-red-900/10',    borderClass: 'border-red-200 dark:border-red-800/40',   badgeCls: 'badge-high',   label: 'HIGH RISK'   },
  medium: { color: '#f59e0b', bgClass: 'bg-amber-50 dark:bg-amber-900/10', borderClass: 'border-amber-200 dark:border-amber-800/40', badgeCls: 'badge-medium', label: 'MEDIUM RISK' },
  low:    { color: '#22c55e', bgClass: 'bg-emerald-50 dark:bg-emerald-900/10', borderClass: 'border-emerald-200 dark:border-emerald-800/40', badgeCls: 'badge-low', label: 'LOW RISK' },
}

const EMPTY = {
  age: '', tenure: '', acct_balance: '', partyclass: '', industry: '',
  marital_status: '', score_kyc: '', nature_client: '', lob: '',
  currency: '', account_status: '', account_category: '', accountnature: '',
}

const DEMO_DATA = {
  age: '45', tenure: '2', acct_balance: '8500', partyclass: 'PPH', score_kyc: 'MR',
  account_status: 'Dormant', industry: '', marital_status: '',
  nature_client: '', lob: '', currency: '', account_category: '', accountnature: '',
}

/* ── Gauge ──────────────────────────────────────────── */
function GaugeChart({ probability }) {
  const pct = Math.round(probability * 100)
  const angle = -90 + 180 * probability
  const color = probability >= 0.6 ? '#ef4444' : probability >= 0.3 ? '#f59e0b' : '#22c55e'
  const arcLen = 251.2 * probability

  // Tick mark helper: convert pct [0..1] on the semicircle to SVG coords
  const tick = (p) => {
    const a = (-90 + 180 * p) * Math.PI / 180
    const r1 = 73, r2 = 87
    return {
      x1: 100 + r1 * Math.cos(a), y1: 100 + r1 * Math.sin(a),
      x2: 100 + r2 * Math.cos(a), y2: 100 + r2 * Math.sin(a),
    }
  }
  const ticks = [
    { p: 0,   label: '0%',  lx: 14, ly: 104 },
    { p: 0.3, label: '30%', lx: 42, ly: 44  },
    { p: 0.6, label: '60%', lx: 124, ly: 24 },
    { p: 1,   label: '100%', lx: 172, ly: 104 },
  ]

  return (
    <div className="flex flex-col items-center py-2">
      <svg width="210" height="125" viewBox="0 0 210 125">
        {/* Track */}
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#e5e7eb" className="dark:stroke-gray-800" strokeWidth="14" strokeLinecap="round" />
        {/* Fill */}
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
          strokeDasharray={`${arcLen} 251.2`}
          style={{ transition: 'stroke-dasharray 1s cubic-bezier(0.34,1.56,0.64,1)', filter: `drop-shadow(0 0 6px ${color}90)` }} />
        {/* Tick marks */}
        {ticks.map(({ p, label, lx, ly }) => {
          const t = tick(p)
          return (
            <g key={p}>
              <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
                stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" />
              <text x={lx} y={ly} textAnchor="middle" fontSize="8.5" fill="#9ca3af" fontWeight="500">{label}</text>
            </g>
          )
        })}
        {/* Needle */}
        <line x1="100" y1="100"
          x2={100 + 62 * Math.cos((angle * Math.PI) / 180)}
          y2={100 + 62 * Math.sin((angle * Math.PI) / 180)}
          stroke={color} strokeWidth="2.5" strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 4px ${color})`, transition: 'all 1s cubic-bezier(0.34,1.56,0.64,1)' }} />
        <circle cx="100" cy="100" r="5" fill={color} style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
        <circle cx="100" cy="100" r="2" fill="white" />
        {/* Value label */}
        <text x="100" y="84" textAnchor="middle" fontSize="28" fontWeight="700" fill={color}>{pct}%</text>
      </svg>
      <div className="flex justify-between w-44 text-[10px] text-gray-400 dark:text-gray-600 font-medium -mt-2">
        <span>LOW</span><span>MED</span><span>HIGH</span>
      </div>
    </div>
  )
}

/* ── SHAP bars ──────────────────────────────────────── */
function SHAPBar({ name, value }) {
  const pos = value > 0
  const w = Math.min(Math.abs(value) * 280, 100)
  return (
    <div className="flex items-center gap-3 py-1.5 group">
      <span className="text-xs text-gray-500 dark:text-gray-500 w-28 text-right truncate group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">{name}</span>
      <div className="flex-1 flex items-center gap-0.5">
        <div className="flex justify-end" style={{ width: '50%' }}>
          {!pos && <div className="h-4 rounded-l-sm bg-emerald-500 opacity-80" style={{ width: `${w}%`, transition: 'width 0.6s cubic-bezier(0.34,1.56,0.64,1)' }} />}
        </div>
        <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
        <div style={{ width: '50%' }}>
          {pos && <div className="h-4 rounded-r-sm bg-red-500 opacity-80" style={{ width: `${w}%`, transition: 'width 0.6s cubic-bezier(0.34,1.56,0.64,1)' }} />}
        </div>
      </div>
      <span className={`text-xs font-semibold w-14 text-right ${pos ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
        {pos ? '+' : ''}{value.toFixed(3)}
      </span>
    </div>
  )
}

/* ── Validated field ────────────────────────────────── */
function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
      {error && (
        <p className="mt-1 text-[11px] text-red-600 dark:text-red-400 flex items-center gap-1">
          <svg className="w-3 h-3 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/></svg>
          {error}
        </p>
      )}
    </div>
  )
}

/* ── Customer lookup ────────────────────────────────── */
function CustomerLookup({ onSelect }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const debounceRef = useRef()

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = useCallback((q) => {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) { setResults([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const { data } = await api.get(`/customers/search?q=${encodeURIComponent(q)}&page=0&page_size=8`)
        const list = data.customers || []
        setResults(list)
        setOpen(list.length > 0)
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 300)
  }, [])

  const RISK_COLOR = {
    'Élevé': 'text-red-600 dark:text-red-400', Moyen: 'text-amber-600 dark:text-amber-400', Faible: 'text-emerald-600 dark:text-emerald-400',
    High: 'text-red-600 dark:text-red-400', Medium: 'text-amber-600 dark:text-amber-400', Low: 'text-emerald-600 dark:text-emerald-400',
    high: 'text-red-600 dark:text-red-400', medium: 'text-amber-600 dark:text-amber-400', low: 'text-emerald-600 dark:text-emerald-400',
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <input value={query} onChange={e => search(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search customer by number, nationality, segment — auto-fills form"
          className="input-field pl-9 pr-8"
        />
        {searching && (
          <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
        )}
      </div>

      {open && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-card-md overflow-hidden">
          {results.map((r, i) => (
            <button key={i} type="button"
              onClick={() => { onSelect(r); setQuery(''); setOpen(false); setResults([]) }}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-50 dark:border-gray-800/50 last:border-0">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Customer #{r.customer_no}</p>
                <p className="text-xs text-gray-400 dark:text-gray-600">Account {r.account_no}</p>
              </div>
              <div className="text-right">
                <p className={`text-xs font-semibold ${RISK_COLOR[r.segment_risque] || ''}`}>{riskLabel(r.segment_risque)}</p>
                <p className="text-xs text-gray-400 dark:text-gray-600">{r.probabilite_churn != null ? `${Math.round(r.probabilite_churn * 100)}%` : ''}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}


/* ── Copy result button ─────────────────────────────── */
function CopyResultButton({ result }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    const topRec = result.recommendations?.[0]
    const text = [
      `Churn Probability: ${Math.round(result.churn_probability * 100)}%`,
      `Risk Level: ${result.risk_level?.toUpperCase()}`,
      `Confidence: ${result.confidence}`,
      topRec ? `Top Recommendation: ${topRec.title} — ${topRec.detail}` : '',
    ].filter(Boolean).join('\n')

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button onClick={copy}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg
                 text-gray-500 dark:text-gray-500 border border-gray-200 dark:border-gray-700
                 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300 transition-all">
      {copied ? (
        <>
          <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
          Copied!
        </>
      ) : (
        <>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
          </svg>
          Copy Result
        </>
      )}
    </button>
  )
}

/* ── What-if simulator ──────────────────────────────── */
const SIM_STATUS = ['Active', 'Dormant', 'Closed']
const SIM_KYC = [
  { value: 'LR', label: 'LR — Low Risk' },
  { value: 'MR', label: 'MR — Medium Risk' },
  { value: 'H1', label: 'H1 — High Risk (T1)' },
  { value: 'H2', label: 'H2 — High Risk (T2)' },
  { value: 'H3', label: 'H3 — High Risk (T3)' },
]

function WhatIfSimulator({ baseForm, baseProb }) {
  // Local scenario copy seeded from the predicted profile
  const [scenario, setScenario] = useState(baseForm)
  const [simProb, setSimProb] = useState(null)
  const [simResult, setSimResult] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // Reset whenever a new baseline prediction is made
  useEffect(() => {
    setScenario(baseForm)
    setSimProb(null)
    setSimResult(null)
    setErr('')
  }, [baseForm])

  const setS = (k, v) => setScenario(s => ({ ...s, [k]: v }))

  const dirty = Object.keys(scenario).some(k => String(scenario[k] ?? '') !== String(baseForm[k] ?? ''))

  const runScenario = async () => {
    setBusy(true); setErr('')
    try {
      const payload = Object.fromEntries(
        Object.entries(scenario).map(([k, v]) => [k, v === '' ? null : isNaN(v) ? v : Number(v)])
      )
      const { data } = await api.post('/predict/', payload, { silent: true })
      setSimProb(data.churn_probability)
      setSimResult(data)
    } catch {
      setErr('Could not run the scenario. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setScenario(baseForm)
    setSimProb(null)
    setSimResult(null)
    setErr('')
  }

  const delta = simProb != null ? simProb - baseProb : null
  const deltaPts = delta != null ? Math.round(delta * 100) : null
  const better = delta != null && delta < 0
  const same = deltaPts === 0

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-0.5">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">🔮 What-if simulator</p>
        {dirty && (
          <button type="button" onClick={reset}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
            ↺ Reset
          </button>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
        Adjust key drivers and re-score to see how churn risk would change vs the baseline ({Math.round(baseProb * 100)}%).
      </p>

      <div className="space-y-3">
        {/* Tenure slider */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Tenure (yrs)</label>
            <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{scenario.tenure ? formatYMD(scenario.tenure) : '0'}</span>
          </div>
          <input type="range" min="0" max="30" step="1"
            value={Number(scenario.tenure) || 0}
            onChange={e => setS('tenure', e.target.value)}
            className="w-full accent-blue-500" />
        </div>

        {/* Balance slider */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Account balance</label>
            <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
              {Number(scenario.acct_balance || 0).toLocaleString()}
            </span>
          </div>
          <input type="range" min="0" max="200000" step="500"
            value={Number(scenario.acct_balance) || 0}
            onChange={e => setS('acct_balance', e.target.value)}
            className="w-full accent-blue-500" />
        </div>

        {/* Age slider */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Age</label>
            <span className="text-xs font-semibold text-gray-900 dark:text-gray-100 tabular-nums">{scenario.age || 0}</span>
          </div>
          <input type="range" min="18" max="90" step="1"
            value={Number(scenario.age) || 18}
            onChange={e => setS('age', e.target.value)}
            className="w-full accent-blue-500" />
        </div>

        {/* Status + KYC selects */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Account status</label>
            <select value={scenario.account_status || ''} onChange={e => setS('account_status', e.target.value)}
              className="input-field appearance-none cursor-pointer text-sm py-1.5">
              <option value="">—</option>
              {SIM_STATUS.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">KYC score</label>
            <select value={scenario.score_kyc || ''} onChange={e => setS('score_kyc', e.target.value)}
              className="input-field appearance-none cursor-pointer text-sm py-1.5">
              <option value="">—</option>
              {SIM_KYC.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {err && <p className="mt-3 text-[11px] text-red-600 dark:text-red-400">{err}</p>}

      <button type="button" onClick={runScenario} disabled={busy || !dirty}
        className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold
                   bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400
                   border border-blue-200 dark:border-blue-800/50
                   hover:bg-blue-100 dark:hover:bg-blue-900/30 disabled:opacity-50 transition-colors">
        {busy ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Re-scoring…
          </>
        ) : dirty ? 'Run scenario' : 'Adjust a value to simulate'}
      </button>

      {/* Result delta */}
      {simProb != null && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl p-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-600 mb-1">Baseline</p>
            <p className="text-lg font-bold text-gray-700 dark:text-gray-300 tabular-nums">{Math.round(baseProb * 100)}%</p>
          </div>
          <div className="rounded-xl p-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-600 mb-1">Scenario</p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums">{Math.round(simProb * 100)}%</p>
          </div>
          <div className="rounded-xl p-3 border"
            style={{
              background: same ? 'rgba(148,163,184,0.08)' : better ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
              borderColor: same ? 'rgba(148,163,184,0.25)' : better ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)',
            }}>
            <p className="text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-600 mb-1">Change</p>
            <p className="text-lg font-bold tabular-nums"
              style={{ color: same ? '#94a3b8' : better ? '#16a34a' : '#dc2626' }}>
              {same ? '±0' : `${deltaPts > 0 ? '+' : ''}${deltaPts}`} pts
            </p>
          </div>
        </div>
      )}

      {simResult?.demo && simProb != null && (
        <p className="mt-3 text-[11px] text-amber-600 dark:text-amber-400 leading-snug">
          Demo mode: no model is loaded, so scenario scores are randomly generated — deltas are illustrative only.
        </p>
      )}
    </div>
  )
}

/* ── Animated gradient border ───────────────────────── */
function GradientBorderCard({ color, bgClass, children }) {
  return (
    <div className="relative rounded-2xl p-px overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${color}60, transparent 40%, ${color}40, transparent 70%, ${color}50)` }}>
      <div className={`rounded-2xl p-6 ${bgClass}`}>
        {children}
      </div>
    </div>
  )
}

/* ── Main component ─────────────────────────────────── */
export default function Predict() {
  const [form, setForm] = useState(EMPTY)
  const [predictedForm, setPredictedForm] = useState(EMPTY)
  const [touched, setTouched] = useState({})
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedNotice, setSavedNotice] = useState(false)
  const [fillBanner, setFillBanner] = useState('')
  const [fillBannerTimer, setFillBannerTimer] = useState(null)
  const [options, setOptions] = useState({
    nature_clients: [], account_categories: [], industries: [], lobs: [],
    partyclasses: [], currencies: [], account_statuses: [],
  })
  const [recsVisible, setRecsVisible] = useState(false)
  const [recsLoading, setRecsLoading] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const resultRef = useRef(null)

  const downloadResultPDF = useCallback(async () => {
    if (!resultRef.current) return
    setExportingPdf(true)
    try {
      const who = predictedForm?.customer_no || form?.customer_no
      await exportElementToPDF(resultRef.current, {
        title: 'ChurnGuard — Prediction Report',
        filename: `prediction-${who || new Date().toISOString().slice(0, 10)}.pdf`,
      })
    } catch {
      toast.error('Export failed', 'Could not generate the PDF. Please try again.')
    } finally {
      setExportingPdf(false)
    }
  }, [predictedForm, form])
  const { can } = usePermissions()

  // Fetch dropdown options once on mount
  useEffect(() => {
    api.get('/customers/options')
      .then(({ data }) => setOptions({
        nature_clients: (data.nature_clients || []).map(String),
        account_categories: (data.account_categories || []).map(String),
        industries: (data.industries || []).map(String),
        lobs: (data.lobs || []).map(String),
        partyclasses: (data.partyclasses || []).map(String),
        currencies: (data.currencies || []).map(String),
        account_statuses: (data.account_statuses || []).map(String),
      }))
      .catch(() => {})
  }, [])

  const isDirty = Object.values(form).some(v => v !== '')

  // Warn on browser tab close / refresh when form is dirty
  useEffect(() => {
    const handler = (e) => {
      if (isDirty && !result) { e.preventDefault(); e.returnValue = '' }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty, result])

  // Ctrl+Enter to submit
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !loading) {
        document.getElementById('predict-form')?.requestSubmit()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [loading])

  const validate = () => {
    const errs = {}
    if (touched.age && form.age && (isNaN(form.age) || Number(form.age) <= 0 || Number(form.age) > 120))
      errs.age = 'Must be between 1 and 120'
    if (touched.tenure && form.tenure && (isNaN(form.tenure) || Number(form.tenure) < 0))
      errs.tenure = 'Must be 0 or more'
    if (touched.acct_balance && form.acct_balance && isNaN(form.acct_balance))
      errs.acct_balance = 'Must be a valid number'
    return errs
  }

  const errors = validate()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const touch = (k) => setTouched(t => ({ ...t, [k]: true }))

  const fieldCls = (k) => `input-field${errors[k] ? ' !border-red-400 dark:!border-red-500 !ring-red-400/20' : ''}`

  const fillDemo = () => {
    setForm({ ...EMPTY, ...DEMO_DATA })
    setTouched({})
    setResult(null)
    setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setTouched({ age: true, tenure: true, acct_balance: true })
    if (Object.keys(errors).length > 0) return

    setLoading(true); setError(''); setResult(null); setSavedNotice(false); setRecsVisible(false)
    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v === '' ? null : isNaN(v) ? v : Number(v)])
      )
      const { data } = await api.post('/predict/', payload)
      setResult(data)
      setPredictedForm(form)
      setSavedNotice(true)
      setTimeout(() => setSavedNotice(false), 4000)
    } catch (err) {
      if (!err.response) {
        setError('Cannot reach the server — make sure the backend is running on port 8000')
      } else {
        const d = err.response?.data?.detail
        setError(Array.isArray(d) ? d.map(e => e.msg || String(e)).join(', ') : (d || 'Prediction failed'))
      }
    } finally { setLoading(false) }
  }

  const handleLookupSelect = async (r) => {
    setResult(null)
    setRecsVisible(false)
    setTouched({})

    // The search row only carries a few columns. Fetch the full customer record
    // (for the exact account) so EVERY form section gets filled.
    let rec = r
    try {
      const acct = r.account_no != null ? `?account_no=${encodeURIComponent(r.account_no)}` : ''
      const { data } = await api.get(`/customers/${encodeURIComponent(r.customer_no)}${acct}`, { silent: true })
      rec = { ...r, ...data }
    } catch { /* fall back to the search row if the full fetch fails */ }

    // Reset to a clean form, then fill every field present on the record.
    const patch = {}
    for (const key of Object.keys(EMPTY)) {
      const v = rec[key]
      if (v == null || v === '') continue
      patch[key] = key === 'acct_balance'
        ? String(Math.round(Number(v) * 1000) / 1000)
        : String(v)
    }
    setForm({ ...EMPTY, ...patch })

    // Show banner for 5s
    if (fillBannerTimer) clearTimeout(fillBannerTimer)
    const msg = `Form pre-filled from customer #${r.customer_no} — fields are editable before predicting.`
    setFillBanner(msg)
    const t = setTimeout(() => setFillBanner(''), 5000)
    setFillBannerTimer(t)
  }

  const risk = result ? (riskCfg[result.risk_level?.toLowerCase()] ?? riskCfg['high']) : null

  return (
    <div className="w-full">

      {/* Customer lookup bar */}
      <div className="mb-4 space-y-2">
        <CustomerLookup onSelect={handleLookupSelect} />
        {fillBanner && (
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl text-xs font-medium
                          text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20
                          border border-blue-200 dark:border-blue-800/50 animate-slide-up">
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
              {fillBanner}
            </div>
            <button onClick={() => setFillBanner('')}
              className="shrink-0 text-blue-400 hover:text-blue-600 dark:hover:text-blue-200 transition-colors">
              ✕
            </button>
          </div>
        )}
      </div>

      <div className={`grid grid-cols-1 ${result ? 'gap-5' : ''}`}>

        {/* Form */}
        <div className="card p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Customer Profile</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                Enter customer data ·{' '}
                <kbd className="px-1 py-0.5 text-[10px] rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono">Ctrl+Enter</kbd> to run
              </p>
            </div>
            <button type="button" onClick={fillDemo}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg
                         bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400
                         border border-violet-200 dark:border-violet-800/50
                         hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors shrink-0">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/>
              </svg>
              Try Demo
            </button>
          </div>

          <form id="predict-form" onSubmit={handleSubmit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={
                  <span className="flex items-center gap-2">
                    Age
                    {form.age ? <span className="text-[11px] font-normal text-blue-500 dark:text-blue-400">{Number(form.age)} yrs</span> : null}
                  </span>
                }
                error={errors.age}
              >
                <input type="number" value={form.age}
                  onChange={e => set('age', e.target.value)}
                  onBlur={() => touch('age')}
                  className={fieldCls('age')} placeholder="42" />
              </Field>
              <Field
                label={
                  <span className="flex items-center gap-2">
                    Tenure (yrs)
                    {form.tenure ? <span className="text-[11px] font-normal text-blue-500 dark:text-blue-400">{formatYMD(form.tenure)}</span> : null}
                  </span>
                }
                error={errors.tenure}
              >
                <input type="number" value={form.tenure}
                  onChange={e => set('tenure', e.target.value)}
                  onBlur={() => touch('tenure')}
                  className={fieldCls('tenure')} placeholder="3" />
                {form.tenure ? <p className="text-[11px] text-blue-500 dark:text-blue-400 mt-1">{formatYMD(form.tenure)}</p> : null}
              </Field>
            </div>

            <Field label="Account Balance" error={errors.acct_balance}>
              <input type="number" step="0.001" value={form.acct_balance}
                onChange={e => set('acct_balance', e.target.value)}
                onBlur={() => touch('acct_balance')}
                className={fieldCls('acct_balance')} placeholder="25000" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Party Class">
                <select value={form.partyclass} onChange={e => set('partyclass', e.target.value)} className="input-field appearance-none cursor-pointer">
                  <option value="">Select…</option>
                  {options.partyclasses.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Marital Status">
                <select value={form.marital_status} onChange={e => set('marital_status', e.target.value)} className="input-field appearance-none cursor-pointer">
                  <option value="">Select…</option>
                  <option value="C">Single</option>
                  <option value="M">Married</option>
                  <option value="D">Divorced</option>
                  <option value="V">Widowed</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="KYC Score">
                <select value={form.score_kyc} onChange={e => set('score_kyc', e.target.value)} className="input-field appearance-none cursor-pointer">
                  <option value="">Select KYC score</option>
                  <option value="LR">LR — Low Risk</option>
                  <option value="MR">MR — Medium Risk</option>
                  <option value="H1">H1 — High Risk (T1)</option>
                  <option value="H2">H2 — High Risk (T2)</option>
                  <option value="H3">H3 — High Risk (T3)</option>
                </select>
              </Field>
              <Field label="Account Status">
                <select value={form.account_status} onChange={e => set('account_status', e.target.value)} className="input-field appearance-none cursor-pointer">
                  <option value="">Select…</option>
                  {options.account_statuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Currency">
                <select value={form.currency} onChange={e => set('currency', e.target.value)} className="input-field appearance-none cursor-pointer">
                  <option value="">Select…</option>
                  {options.currencies.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Nature Client">
                <SearchableSelect
                  value={form.nature_client}
                  onChange={v => set('nature_client', v)}
                  options={options.nature_clients}
                  placeholder="Search nature…"
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Industry">
                <SearchableSelect
                  value={form.industry}
                  onChange={v => set('industry', v)}
                  options={options.industries || []}
                  placeholder="Select industry"
                />
              </Field>
              <div>
                {/* LOB with tooltip */}
                <label className="flex items-center gap-1 text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">
                  LOB
                  <span className="group relative">
                    <svg className="w-3.5 h-3.5 text-gray-400 cursor-help" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span className="pointer-events-none absolute left-5 top-0 z-50 hidden group-hover:block
                                     w-56 px-2.5 py-1.5 text-[11px] leading-snug rounded-lg shadow-lg
                                     bg-gray-900 dark:bg-gray-700 text-white">
                      Line of Business — the banking product line this account belongs to.
                    </span>
                  </span>
                </label>
                <SearchableSelect
                  value={form.lob}
                  onChange={v => set('lob', v)}
                  options={options.lobs || []}
                  placeholder="Select LOB"
                />
              </div>
              <Field label="Acct Category">
                <SearchableSelect
                  value={form.account_category}
                  onChange={v => set('account_category', v)}
                  options={options.account_categories || []}
                  placeholder="Select category"
                />
              </Field>
            </div>

            {error && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50">
                <span className="mt-0.5 shrink-0">ℹ</span> {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full h-11 mt-1">
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Analyzing…
                </>
              ) : '⚡ Run Prediction'}
            </button>
          </form>
        </div>

        {/* Result panel */}
        <div className="space-y-4" ref={resultRef}>

          {/* Saved notice */}
          {savedNotice && (
            <div data-export-ignore="true" className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 animate-slide-up">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
              Prediction saved to history ·{' '}
              <Link to="/reports" className="underline underline-offset-2 hover:no-underline">
                View in Reports →
              </Link>
            </div>
          )}

          {!result ? (
            <div className="card p-12 flex flex-col items-center justify-center text-center min-h-[400px]">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50">
                ⚡
              </div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Ready to predict</p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1.5 max-w-[220px]">
                Fill in the customer profile and run the prediction engine
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-3">
                Or click{' '}
                <button type="button" onClick={fillDemo}
                  className="text-violet-600 dark:text-violet-400 font-semibold hover:underline">
                  Try Demo
                </button>
                {' '}to use sample data
              </p>
            </div>
          ) : (
            <>
              {/* Scored profile summary — keeps the exported PDF self-contained */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 tracking-widest uppercase">Scored profile</p>
                  <button
                    type="button"
                    data-export-ignore="true"
                    onClick={downloadResultPDF}
                    disabled={exportingPdf}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-lg
                               text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700
                               hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors">
                    <svg className={`w-3.5 h-3.5 ${exportingPdf ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      {exportingPdf
                        ? <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        : <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />}
                    </svg>
                    {exportingPdf ? 'Exporting…' : 'Download PDF'}
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5">
                  {[
                    ['Age', predictedForm.age && `${Math.round(predictedForm.age)} yrs`],
                    ['Tenure', predictedForm.tenure !== '' && predictedForm.tenure != null ? formatYMD(predictedForm.tenure) : ''],
                    ['Balance', predictedForm.acct_balance !== '' && predictedForm.acct_balance != null ? Number(predictedForm.acct_balance).toLocaleString() : ''],
                    ['Party class', predictedForm.partyclass],
                    ['KYC', predictedForm.score_kyc],
                    ['Marital', predictedForm.marital_status],
                    ['Currency', predictedForm.currency],
                    ['Client nature', predictedForm.nature_client],
                    ['Account status', predictedForm.account_status],
                    ['Industry', predictedForm.industry],
                    ['LOB', predictedForm.lob],
                    ['Acct category', predictedForm.account_category],
                  ].filter(([, v]) => v !== '' && v != null && v !== false).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2 border-b border-gray-50 dark:border-gray-800/60 py-0.5">
                      <span className="text-[11px] text-gray-400 dark:text-gray-600">{k}</span>
                      <span className="text-[11px] font-medium text-gray-800 dark:text-gray-200 text-right break-words">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Demo warning banner */}
              {result.demo && (
                <div className="flex items-start gap-3 px-4 py-3 rounded-xl text-sm font-medium
                                bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700/60
                                text-amber-800 dark:text-amber-300 animate-slide-up">
                  <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                  <div>
                    <p className="font-semibold">Demo Mode Active</p>
                    <p className="text-xs mt-0.5 font-normal opacity-80">
                      No model file is loaded — this result is randomly generated and does not reflect a real prediction.
                    </p>
                  </div>
                </div>
              )}

              {/* Risk card with animated gradient border */}
              <GradientBorderCard color={risk.color} bgClass={risk.bgClass} borderClass={risk.borderClass}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 tracking-widest uppercase">Churn Risk Assessment</p>
                  <div className="flex items-center gap-2">
                    <CopyResultButton result={result} />
                    <span className={risk.badgeCls}>{risk.label}</span>
                  </div>
                </div>
                <GaugeChart probability={result.churn_probability} />
                <div className="text-center mt-2">
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    Confidence: <span className="font-semibold text-gray-900 dark:text-gray-100">{result.confidence}</span>
                  </p>
                </div>
              </GradientBorderCard>

              {/* SHAP chart */}
              {result.shap_contributions && Object.keys(result.shap_contributions).length > 0 && (
                <div className="card p-5">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-0.5">Feature Contributions</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
                    <span className="text-emerald-600 dark:text-emerald-400">■</span> Reduces risk &nbsp;·&nbsp;
                    <span className="text-red-600 dark:text-red-400">■</span> Increases risk
                  </p>
                  <div className="space-y-0.5">
                    {Object.entries(result.shap_contributions)
                      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                      .map(([name, val]) => <SHAPBar key={name} name={name} value={val} />)}
                  </div>
                </div>
              )}

              {/* What-if simulator */}
              {can('show_what_if_simulator') && (
                <div data-export-ignore="true">
                  <WhatIfSimulator baseForm={predictedForm} baseProb={result.churn_probability} />
                </div>
              )}

              {/* On-demand AI Recommendations */}
              {!recsVisible && !recsLoading && result.recommendations?.length > 0 && (
                <button
                  type="button"
                  data-export-ignore="true"
                  onClick={() => {
                    setRecsLoading(true)
                    setTimeout(() => { setRecsLoading(false); setRecsVisible(true) }, 900)
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold
                             bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400
                             border border-violet-200 dark:border-violet-800/50
                             hover:bg-violet-100 dark:hover:bg-violet-900/30 transition-colors">
                  ✨ Generate AI Recommendations
                </button>
              )}

              {recsLoading && (
                <div className="card p-5 space-y-3">
                  <div className="shimmer h-4 w-44 rounded-md" />
                  <div className="shimmer h-3 w-64 rounded-md" />
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex gap-3 p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
                      <div className="shimmer w-8 h-8 rounded-xl shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="shimmer h-3.5 w-48 rounded-md" />
                        <div className="shimmer h-2.5 w-full rounded-md" />
                        <div className="shimmer h-2.5 w-3/4 rounded-md" />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {recsVisible && (
                <div className="card p-5">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Retention Recommendations</p>
                    <button
                      type="button"
                      data-export-ignore="true"
                      onClick={() => {
                        setRecsVisible(false)
                        setTimeout(() => {
                          setRecsLoading(true)
                          setTimeout(() => { setRecsLoading(false); setRecsVisible(true) }, 900)
                        }, 100)
                      }}
                      className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors flex items-center gap-1">
                      ↺ Regenerate
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">Personalized actions to reduce churn risk</p>
                  <div className="space-y-3">
                    {result.recommendations.map((rec, i) => {
                      const priorityBadge = (priority) => {
                        if (!priority) return null
                        const p = priority.toLowerCase()
                        if (p === 'critical' || p === 'high') return <span className="badge-high text-[10px]">{priority.toUpperCase()}</span>
                        if (p === 'medium') return <span className="badge-medium text-[10px]">MEDIUM</span>
                        return <span className="badge-low text-[10px]">{priority.toUpperCase()}</span>
                      }
                      return (
                        <div key={i}
                          className="flex items-start gap-3 p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 transition-colors group"
                          style={{ animationDelay: `${i * 100}ms`, animation: 'fadeIn 0.3s ease forwards', opacity: 0 }}>
                          <span className="text-lg shrink-0 mt-0.5">{rec.icon || '💡'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">{rec.title}</p>
                              {rec.category && (
                                <span className="text-[10px] text-gray-400 dark:text-gray-600 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                  {rec.category}
                                </span>
                              )}
                              {priorityBadge(rec.priority)}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-500 leading-relaxed group-hover:text-gray-700 dark:group-hover:text-gray-300 transition-colors">
                              {rec.detail}
                            </p>
                          </div>
                          {/* Per-card copy button */}
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(`${rec.title}\n${rec.detail}`)}
                            className="shrink-0 mt-0.5 text-gray-300 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
                            title="Copy recommendation">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                            </svg>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  )
}
