import { Routes, Route, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import Login from './pages/Login'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'

// Heavy pages are code-split so the initial bundle stays small —
// each page's chart/PDF libraries load only when that page is opened.
const Dashboard   = lazy(() => import('./pages/Dashboard'))
const Customer360 = lazy(() => import('./pages/Customer360'))
const Predict     = lazy(() => import('./pages/Predict'))
const Insights    = lazy(() => import('./pages/Insights'))
const Workflow    = lazy(() => import('./pages/Workflow'))
const Reports     = lazy(() => import('./pages/Reports'))
const AdminPanel  = lazy(() => import('./pages/AdminPanel'))
const DataUpload  = lazy(() => import('./pages/DataUpload'))
const Permissions = lazy(() => import('./pages/Permissions'))
const Profile     = lazy(() => import('./pages/Profile'))

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <svg className="w-6 h-6 animate-spin text-blue-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    </div>
  )
}

/** Wrap a lazily-loaded page in the protected layout + a Suspense fallback. */
function Protected({ children, requiredRole }) {
  return (
    <ProtectedRoute requiredRole={requiredRole}>
      <Layout>
        <Suspense fallback={<PageLoader />}>{children}</Suspense>
      </Layout>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/customers/:customerNo" element={<Protected><Customer360 /></Protected>} />
      <Route path="/predict" element={<Protected><Predict /></Protected>} />
      <Route path="/insights" element={<Protected><Insights /></Protected>} />
      <Route path="/workflow" element={<Protected><Workflow /></Protected>} />
      <Route path="/reports" element={<Protected><Reports /></Protected>} />
      <Route path="/admin" element={<Protected requiredRole="super_admin"><AdminPanel /></Protected>} />
      <Route path="/upload" element={<Protected requiredRole="super_admin"><DataUpload /></Protected>} />
      <Route path="/permissions" element={<Protected requiredRole="super_admin"><Permissions /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
    </Routes>
  )
}
