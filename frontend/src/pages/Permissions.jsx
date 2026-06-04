import { useEffect, useState, useCallback } from 'react'
import api from '../api/axios'

function fmtErr(detail, fallback) {
  if (!detail) return fallback
  if (Array.isArray(detail)) return detail.map(i => i.msg || String(i)).join(', ')
  return String(detail)
}

/* ── Toast ──────────────────────────────────────────── */
function Toast({ msg, type, onDismiss }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 3500)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className={`fixed top-5 right-5 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium shadow-lg border animate-slide-up ${
      type === 'error'
        ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/50'
        : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
    }`}>
      {type === 'error'
        ? <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
        : <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
      }
      {msg}
    </div>
  )
}

/* ── Toggle switch ──────────────────────────────────── */
function Toggle({ checked, onChange, disabled }) {
  return (
    <button type="button" onClick={onChange} disabled={disabled}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${checked ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
      <span
        className="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200"
        style={{ transform: checked ? 'translateX(18px)' : 'translateX(2px)' }}
      />
    </button>
  )
}

// Feature permissions shown in the matrix table
const FEATURE_KEYS = [
  { key: 'can_view_dashboard',   label: 'Dashboard',   desc: 'Access main dashboard' },
  { key: 'can_view_predictions', label: 'Predictions', desc: 'Run predictions' },
  { key: 'can_view_insights',    label: 'Insights',    desc: 'View analytics' },
  { key: 'can_view_reports',     label: 'Reports',     desc: 'Access reports' },
  { key: 'can_export_data',      label: 'Export',      desc: 'Export CSV' },
  { key: 'can_batch_predict',    label: 'Batch',       desc: 'Batch upload' },
]

// Chart permissions grouped by page
const CHART_GROUPS = [
  {
    page: 'Dashboard',
    charts: [
      { key: 'show_revenue_at_risk',    label: 'Revenue at Risk' },
      { key: 'show_churn_trend',        label: 'Churn Trend' },
      { key: 'show_high_risk_table',    label: 'High Risk Table' },
      { key: 'show_risk_chart',         label: 'Risk Distribution' },
      { key: 'show_confusion_matrix',   label: 'Confusion Matrix' },
      { key: 'show_probability_dist',   label: 'Probability Dist.' },
      { key: 'show_churn_by_age',       label: 'Age Chart' },
      { key: 'show_churn_by_tenure',    label: 'Tenure Chart' },
      { key: 'show_churn_by_balance',   label: 'Balance Chart' },
      { key: 'show_churn_by_partyclass', label: 'Party Class' },
      { key: 'show_churn_by_nature',    label: 'Client Nature' },
    ],
  },
  {
    page: 'Insights',
    charts: [
      { key: 'show_insights_marital',  label: 'Marital Status' },
      { key: 'show_insights_age',      label: 'Age' },
      { key: 'show_insights_tenure',   label: 'Tenure' },
      { key: 'show_insights_balance',  label: 'Balance' },
      { key: 'show_insights_kyc',      label: 'KYC Score' },
      { key: 'show_cohort_compare',    label: 'Cohort Compare' },
    ],
  },
  {
    page: 'Predict',
    charts: [
      { key: 'show_what_if_simulator', label: 'What-If Simulator' },
    ],
  },
]

const ROLE_BADGE = {
  super_admin: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800/50',
  admin:       'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50',
}

function ChartPermCard({ user: u, initial, roleBadge, userPerms, saving, onToggle }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 border ${roleBadge}`}>{initial}</div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{u.full_name || '—'}</p>
          <p className="text-xs text-gray-400 dark:text-gray-600 truncate">{u.email}</p>
        </div>
        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${roleBadge}`}>
          {u.role.replace('_', ' ')}
        </span>
        <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-4 space-y-5">
          {CHART_GROUPS.map(group => (
            <div key={group.page}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-600 mb-2">{group.page}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {group.charts.map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                    <span className="text-xs text-gray-700 dark:text-gray-300 leading-tight">{label}</span>
                    <Toggle
                      checked={userPerms[key] !== false}
                      onChange={() => onToggle(u.id, key, userPerms[key] !== false)}
                      disabled={!!saving[`${u.id}-${key}`]}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Permissions() {
  const [users, setUsers] = useState([])
  const [perms, setPerms] = useState({})
  const [usersLoading, setUsersLoading] = useState(true)
  const [permsLoading, setPermsLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [toast, setToast] = useState(null)

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
  }, [])

  // Load all users and permissions in one call via GET /permissions/all
  const loadAll = useCallback(async () => {
    setUsersLoading(true)
    setPermsLoading(true)
    try {
      const { data } = await api.get('/permissions/all')
      // data = [{user: {...}, permissions: {...}}, ...]
      const userList = data.map(e => e.user)
      const permMap = {}
      for (const e of data) { permMap[e.user.id] = e.permissions }
      setUsers(userList)
      setPerms(permMap)
    } catch {
      setUsers([])
      setPerms({})
    } finally {
      setUsersLoading(false)
      setPermsLoading(false)
    }
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const togglePerm = async (userId, key, currentVal) => {
    const optimistic = { ...perms[userId], [key]: !currentVal }
    setPerms(p => ({ ...p, [userId]: optimistic }))
    setSaving(s => ({ ...s, [`${userId}-${key}`]: true }))
    try {
      await api.put(`/permissions/users/${userId}`, { [key]: !currentVal })
      showToast('Permission updated')
    } catch (err) {
      setPerms(p => ({ ...p, [userId]: { ...p[userId], [key]: currentVal } }))
      showToast(fmtErr(err.response?.data?.detail, 'Failed to update permission'), 'error')
    } finally {
      setSaving(s => ({ ...s, [`${userId}-${key}`]: false }))
    }
  }

  const loading = usersLoading || permsLoading

  return (
    <div className="max-w-5xl space-y-5">
      {toast && <Toast msg={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Permission Management</h1>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">
          Control which features each user can access. Changes apply immediately.
        </p>
      </div>

      {/* Permission key legend */}
      <div className="card p-5">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 uppercase tracking-wide mb-3">Feature Access Keys</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {FEATURE_KEYS.map(({ key, label, desc }) => (
            <div key={key} className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">{label}</p>
                <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Permission matrix table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-6">
                <div className="shimmer h-8 w-36 rounded-xl" />
                <div className="shimmer h-5 w-20 rounded-full" />
                {FEATURE_KEYS.map(({ key }) => <div key={key} className="shimmer h-5 w-9 rounded-full" />)}
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-500 tracking-wide uppercase">User</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-500 tracking-wide uppercase">Role</th>
                  {FEATURE_KEYS.map(({ key, label }) => (
                    <th key={key} className="px-3 py-3 text-center text-[10px] font-semibold text-gray-500 dark:text-gray-500 tracking-wide uppercase whitespace-nowrap">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={FEATURE_KEYS.length + 2} className="px-4 py-12 text-center">
                      <p className="text-sm text-gray-500 dark:text-gray-500">No users found</p>
                    </td>
                  </tr>
                ) : (
                  users.map(u => {
                    const userPerms = perms[u.id] || {}
                    const roleBadge = ROLE_BADGE[u.role] || ROLE_BADGE.admin
                    const initial = (u.full_name?.[0] || u.email?.[0] || '?').toUpperCase()
                    return (
                      <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2.5">
                            {u.avatar
                              ? <img src={u.avatar} alt="" className="w-8 h-8 rounded-xl object-cover shrink-0 border border-gray-200 dark:border-gray-700" />
                              : (
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 border ${
                                  u.role === 'super_admin'
                                    ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800/50'
                                    : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50'
                                }`}>{initial}</div>
                              )
                            }
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{u.full_name || '—'}</p>
                              <p className="text-xs text-gray-400 dark:text-gray-600 truncate">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${roleBadge}`}>
                            {u.role.replace('_', ' ')}
                          </span>
                        </td>
                        {FEATURE_KEYS.map(({ key }) => (
                          <td key={key} className="px-3 py-4 text-center">
                            <div className="flex justify-center">
                              <Toggle
                                checked={!!userPerms[key]}
                                onChange={() => togglePerm(u.id, key, !!userPerms[key])}
                                disabled={!!saving[`${u.id}-${key}`]}
                              />
                            </div>
                          </td>
                        ))}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Per-user chart visibility ─────────────────────── */}
      <div>
        <div className="mb-3">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Chart Visibility</p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
            Control which charts each user can see. Expand a user to configure.
          </p>
        </div>
        <div className="space-y-3">
          {users.map(u => {
            const userPerms = perms[u.id] || {}
            const initial = (u.full_name?.[0] || u.email?.[0] || '?').toUpperCase()
            const roleBadge = ROLE_BADGE[u.role] || ROLE_BADGE.admin
            return (
              <ChartPermCard
                key={u.id}
                user={u}
                initial={initial}
                roleBadge={roleBadge}
                userPerms={userPerms}
                saving={saving}
                onToggle={togglePerm}
              />
            )
          })}
        </div>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-600 text-center">
        Changes are saved immediately via the API. Toggling a permission updates it in real time.
      </p>
    </div>
  )
}
