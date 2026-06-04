import { useEffect, useState, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import ChatBot from './ChatBot'
import ToastContainer from './ToastContainer'
import { useTheme } from '../hooks/useTheme'
import { useUiStore } from '../store/uiStore'
import { toast } from '../store/uiStore'
import { riskLabel } from '../utils/format'
import { useAuthStore } from '../store/authStore'
import { useMyPermissions } from '../hooks/usePermissions'
import api from '../api/axios'

const PAGE_TITLES = {
  '/dashboard': { label: 'Dashboard',   sub: 'Real-time churn analytics' },
  '/predict':   { label: 'Prediction',  sub: 'Single customer risk assessment' },
  '/insights':  { label: 'Insights',    sub: 'Churn patterns & recommendations' },
  '/reports':   { label: 'Reports',     sub: 'Prediction history & exports' },
  '/admin':     { label: 'Admin Panel', sub: 'User management' },
  '/profile':   { label: 'My Profile',  sub: 'Account settings' },
}

const NOTIF_STYLES = {
  critical: { dot: 'bg-red-500',    icon: '🔴', ring: 'border-red-100 dark:border-red-900/40',    bg: 'bg-red-50 dark:bg-red-900/10'    },
  warning:  { dot: 'bg-amber-500',  icon: '⚠️', ring: 'border-amber-100 dark:border-amber-900/40', bg: 'bg-amber-50 dark:bg-amber-900/10' },
  info:     { dot: 'bg-blue-500',   icon: '🔵', ring: 'border-blue-100 dark:border-blue-900/40',   bg: 'bg-blue-50 dark:bg-blue-900/10'   },
  success:  { dot: 'bg-emerald-500',icon: '🟢', ring: 'border-gray-100 dark:border-gray-800',      bg: ''                                 },
}

/* ── Notification dropdown ──────────────────────────── */
function NotificationPanel({ notifs, onClose, onNavigate, onMarkSeen, onMarkAllSeen, onDelete }) {
  const ref = useRef()
  const unseen = notifs.filter(n => !n.seen).length

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div ref={ref}
      className="absolute right-0 top-full mt-2 w-[360px] bg-white dark:bg-gray-900 rounded-2xl shadow-modal border border-gray-200 dark:border-gray-800 overflow-hidden animate-slide-up z-50">

      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notifications</p>
          {unseen > 0 ? (
            <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">{unseen} unread</p>
          ) : (
            <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-0.5">You're all caught up</p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unseen > 0 && (
            <button onClick={onMarkAllSeen}
              className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline px-2 py-1 rounded-lg">
              Mark all read
            </button>
          )}
          <button onClick={onClose} aria-label="Close notifications"
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>

      <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-50 dark:divide-gray-800/60">
        {notifs.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">All clear</p>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">No alerts at this time</p>
          </div>
        ) : notifs.map(n => {
          const s = NOTIF_STYLES[n.type] || NOTIF_STYLES.info
          const isSeen = !!n.seen
          return (
            <div key={n.id}
              onClick={() => onMarkSeen(n.id)}
              className={`group relative px-4 py-3.5 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/40 ${isSeen ? 'opacity-60' : s.bg}`}>
              <div className="flex items-start gap-2.5">
                {/* Unread dot */}
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${isSeen ? 'bg-transparent' : s.dot}`} />
                <span className="text-base shrink-0 mt-0.5">{s.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">{n.title}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 leading-relaxed">{n.body}</p>
                  {n.filter && (
                    <button onClick={(e) => { e.stopPropagation(); onMarkSeen(n.id); onNavigate(n.filter); onClose() }}
                      className="mt-2 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                      View in Reports →
                    </button>
                  )}
                </div>
                {/* Delete (dismiss) */}
                <button onClick={(e) => { e.stopPropagation(); onDelete(n.id) }}
                  title="Dismiss notification" aria-label="Dismiss notification"
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 opacity-0 group-hover:opacity-100 transition-all">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 text-center">
        <p className="text-[10px] text-gray-400 dark:text-gray-600">Live data — refreshes every 60s</p>
      </div>
    </div>
  )
}

/* ── Session expired modal ──────────────────────────── */
function SessionExpiredModal() {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const { setSessionExpired } = useUiStore()

  const handleSignIn = () => {
    setSessionExpired(false)
    logout()
    navigate('/login')
  }

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') handleSignIn() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-modal border border-gray-200 dark:border-gray-800 p-6 animate-slide-up">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 shrink-0">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Session expired</h3>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">Your session has timed out</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
          Your session has expired for security reasons. Please sign in again to continue.
        </p>
        <button onClick={handleSignIn} className="btn-primary w-full h-10">
          Sign in again
        </button>
      </div>
    </div>
  )
}

/* ── Layout ─────────────────────────────────────────── */
export default function Layout({ children }) {
  const { dark, toggle } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()
  const page = PAGE_TITLES[location.pathname] || { label: 'ChurnGuard', sub: '' }
  const sessionExpired = useUiStore((s) => s.sessionExpired)
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const { refresh: refreshPermissions } = useMyPermissions()

  const [notifs, setNotifs] = useState([])
  const [notifOpen, setNotifOpen] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [custQuery, setCustQuery] = useState('')
  const [custResults, setCustResults] = useState([])
  const [custOpen, setCustOpen] = useState(false)
  const [custSearching, setCustSearching] = useState(false)
  const custSearchRef = useRef()
  const custDebounceRef = useRef()
  const bellRef = useRef()
  const mainRef = useRef()

  // Live, debounced suggestion search for the header box. Matches partial
  // customer/account numbers, nationality, residence, party class.
  const runCustSearch = useCallback((raw) => {
    setCustQuery(raw)
    if (custDebounceRef.current) clearTimeout(custDebounceRef.current)
    const term = raw.trim().replace(/^#+/, '') // tolerate a leading "#"
    if (!term) { setCustResults([]); setCustOpen(false); setCustSearching(false); return }
    setCustSearching(true)
    // For number-like queries, order by customer_no so typing different numbers
    // returns distinct, relevant matches (not the same top-churn customers).
    const sort = /^\d+$/.test(term) ? '&sort_by=customer_no&sort_dir=asc' : ''
    custDebounceRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get(
          `/customers/search?q=${encodeURIComponent(term)}&page=0&page_size=8${sort}`,
          { silent: true },
        )
        setCustResults(data?.customers || [])
        setCustOpen(true)
      } catch {
        setCustResults([])
        setCustOpen(false)
      } finally {
        setCustSearching(false)
      }
    }, 300)
  }, [])

  const openCustomerProfile = useCallback((hit) => {
    if (!hit) return
    const acct = hit.account_no != null ? `?account=${encodeURIComponent(hit.account_no)}` : ''
    navigate(`/customers/${encodeURIComponent(hit.customer_no)}${acct}`)
    setCustQuery('')
    setCustResults([])
    setCustOpen(false)
  }, [navigate])

  // Enter key → open the first suggestion (or tell the user nothing matched).
  const goToCustomer = (e) => {
    e.preventDefault()
    if (custResults.length > 0) openCustomerProfile(custResults[0])
    else if (custQuery.trim()) toast.error('No customer found', `Nothing matches “${custQuery.trim()}”.`)
  }

  // Close the suggestion dropdown on outside click.
  useEffect(() => {
    const handler = (e) => {
      if (custSearchRef.current && !custSearchRef.current.contains(e.target)) setCustOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 300)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const fetchNotifs = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/', { silent: true })
      setNotifs(data.notifications || [])
    } catch { /* silent — user might not be on a page that requires auth yet */ }
  }, [])

  useEffect(() => {
    fetchNotifs()
    const id = setInterval(fetchNotifs, 60_000)
    return () => clearInterval(id)
  }, [fetchNotifs])

  // Fetch user permissions on mount so they are available across all pages
  useEffect(() => { refreshPermissions() }, [refreshPermissions])

  const handleNotifNavigate = (filter) => {
    navigate('/reports', { state: { riskFilter: filter } })
  }

  // Seen/dismissed state is persisted per-user in the backend (survives reloads
  // and other devices). Each call updates the UI optimistically, then the server.
  const markNotifSeen = useCallback((id) => {
    setNotifs(prev => prev.map(n => (n.id === id ? { ...n, seen: true } : n)))
    api.post(`/notifications/${encodeURIComponent(id)}/seen`, null, { silent: true }).catch(() => {})
  }, [])
  const markAllNotifsSeen = useCallback(() => {
    setNotifs(prev => prev.map(n => ({ ...n, seen: true })))
    api.post('/notifications/seen-all', null, { silent: true }).catch(() => {})
  }, [])
  const deleteNotif = useCallback((id) => {
    setNotifs(prev => prev.filter(n => n.id !== id))
    api.delete(`/notifications/${encodeURIComponent(id)}`, { silent: true }).catch(() => {})
  }, [])

  // The bell badge counts unread (the backend already omits dismissed ones).
  const unseenCount = notifs.filter(n => !n.seen).length

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar />

      {/* Sidebar edge handle */}
      <button
        onClick={toggleSidebar}
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={`fixed top-1/2 -translate-y-1/2 z-40 flex items-center justify-center w-5 h-8 rounded-r-lg bg-white dark:bg-gray-900 border border-l-0 border-gray-200 dark:border-gray-700 shadow-sm text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200 ${sidebarCollapsed ? 'left-16' : 'left-60'}`}>
        <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          {sidebarCollapsed
            ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            : <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          }
        </svg>
      </button>

      <div className={`flex flex-col min-h-screen transition-all duration-200 ${sidebarCollapsed ? 'ml-16' : 'ml-60'}`}>
        {/* Header */}
        <header className="h-14 flex items-center justify-between px-6 shrink-0 sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-none">
              {page.label}
            </h2>
            {page.sub && (
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5 leading-none">{page.sub}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Global customer search with live suggestions */}
            <div ref={custSearchRef} className="relative hidden sm:block mr-1">
              <form onSubmit={goToCustomer}>
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
                </svg>
                <input
                  value={custQuery}
                  onChange={(e) => runCustSearch(e.target.value)}
                  onFocus={() => custResults.length > 0 && setCustOpen(true)}
                  placeholder="Search customer #…"
                  className="w-44 lg:w-56 h-8 pl-8 pr-8 text-xs rounded-xl bg-gray-100 dark:bg-gray-800 border border-transparent
                             text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-600
                             focus:outline-none focus:bg-white dark:focus:bg-gray-900 focus:border-blue-400 dark:focus:border-blue-600 transition-all"
                />
                {custSearching && (
                  <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                )}
              </form>

              {custOpen && (custResults.length > 0 ? (
                <div className="absolute z-30 left-0 right-0 mt-1 max-h-80 overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg">
                  {custResults.map((r, i) => (
                    <button key={`${r.customer_no}-${r.account_no}-${i}`} type="button"
                      onClick={() => openCustomerProfile(r)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 tabular-nums truncate">#{r.customer_no}</p>
                        <p className="text-[10px] text-gray-400 dark:text-gray-600 tabular-nums truncate">Acct {r.account_no}{r.nationality ? ` · ${r.nationality}` : ''}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-semibold tabular-nums"
                          style={{ color: r.probabilite_churn >= 0.6 ? '#ef4444' : r.probabilite_churn >= 0.3 ? '#f59e0b' : '#22c55e' }}>
                          {r.probabilite_churn != null ? `${Math.round(r.probabilite_churn * 100)}%` : '—'}
                        </p>
                        {r.segment_risque && <p className="text-[10px] text-gray-400 dark:text-gray-600">{riskLabel(r.segment_risque)}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (!custSearching && custQuery.trim() && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg px-3 py-3">
                  <p className="text-xs text-gray-400 dark:text-gray-600">No customer matches “{custQuery.trim()}”.</p>
                </div>
              )))}
            </div>

            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 mr-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Live</span>
            </div>

            {/* Notification bell */}
            <div ref={bellRef} className="relative">
              <button onClick={() => setNotifOpen(o => !o)}
                aria-label={`Notifications${unseenCount > 0 ? `, ${unseenCount} unread` : ''}`}
                aria-haspopup="true" aria-expanded={notifOpen}
                className="btn-ghost h-8 w-8 p-0 relative flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
                </svg>
                {unseenCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {unseenCount > 9 ? '9+' : unseenCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <NotificationPanel
                  notifs={notifs}
                  onClose={() => setNotifOpen(false)}
                  onNavigate={handleNotifNavigate}
                  onMarkSeen={markNotifSeen}
                  onMarkAllSeen={markAllNotifsSeen}
                  onDelete={deleteNotif}
                />
              )}
            </div>

            <button onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} className="btn-ghost text-xs gap-1.5 h-8">
              {dark ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z"/>
                  </svg>
                  Light
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
                  </svg>
                  Dark
                </>
              )}
            </button>
          </div>
        </header>

        <main ref={mainRef} className="flex-1 p-6 overflow-auto">
          <div className="animate-fade-in max-w-[1400px]">
            {children}
          </div>
        </main>
      </div>

      {/* Scroll-to-top button */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          title="Back to top"
          className="fixed bottom-20 right-5 z-40 w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      )}

      {sessionExpired && <SessionExpiredModal />}
      <ToastContainer />
      <ChatBot />
    </div>
  )
}
