import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../api/axios'
import EmptyState from '../components/EmptyState'
import { formatTenure, formatCurrency, riskLabel } from '../utils/format'

const RISK_COLOR = {
  High: '#ef4444', Medium: '#f59e0b', Low: '#22c55e',
  high: '#ef4444', medium: '#f59e0b', low: '#22c55e',
  'Élevé': '#ef4444', Moyen: '#f59e0b', Faible: '#22c55e',
}

const STATUS_META = {
  open:        { label: 'Open',        color: '#3b82f6' },
  in_progress: { label: 'In progress', color: '#f59e0b' },
  done:        { label: 'Done',        color: '#22c55e' },
}
const OUTCOME_META = {
  pending:  { label: 'Pending',  color: '#9ca3af' },
  retained: { label: 'Retained', color: '#22c55e' },
  churned:  { label: 'Churned',  color: '#ef4444' },
}

/* ── Onboarding banner ────────────────────────────────── */
function OnboardingBanner() {
  const [visible, setVisible] = useState(
    () => sessionStorage.getItem('wf-onboarding-dismissed') !== '1'
  )
  if (!visible) return null
  return (
    <div className="card p-5 border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-900/10 flex gap-4">
      <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50 flex items-center justify-center text-lg shrink-0">
        📋
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">What is the Workflow page?</p>
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed mb-2">
          This page helps you track high-risk customers through your retention process.
        </p>
        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <li className="flex items-start gap-2">
            <span className="text-blue-500 font-bold shrink-0 mt-px">•</span>
            <span><strong className="text-gray-800 dark:text-gray-200">Watchlist</strong> — flag customers you want to monitor closely before they churn.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 font-bold shrink-0 mt-px">•</span>
            <span><strong className="text-gray-800 dark:text-gray-200">Interventions</strong> — log retention actions (calls, fee waivers, offers) and track their outcome.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-500 font-bold shrink-0 mt-px">•</span>
            <span><strong className="text-gray-800 dark:text-gray-200">Risk Migration</strong> — see how customer risk levels have shifted over time.</span>
          </li>
        </ul>
      </div>
      <button
        onClick={() => { sessionStorage.setItem('wf-onboarding-dismissed', '1'); setVisible(false) }}
        title="Dismiss"
        className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  )
}

/* ── Tab switcher ─────────────────────────────────────── */
function Tabs({ tab, setTab, counts }) {
  const items = [
    ['watchlist', 'Watchlist', counts.watchlist],
    ['interventions', 'Interventions', counts.interventions],
    ['migration', 'Risk migration', counts.migration],
  ]
  return (
    <div className="flex gap-1 p-0.5 rounded-xl bg-gray-100 dark:bg-gray-800 w-max max-w-full">
      {items.map(([val, label, count]) => (
        <button key={val} onClick={() => setTab(val)}
          className={[
            'px-4 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center gap-2',
            tab === val
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
          ].join(' ')}>
          {label}
          {count != null && count > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400">
              {count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

/* ── Watchlist tab ────────────────────────────────────── */
function WatchlistTab({ items, onRemove }) {
  if (items.length === 0) {
    return (
      <div className="card">
        <EmptyState icon="users" title="Watchlist is empty"
          description="Flag customers for retention follow-up from their profile page or the dashboard high-risk table." />
      </div>
    )
  }
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
              {['Customer', 'Risk', 'Churn prob', 'Balance', 'Tenure', 'Note', 'Added by', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
            {items.map((w) => {
              const pct = w.probabilite_churn != null ? Math.round(w.probabilite_churn * 100) : null
              const color = RISK_COLOR[w.segment_risque] || '#9ca3af'
              return (
                <tr key={w.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/customers/${encodeURIComponent(w.customer_no)}`}
                          className="font-semibold text-blue-600 dark:text-blue-400 hover:underline tabular-nums">
                      {w.customer_no}
                    </Link>
                    {w.partyclass && <span className="block text-[11px] text-gray-400 dark:text-gray-600">{w.partyclass}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {w.segment_risque ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold text-white" style={{ background: color }}>
                        {riskLabel(w.segment_risque)}
                      </span>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: pct != null ? color : undefined }}>
                    {pct != null ? `${pct}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 tabular-nums">
                    {w.acct_balance != null ? formatCurrency(w.acct_balance, 'TND', { compact: true }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{formatTenure(w.tenure, 'short')}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[180px] truncate" title={w.note}>{w.note || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 dark:text-gray-600 text-xs">{w.added_by_name || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => onRemove(w.id)}
                      className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Remove">
                      <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/* ── Interventions tab ────────────────────────────────── */
function InterventionsTab({ items, stats, onUpdate, onDelete }) {
  return (
    <div className="space-y-5">
      {/* Stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox label="Total actions" value={stats?.total ?? 0} accent="#3b82f6" icon="📋" />
        <StatBox label="Open" value={stats?.by_status?.open ?? 0} accent="#3b82f6" icon="🔵" />
        <StatBox label="Retained" value={stats?.by_outcome?.retained ?? 0} accent="#22c55e" icon="✅" />
        <StatBox
          label="Success rate"
          value={stats?.success_rate != null ? `${stats.success_rate}%` : '—'}
          sub="of resolved cases"
          accent="#8b5cf6" icon="🎯"
        />
      </div>

      {items.length === 0 ? (
        <div className="card">
          <EmptyState icon="prediction" title="No interventions logged"
            description="Log a retention action from a customer's profile to start tracking outcomes here." />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  {['Customer', 'Action', 'Status', 'Outcome', 'By', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
                {items.map((it) => (
                  <tr key={it.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/customers/${encodeURIComponent(it.customer_no)}`}
                            className="font-semibold text-blue-600 dark:text-blue-400 hover:underline tabular-nums">
                        {it.customer_no}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {it.action}
                      {it.note && <span className="block text-[11px] text-gray-400 dark:text-gray-600 max-w-[200px] truncate" title={it.note}>{it.note}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <select value={it.status} onChange={e => onUpdate(it.id, { status: e.target.value })}
                        className="text-xs rounded-lg px-2 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800
                                   text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer">
                        {Object.entries(STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select value={it.outcome} onChange={e => onUpdate(it.id, { outcome: e.target.value })}
                        className="text-xs rounded-lg px-2 py-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800
                                   text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer">
                        {Object.entries(OUTCOME_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-400 dark:text-gray-600 text-xs">{it.created_by_name || '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => onDelete(it.id)}
                        className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Delete">
                        <svg className="w-4 h-4 inline" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StatBox({ label, value, sub, accent, icon }) {
  return (
    <div className="card p-4 relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-0.5 opacity-60" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{value}</p>
          {sub && <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-0.5">{sub}</p>}
        </div>
        <span className="text-lg opacity-70">{icon}</span>
      </div>
    </div>
  )
}

/* ── Risk migration tab ───────────────────────────────── */
function MigrationTab({ data }) {
  if (!data || data.customers_tracked === 0) {
    return (
      <div className="card">
        <EmptyState icon="chart" title="No migration data yet"
          description="Risk migration tracks how a customer's risk level changes across repeated predictions. Run predictions for the same customers (with a customer number) over time to populate this." />
      </div>
    )
  }
  const total = data.customers_tracked || 1
  const cards = [
    { label: 'Improved', value: data.improved, color: '#22c55e', icon: '📉', desc: 'risk went down' },
    { label: 'Worsened', value: data.worsened, color: '#ef4444', icon: '📈', desc: 'risk went up' },
    { label: 'Unchanged', value: data.unchanged, color: '#9ca3af', icon: '➡️', desc: 'no change' },
  ]
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cards.map(c => (
          <div key={c.label} className="card p-4 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-0.5 opacity-60" style={{ background: `linear-gradient(90deg, transparent, ${c.color}, transparent)` }} />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-1">{c.label}</p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: c.color }}>{c.value}</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-0.5">{c.desc}</p>
              </div>
              <span className="text-2xl">{c.icon}</span>
            </div>
            <div className="mt-3 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
              <div className="h-1.5 rounded-full" style={{ width: `${(c.value / total) * 100}%`, background: c.color }} />
            </div>
          </div>
        ))}
      </div>

      {/* Detail table */}
      <div className="card overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Recent risk movements</p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">Tracking {data.customers_tracked} customers with 2+ predictions · worsened first</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                {['Customer', 'From', 'To', 'Direction', 'Prob change', 'Snapshots'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {(data.detail || []).map((d, i) => {
                const dirColor = d.direction === 'improved' ? '#22c55e' : d.direction === 'worsened' ? '#ef4444' : '#9ca3af'
                const probDelta = d.from_prob != null && d.to_prob != null ? Math.round((d.to_prob - d.from_prob) * 100) : null
                return (
                  <tr key={`${d.customer_no}-${i}`} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/customers/${encodeURIComponent(d.customer_no)}`}
                            className="font-semibold text-blue-600 dark:text-blue-400 hover:underline tabular-nums">
                        {d.customer_no}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold text-white" style={{ background: RISK_COLOR[d.from] || '#9ca3af' }}>{d.from}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold text-white" style={{ background: RISK_COLOR[d.to] || '#9ca3af' }}>{d.to}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold capitalize" style={{ color: dirColor }}>{d.direction}</td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: probDelta != null ? (probDelta > 0 ? '#ef4444' : probDelta < 0 ? '#22c55e' : undefined) : undefined }}>
                      {probDelta != null ? `${probDelta > 0 ? '+' : ''}${probDelta} pts` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 tabular-nums">{d.snapshots}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function Workflow() {
  const [tab, setTab] = useState('watchlist')
  const [watchlist, setWatchlist] = useState([])
  const [interventions, setInterventions] = useState([])
  const [stats, setStats] = useState(null)
  const [migration, setMigration] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [wl, iv, st, mg] = await Promise.allSettled([
      api.get('/workflow/watchlist'),
      api.get('/workflow/interventions'),
      api.get('/workflow/interventions/stats'),
      api.get('/workflow/risk-migration'),
    ])
    if (wl.status === 'fulfilled') setWatchlist(wl.value.data.items || [])
    if (iv.status === 'fulfilled') setInterventions(iv.value.data.items || [])
    if (st.status === 'fulfilled') setStats(st.value.data)
    if (mg.status === 'fulfilled') setMigration(mg.value.data)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const removeWatch = async (id) => {
    setWatchlist(w => w.filter(x => x.id !== id))   // optimistic
    try { await api.delete(`/workflow/watchlist/${id}`, { silent: true }) } catch { /* already gone — fine */ }
  }
  const updateIv = async (id, patch) => {
    try {
      await api.patch(`/workflow/interventions/${id}`, patch)
      setInterventions(list => list.map(x => x.id === id ? { ...x, ...patch } : x))
      const st = await api.get('/workflow/interventions/stats')
      setStats(st.data)
    } catch { /* ignore */ }
  }
  const deleteIv = async (id) => {
    try {
      await api.delete(`/workflow/interventions/${id}`)
      setInterventions(list => list.filter(x => x.id !== id))
      const st = await api.get('/workflow/interventions/stats')
      setStats(st.data)
    } catch { /* ignore */ }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="shimmer h-9 w-72 rounded-xl" />
        <div className="card p-6"><div className="shimmer h-48 w-full rounded-md" /></div>
      </div>
    )
  }

  const counts = {
    watchlist: watchlist.length,
    interventions: stats?.by_status?.open ?? interventions.length,
    migration: migration?.worsened ?? 0,
  }

  return (
    <div className="space-y-5">
      <OnboardingBanner />
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Retention workflow</h1>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">Track at-risk customers, log retention actions, and monitor how risk shifts over time.</p>
      </div>

      <Tabs tab={tab} setTab={setTab} counts={counts} />

      {tab === 'watchlist' && <WatchlistTab items={watchlist} onRemove={removeWatch} />}
      {tab === 'interventions' && <InterventionsTab items={interventions} stats={stats} onUpdate={updateIv} onDelete={deleteIv} />}
      {tab === 'migration' && <MigrationTab data={migration} />}
    </div>
  )
}
