import { NavLink, Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useUiStore } from '../store/uiStore'

const NAV = [
  {
    to: '/dashboard', label: 'Dashboard',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
  },
  {
    to: '/insights', label: 'Insights',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />,
  },
  {
    to: '/predict', label: 'Prediction',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
  },
  {
    to: '/workflow', label: 'Workflow',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />,
  },
  {
    to: '/reports', label: 'Reports',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  },
]

const ADMIN_NAV = [
  {
    to: '/admin', label: 'Admin Panel',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />,
  },
]

function NavIcon({ children }) {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
      {children}
    </svg>
  )
}

function NavItem({ to, label, icon, locked, collapsed }) {
  if (locked) {
    return (
      <div
        title={`${label} — super admin only`}
        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium cursor-not-allowed opacity-40 select-none">
        <span className="text-gray-400 dark:text-gray-600 ml-1 shrink-0"><NavIcon>{icon}</NavIcon></span>
        {!collapsed && <span className="text-gray-400 dark:text-gray-600">{label}</span>}
      </div>
    )
  }

  return (
    <NavLink to={to} title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 overflow-hidden ${
          collapsed ? 'justify-center' : ''
        } ${
          isActive
            ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
        }`
      }>
      {({ isActive }) => (
        <>
          {isActive && !collapsed && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-blue-500" />
          )}
          <span className={`${isActive ? 'text-blue-600 dark:text-blue-400' : ''} ${collapsed ? '' : 'ml-1'} shrink-0`}>
            <NavIcon>{icon}</NavIcon>
          </span>
          {!collapsed && label}
          {isActive && !collapsed && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />
          )}
        </>
      )}
    </NavLink>
  )
}

function AdminNavItem({ to, label, icon, collapsed }) {
  return (
    <NavLink to={to} title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 overflow-hidden ${
          collapsed ? 'justify-center' : ''
        } ${
          isActive
            ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400'
            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
        }`
      }>
      {({ isActive }) => (
        <>
          {isActive && !collapsed && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-violet-500" />
          )}
          <span className={`${isActive ? 'text-violet-600 dark:text-violet-400' : ''} ${collapsed ? '' : 'ml-1'} shrink-0`}>
            <NavIcon>{icon}</NavIcon>
          </span>
          {!collapsed && label}
          {isActive && !collapsed && (
            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-violet-500" />
          )}
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const { sidebarCollapsed: collapsed } = useUiStore()
  const isSuperAdmin = user?.role === 'super_admin'

  const handleLogout = () => { logout(); navigate('/login') }
  const initial = (user?.full_name?.[0] || user?.email?.[0] || '?').toUpperCase()

  return (
    <aside
      className={`fixed left-0 top-0 z-30 h-screen overflow-y-auto flex flex-col transition-all duration-200 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 ${collapsed ? 'w-16' : 'w-60'}`}>

      {/* Brand */}
      <div className={`shrink-0 border-b border-gray-100 dark:border-gray-800 ${collapsed ? 'px-3 pt-4 pb-3' : 'px-5 pt-6 pb-5'}`}>
        <Link to="/dashboard" className={`flex items-center gap-3 group ${collapsed ? 'justify-center' : ''}`} title={collapsed ? 'ChurnGuard' : undefined}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 bg-blue-600 text-white group-hover:bg-blue-700 transition-colors">
            🏦
          </div>
          {!collapsed && (
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-none group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">ChurnGuard</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-0.5 leading-none">Intelligence Platform</p>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {!collapsed && (
          <p className="px-3 mb-2 text-[10px] font-semibold tracking-widest uppercase text-gray-400 dark:text-gray-600">
            Analytics
          </p>
        )}

        {NAV.map(({ to, label, icon }) => (
          <NavItem key={to} to={to} label={label} icon={icon} collapsed={collapsed} />
        ))}

        {!collapsed && (
          <p className="px-3 pt-5 mb-2 text-[10px] font-semibold tracking-widest uppercase text-gray-400 dark:text-gray-600">
            Administration
          </p>
        )}
        {collapsed && <div className="pt-3" />}
        {ADMIN_NAV.map(({ to, label, icon }) =>
          isSuperAdmin
            ? <AdminNavItem key={to} to={to} label={label} icon={icon} collapsed={collapsed} />
            : <NavItem key={to} to={to} label={label} icon={icon} locked collapsed={collapsed} />
        )}
      </nav>

      {/* User footer */}
      <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 px-2 py-3">
        {!collapsed ? (
          /* Expanded: avatar + name on left, logout icon on right */
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-xl">
            <button
              onClick={() => navigate('/profile')}
              title="View profile"
              className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
              {user?.avatar
                ? <img src={user.avatar} alt="" className="w-8 h-8 rounded-xl object-cover shrink-0 border border-blue-200 dark:border-blue-800/50" />
                : (
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50">
                    {initial}
                  </div>
                )
              }
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate leading-none">
                  {user?.full_name || 'User'}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5 truncate capitalize">
                  {user?.role?.replace('_', ' ')}
                </p>
              </div>
            </button>
            <button onClick={handleLogout} title="Sign out"
              className="shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        ) : (
          /* Collapsed: stacked avatar + logout */
          <>
            <button
              onClick={() => navigate('/profile')}
              title={user?.full_name || 'Profile'}
              className="w-full flex justify-center py-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors">
              {user?.avatar
                ? <img src={user.avatar} alt="" className="w-8 h-8 rounded-xl object-cover border border-blue-200 dark:border-blue-800/50" />
                : (
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800/50">
                    {initial}
                  </div>
                )
              }
            </button>
            <button onClick={handleLogout} title="Sign out"
              className="w-full mt-1 flex justify-center py-1.5 rounded-xl text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </>
        )}
      </div>
    </aside>
  )
}
