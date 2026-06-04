import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import api from '../api/axios'
import EmptyState from '../components/EmptyState'
import { formatTenure, formatCurrency, riskLabel } from '../utils/format'
import { exportElementToPDF } from '../utils/pdf'
import { toast } from '../store/uiStore'

/* ── Risk label → colour (FR + EN variants) ───────────── */
const RISK_COLOR = {
  High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e',
  high: '#ef4444', medium: '#f59e0b', low: '#22c55e',
  'Élevé': '#ef4444', Moyen: '#f59e0b', Faible: '#22c55e',
}
const HIGH_RISK = new Set(['Élevé', 'High', 'high'])

/* ── Display label maps (DB codes → English) ──────────── */
const MARITAL_EN = { C: 'Single', M: 'Married', D: 'Divorced', V: 'Widowed', S: 'Separated' }
const maritalEn = (v) => (v == null || v === '' ? '—' : MARITAL_EN[String(v).toUpperCase()] ?? v)
const KYC_EN = {
  LR: 'LR — Low Risk', MR: 'MR — Medium Risk',
  H1: 'H1 — High Risk (T1)', H2: 'H2 — High Risk (T2)', H3: 'H3 — High Risk (T3)',
}
const kycEn = (v) => (v == null || v === '' ? '—' : KYC_EN[String(v).toUpperCase()] ?? v)

/* ── Priority → colour for recommendation cards ───────── */
const PRIORITY_COLOR = {
  high: '#ef4444', medium: '#f59e0b', low: '#3b82f6',
  High: '#ef4444', Medium: '#f59e0b', Low: '#3b82f6',
}

/* Fields we surface prominently (label + formatter). */
const PROFILE_FIELDS = [
  { key: 'account_no',     label: 'Account No' },
  { key: 'age',            label: 'Age', fmt: (v) => (v != null ? `${Math.round(v)} yrs` : '—') },
  { key: 'tenure',         label: 'Tenure', fmt: (v) => formatTenure(v, 'long') },
  { key: 'acct_balance',   label: 'Account Balance', fmt: (v, row) => formatCurrency(v, row.currency || 'TND') },
  { key: 'partyclass',     label: 'Party Class' },
  { key: 'nature_client',  label: 'Client Nature' },
  { key: 'nationality',    label: 'Nationality' },
  { key: 'residence',      label: 'Residence' },
  { key: 'currency',       label: 'Currency' },
  { key: 'marital_status', label: 'Marital Status', fmt: (v) => maritalEn(v) },
  { key: 'score_kyc',      label: 'KYC Score', fmt: (v) => kycEn(v) },
  { key: 'churn',          label: 'Actual Churn', fmt: (v) => (v == null ? '—' : v ? 'Yes' : 'No') },
]

/* ── Circular probability gauge ───────────────────────── */
function ProbGauge({ value }) {
  const pct = value == null ? null : Math.min(Math.max(value, 0), 1)
  const r = 46
  const circ = 2 * Math.PI * r
  const dash = (pct ?? 0) * circ
  const color = pct == null ? '#9ca3af' : pct >= 0.6 ? '#ef4444' : pct >= 0.3 ? '#f59e0b' : '#22c55e'
  return (
    <svg width="120" height="120" viewBox="0 0 120 120">
      <circle cx="60" cy="60" r={r} fill="none" stroke={`${color}22`} strokeWidth="9" />
      <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
              transform="rotate(-90 60 60)" />
      <text x="60" y="58" textAnchor="middle" fontSize="24" fontWeight="800" fill={color}>
        {pct == null ? '—' : `${(pct * 100).toFixed(0)}%`}
      </text>
      <text x="60" y="76" textAnchor="middle" fontSize="10" fontWeight="600" fill="#9ca3af">
        churn risk
      </text>
    </svg>
  )
}

/* Common retention actions for the log-intervention form. */
const ACTION_PRESETS = [
  'Personal call',
  'Retention offer',
  'Fee waiver',
  'Assign advisor',
  'Engagement email',
  'Product cross-sell',
  'Account review',
]

export default function Customer360() {
  const { customerNo } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  // A customer may hold several accounts, each with its own prediction. The
  // table row that linked here tells us which account's probability to show.
  const accountNo = new URLSearchParams(location.search).get('account')
  const acctQuery = accountNo ? `?account_no=${encodeURIComponent(accountNo)}` : ''
  const [profile, setProfile] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [recs, setRecs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exportingPdf, setExportingPdf] = useState(false)
  const pdfRef = useRef(null)

  const downloadProfilePDF = useCallback(async () => {
    if (!pdfRef.current) return
    setExportingPdf(true)
    try {
      await exportElementToPDF(pdfRef.current, {
        title: `ChurnGuard — Customer ${customerNo}`,
        filename: `customer-${customerNo}.pdf`,
      })
    } catch {
      toast.error('Export failed', 'Could not generate the PDF. Please try again.')
    } finally {
      setExportingPdf(false)
    }
  }, [customerNo])
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState(false)

  // Workflow state
  const [interventions, setInterventions] = useState([])
  const [watchAdded, setWatchAdded] = useState(false)
  const [watchBusy, setWatchBusy] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [logAction, setLogAction] = useState(ACTION_PRESETS[0])
  const [logNote, setLogNote] = useState('')
  const [logBusy, setLogBusy] = useState(false)

  const loadInterventions = useCallback(async () => {
    try {
      const res = await api.get(`/workflow/interventions?customer_no=${encodeURIComponent(customerNo)}`)
      setInterventions(res.data.items || [])
    } catch {
      setInterventions([])
    }
  }, [customerNo])

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    setNotFound(false)
    try {
      const profRes = await api.get(`/customers/${encodeURIComponent(customerNo)}${acctQuery}`)
      setProfile(profRes.data)
    } catch (err) {
      if (err.response?.status === 404) { setNotFound(true); setLoading(false); return }
      setError(true); setLoading(false); return
    }
    // Recommendations, account list, interventions are best-effort — never block the profile
    try {
      const recRes = await api.get(`/customers/${encodeURIComponent(customerNo)}/recommendations${acctQuery}`)
      setRecs(recRes.data)
    } catch {
      setRecs(null)
    }
    try {
      const acctRes = await api.get(`/customers/${encodeURIComponent(customerNo)}/accounts`)
      setAccounts(acctRes.data.accounts || [])
    } catch {
      setAccounts([])
    }
    loadInterventions()
    setLoading(false)
  }, [customerNo, acctQuery, loadInterventions])

  useEffect(() => { load() }, [load])

  const addToWatchlist = async () => {
    setWatchBusy(true)
    try {
      await api.post('/workflow/watchlist', {
        customer_no: String(profile.customer_no ?? customerNo),
        account_no: profile.account_no != null ? String(profile.account_no) : null,
      })
      setWatchAdded(true)
    } catch { /* ignore */ } finally { setWatchBusy(false) }
  }

  const submitIntervention = async () => {
    if (!logAction.trim()) return
    setLogBusy(true)
    try {
      await api.post('/workflow/interventions', {
        customer_no: String(profile.customer_no ?? customerNo),
        account_no: profile.account_no != null ? String(profile.account_no) : null,
        action: logAction.trim(),
        note: logNote.trim() || null,
      })
      setShowLog(false)
      setLogNote('')
      setLogAction(ACTION_PRESETS[0])
      loadInterventions()
    } catch { /* ignore */ } finally { setLogBusy(false) }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="shimmer h-8 w-48 rounded-md" />
        <div className="card p-6"><div className="shimmer h-32 w-full rounded-md" /></div>
        <div className="card p-6"><div className="shimmer h-40 w-full rounded-md" /></div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="space-y-5">
        <BackLink />
        <div className="card">
          <EmptyState icon="search" title="Customer not found"
            description={`No customer matches “${customerNo}”.`} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-5">
        <BackLink />
        <div className="card p-10 text-center">
          <span className="text-3xl">⚠️</span>
          <p className="mt-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Couldn’t load this customer</p>
          <button onClick={load}
            className="mt-4 px-4 py-2 text-xs font-medium rounded-xl border border-gray-200 dark:border-gray-700
                       text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
            Retry
          </button>
        </div>
      </div>
    )
  }

  const risk = profile.segment_risque
  const riskColor = RISK_COLOR[risk] || '#9ca3af'
  const isHigh = HIGH_RISK.has(risk)
  const prob = profile.probabilite_churn ?? recs?.churn_probability ?? null
  const recommendations = recs?.recommendations ?? []

  return (
    <div className="space-y-5" ref={pdfRef}>
      <div className="flex items-center justify-between gap-3" data-export-ignore="true">
        <BackLink />
        <button
          type="button"
          onClick={downloadProfilePDF}
          disabled={exportingPdf}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl
                     text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700
                     hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-all">
          <svg className={`w-3.5 h-3.5 ${exportingPdf ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            {exportingPdf
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />}
          </svg>
          {exportingPdf ? 'Exporting…' : 'Download PDF'}
        </button>
      </div>

      {/* Hero: identity + risk gauge */}
      <div className="card p-6 relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-0.5 rounded-t-2xl opacity-70"
          style={{ background: `linear-gradient(90deg, transparent, ${riskColor}, transparent)` }} />
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wide mb-1">Customer</p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums break-all">
              {profile.customer_no ?? customerNo}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {risk && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold text-white"
                      style={{ background: riskColor }}>
                  {isHigh && '🔴'} {riskLabel(risk)} risk
                </span>
              )}
              {profile.churn_predit != null && (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium
                                 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                  Predicted: {profile.churn_predit ? 'Will churn' : 'Will stay'}
                </span>
              )}
            </div>

            {/* Account switcher — this customer holds several accounts, each scored separately */}
            {accounts.length > 1 && (
              <div className="flex items-center gap-2 mt-3">
                <label htmlFor="acct-switch" className="text-xs font-medium text-gray-500 dark:text-gray-500">Account</label>
                <select
                  id="acct-switch"
                  value={String(profile.account_no ?? '')}
                  onChange={(e) => navigate(`/customers/${encodeURIComponent(customerNo)}?account=${encodeURIComponent(e.target.value)}`)}
                  className="text-xs rounded-lg px-2 py-1 max-w-[280px] cursor-pointer
                             bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700
                             text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                  {accounts.map((a) => {
                    const pct = a.probabilite_churn != null ? `${Math.round(a.probabilite_churn * 100)}%` : '—'
                    return (
                      <option key={String(a.account_no)} value={String(a.account_no)}>
                        #{a.account_no} · {riskLabel(a.segment_risque)} · {pct}
                      </option>
                    )
                  })}
                </select>
                <span className="text-[11px] text-gray-400 dark:text-gray-600">{accounts.length} accounts</span>
              </div>
            )}

            {/* Workflow actions */}
            <div className="flex flex-wrap items-center gap-2 mt-4" data-export-ignore="true">
              <button
                onClick={addToWatchlist}
                disabled={watchBusy || watchAdded}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl
                           border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400
                           hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-60 transition-all">
                <svg className="w-3.5 h-3.5" fill={watchAdded ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                {watchAdded ? 'On watchlist' : 'Add to watchlist'}
              </button>
              <button
                onClick={() => setShowLog(s => !s)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl
                           bg-blue-600 text-white hover:bg-blue-700 transition-all">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Log intervention
              </button>
            </div>

            {/* Inline log-intervention form */}
            {showLog && (
              <div className="mt-3 p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 space-y-2.5">
                <div className="flex flex-wrap gap-1.5">
                  {ACTION_PRESETS.map(a => (
                    <button key={a} onClick={() => setLogAction(a)}
                      className={[
                        'px-2.5 py-1 text-[11px] font-medium rounded-lg transition-colors',
                        logAction === a
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-400',
                      ].join(' ')}>
                      {a}
                    </button>
                  ))}
                </div>
                <input
                  value={logAction}
                  onChange={e => setLogAction(e.target.value)}
                  placeholder="Action"
                  className="w-full text-sm rounded-lg px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700
                             text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
                <textarea
                  value={logNote}
                  onChange={e => setLogNote(e.target.value)}
                  placeholder="Note (optional)"
                  rows={2}
                  className="w-full text-sm rounded-lg px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700
                             text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none" />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setShowLog(false)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    Cancel
                  </button>
                  <button onClick={submitIntervention} disabled={logBusy || !logAction.trim()}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-all">
                    {logBusy ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="shrink-0 self-center">
            <ProbGauge value={prob} />
          </div>
        </div>
      </div>

      {/* Logged interventions */}
      {interventions.length > 0 && (
        <div className="card p-6">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4">Intervention history</h2>
          <div className="space-y-2.5">
            {interventions.map((it) => {
              const statusColor = it.status === 'done' ? '#22c55e' : it.status === 'in_progress' ? '#f59e0b' : '#3b82f6'
              const outcomeColor = it.outcome === 'retained' ? '#22c55e' : it.outcome === 'churned' ? '#ef4444' : '#9ca3af'
              return (
                <div key={it.id} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{it.action}</p>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white capitalize" style={{ background: statusColor }}>
                        {it.status.replace('_', ' ')}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white capitalize" style={{ background: outcomeColor }}>
                        {it.outcome}
                      </span>
                    </div>
                    {it.note && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{it.note}</p>}
                    <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-1">
                      {it.created_by_name || '—'}{it.created_at ? ` · ${new Date(it.created_at).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Profile fields */}
      <div className="card p-6">
        <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-4">Profile</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">
          {PROFILE_FIELDS.map(({ key, label, fmt }) => {
            if (!(key in profile)) return null
            const raw = profile[key]
            const display = fmt ? fmt(raw, profile) : (raw == null || raw === '' ? '—' : String(raw))
            return (
              <div key={key} className="min-w-0">
                <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wide mb-1">{label}</p>
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate" title={display}>{display}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recommendations */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200">Retention recommendations</h2>
          <span className="text-[11px] text-gray-400 dark:text-gray-600">Rule-based · refines once the model is connected</span>
        </div>
        {recommendations.length > 0 ? (
          <div className="mt-4 space-y-3">
            {recommendations.map((rec, i) => {
              const color = PRIORITY_COLOR[rec.priority] || '#3b82f6'
              return (
                <div key={i} className="flex gap-3 rounded-xl p-3.5"
                     style={{ background: `${color}0d`, border: `1.5px solid ${color}25` }}>
                  <span className="text-xl shrink-0 leading-none mt-0.5">{rec.icon || '•'}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{rec.title}</p>
                      {rec.priority && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase text-white"
                              style={{ background: color }}>
                          {rec.priority}
                        </span>
                      )}
                      {rec.category && (
                        <span className="text-[10px] text-gray-400 dark:text-gray-600">{rec.category}</span>
                      )}
                    </div>
                    {rec.detail && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{rec.detail}</p>}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="mt-2">
            <EmptyState icon="prediction" title="No recommendations"
              description="No retention actions were generated for this customer profile." />
          </div>
        )}
      </div>
    </div>
  )
}

function BackLink() {
  const navigate = useNavigate()
  const location = useLocation()
  // Go back to the page the user came from; fall back to dashboard
  // when this page was opened directly (no in-app history).
  const goBack = () => {
    if (location.key && location.key !== 'default') navigate(-1)
    else navigate('/dashboard')
  }
  return (
    <button onClick={goBack}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400
                 hover:text-gray-800 dark:hover:text-gray-200 transition-colors">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Back
    </button>
  )
}
