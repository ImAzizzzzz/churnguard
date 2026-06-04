import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import api from '../api/axios'
import { useAuthStore } from '../store/authStore'
import EmptyState from '../components/EmptyState'
import { DEPARTMENTS } from '../utils/constants'

function fmtErr(detail, fallback) {
  if (!detail) return fallback
  if (Array.isArray(detail)) return detail.map(i => i.msg || String(i)).join(', ')
  return String(detail)
}

const ROLE_BADGE = {
  super_admin: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800/50',
  admin:       'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50',
}

/* ── Password strength ──────────────────────────────── */
function PasswordStrength({ password }) {
  if (!password) return null
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ]
  const score = checks.filter(Boolean).length
  const COLORS  = ['bg-red-500', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-500', 'bg-emerald-600']
  const LABELS  = ['', 'Very weak', 'Weak', 'Fair', 'Strong', 'Very strong']
  const TXCOL   = ['', 'text-red-600 dark:text-red-400', 'text-orange-600 dark:text-orange-400', 'text-yellow-600 dark:text-yellow-400', 'text-emerald-600 dark:text-emerald-400', 'text-emerald-700 dark:text-emerald-300']
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < score ? COLORS[score] : 'bg-gray-200 dark:bg-gray-700'}`} />
        ))}
      </div>
      <p className={`text-[11px] font-medium ${TXCOL[score]}`}>{LABELS[score]}</p>
    </div>
  )
}

/* ── Field label wrapper ────────────────────────────── */
function FL({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

const EMPTY_FORM = { email: '', password: '', full_name: '', role: 'admin', phone: '', department: '', is_active: true, avatar: null }

/* ── Avatar upload ──────────────────────────────────── */
function AvatarUpload({ avatar, initial, onChange }) {
  const fileRef = useRef()

  const pick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const size = 120
        const canvas = document.createElement('canvas')
        canvas.width = size; canvas.height = size
        const ctx = canvas.getContext('2d')
        const s = Math.min(img.width, img.height)
        const ox = (img.width - s) / 2; const oy = (img.height - s) / 2
        ctx.drawImage(img, ox, oy, s, s, 0, 0, size, size)
        onChange(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className="flex items-center gap-4 mb-1">
      <button type="button" onClick={() => fileRef.current?.click()}
        className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 transition-colors group shrink-0">
        {avatar
          ? <img src={avatar} alt="" className="w-full h-full object-cover" />
          : (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-lg font-bold text-gray-400 dark:text-gray-600">
              {initial}
            </div>
          )}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
        </div>
      </button>
      <div>
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Profile photo</p>
        <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">Click to upload · JPG or PNG</p>
        {avatar && (
          <button type="button" onClick={() => onChange(null)}
            className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 mt-1 hover:underline">
            Remove photo
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
    </div>
  )
}

/* ── Create / Edit Modal ────────────────────────────── */
function UserModal({ mode, initial, onClose, onSaved }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_FORM, ...(initial || {}), password: '' }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        document.getElementById('user-modal-form')?.requestSubmit()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      if (mode === 'create') {
        await api.post('/auth/users', form)
      } else {
        const body = { ...form }
        if (!body.password?.trim()) delete body.password
        await api.patch(`/auth/users/${initial.id}`, body)
      }
      onSaved()
    } catch (err) {
      setError(fmtErr(err.response?.data?.detail, 'Operation failed'))
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-gray-900 rounded-2xl shadow-modal border border-gray-200 dark:border-gray-800 animate-slide-up">

        <div className="flex items-center justify-between px-6 pt-6 pb-5 border-b border-gray-100 dark:border-gray-800">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              {mode === 'create' ? 'Create new user' : 'Edit user'}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
              {mode === 'create' ? 'Add a new team member · Ctrl+Enter to save' : `Editing ${initial?.email}`}
            </p>
          </div>
          <button onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <form id="user-modal-form" onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-xl text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50">
              <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <span>{error}</span>
            </div>
          )}

          <AvatarUpload
            avatar={form.avatar}
            initial={(form.full_name?.[0] || form.email?.[0] || '?').toUpperCase()}
            onChange={v => set('avatar', v)}
          />

          <div className="grid grid-cols-2 gap-4">
            <FL label="Full name">
              <input type="text" value={form.full_name} onChange={e => set('full_name', e.target.value)}
                className="input-field" placeholder="Jane Doe" />
            </FL>
            <FL label="Role">
              <select value={form.role} onChange={e => set('role', e.target.value)}
                className="input-field appearance-none cursor-pointer">
                <option value="admin">Admin</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </FL>
          </div>

          <FL label="Email address">
            <input type="email" required={mode === 'create'} value={form.email}
              onChange={e => set('email', e.target.value)}
              className="input-field" placeholder="user@bank.com" autoComplete="off" />
          </FL>

          <FL label={mode === 'create' ? 'Password' : 'New password (leave blank to keep)'}>
            <input type="password" required={mode === 'create'} value={form.password}
              onChange={e => set('password', e.target.value)}
              className="input-field" placeholder={mode === 'create' ? '••••••••' : 'Leave blank to keep current'}
              autoComplete="new-password" />
            <PasswordStrength password={form.password} />
          </FL>

          <div className="grid grid-cols-2 gap-4">
            <FL label="Phone number">
              <input type="tel" value={form.phone || ''} onChange={e => set('phone', e.target.value)}
                className="input-field" placeholder="+216 XX XXX XXX" />
            </FL>
            <FL label="Department">
              <select value={form.department || ''} onChange={e => set('department', e.target.value)}
                className="input-field appearance-none cursor-pointer">
                <option value="">Select a department…</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </FL>
          </div>

          {mode === 'edit' && (
            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700">
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Account active</p>
                <p className="text-xs text-gray-400 dark:text-gray-600 mt-0.5">Inactive users cannot log in</p>
              </div>
              <button type="button" onClick={() => set('is_active', !form.is_active)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none ${form.is_active ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="btn-outline h-9 px-4">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary h-9 px-5">
              {saving ? (
                <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Saving…</>
              ) : mode === 'create' ? 'Create user' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Delete dialog ──────────────────────────────────── */
function DeleteDialog({ user, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const handleDelete = async () => {
    setDeleting(true); setError('')
    try {
      await api.delete(`/auth/users/${user.id}`)
      onDeleted()
    } catch (err) {
      setError(fmtErr(err.response?.data?.detail, 'Delete failed'))
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 rounded-2xl shadow-modal border border-gray-200 dark:border-gray-800 animate-slide-up p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 shrink-0">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Delete user</h3>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">This action cannot be undone</p>
          </div>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
          Are you sure you want to delete{' '}
          <span className="font-semibold text-gray-900 dark:text-gray-100">{user.full_name || user.email}</span>?
          Their account will be permanently removed.
        </p>
        {error && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{error}</p>}
        <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} className="btn-outline h-9 px-4">Cancel</button>
          <button onClick={handleDelete} disabled={deleting} className="btn-danger h-9 px-4">
            {deleting ? <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Deleting…</> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Data Upload tab ────────────────────────────────── */
function DataUploadTab({ showToast }) {
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [preview, setPreview] = useState(null)
  const [sessionToken, setSessionToken] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const fileRef = useRef()

  useEffect(() => {
    ;(async () => {
      setHistoryLoading(true)
      try {
        const { data } = await api.get('/upload/history')
        setHistory(data || [])
      } catch { setHistory([]) }
      finally { setHistoryLoading(false) }
    })()
  }, [])

  const uploadFile = async (file) => {
    if (!file) return
    const validTypes = ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel']
    const validExts = /\.(csv|xlsx|xls)$/i
    if (!validTypes.includes(file.type) && !validExts.test(file.name)) {
      showToast('Only CSV and XLSX files are supported', 'error')
      return
    }

    setUploading(true)
    setProgress(0)
    setPreview(null)
    setSessionToken(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/upload/dataset', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100))
        },
      })
      setPreview(data)
      setSessionToken(data.session_token || data.token || null)
      showToast(`File uploaded — ${data.rows || data.total_rows || '?'} rows detected`)
    } catch (err) {
      showToast(fmtErr(err.response?.data?.detail, 'Upload failed'), 'error')
    } finally { setUploading(false); setProgress(0) }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) uploadFile(file)
  }

  const confirmImport = async () => {
    if (!sessionToken) return
    setConfirming(true)
    try {
      await api.post('/upload/confirm', { session_token: sessionToken })
      showToast('Dataset imported successfully')
      setPreview(null)
      setSessionToken(null)
      // Refresh history
      const { data } = await api.get('/upload/history')
      setHistory(data || [])
    } catch (err) {
      showToast(fmtErr(err.response?.data?.detail, 'Import confirmation failed'), 'error')
    } finally { setConfirming(false) }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Data Upload</p>
        <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">Upload CSV or XLSX datasets to update the prediction database</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200 ${
          dragOver
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600'
            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
        } ${uploading ? 'pointer-events-none' : ''}`}>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
          onChange={e => uploadFile(e.target.files?.[0])} />
        {uploading ? (
          <>
            <svg className="w-10 h-10 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <div className="w-48 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div className="h-2 rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-500">Uploading… {progress}%</p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50">
              📁
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                {dragOver ? 'Release to upload' : 'Drop CSV or XLSX here'}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">
                or <span className="text-blue-600 dark:text-blue-400 font-medium">browse files</span> · Max 50 MB
              </p>
            </div>
          </>
        )}
      </div>

      {/* Preview table */}
      {preview && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Preview</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                {preview.rows || preview.total_rows || '?'} rows · {preview.columns?.length || '?'} columns detected
              </p>
            </div>
            <button onClick={confirmImport} disabled={confirming || !sessionToken}
              className="btn-primary h-9 px-4 gap-2 disabled:opacity-50">
              {confirming ? (
                <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Importing…</>
              ) : (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg> Confirm Import</>
              )}
            </button>
          </div>

          {preview.preview && preview.preview.length > 0 && (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                      {Object.keys(preview.preview[0]).map(col => (
                        <th key={col} className="px-3 py-2.5 text-left text-[10px] font-semibold text-gray-500 dark:text-gray-500 tracking-wide uppercase whitespace-nowrap">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
                    {preview.preview.slice(0, 10).map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="px-3 py-2 text-gray-600 dark:text-gray-400 whitespace-nowrap">{val ?? '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload history */}
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Upload History</p>
        {historyLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800/40">
                <div className="shimmer h-4 w-32 rounded-md" />
                <div className="shimmer h-4 w-20 rounded-md" />
                <div className="shimmer h-5 w-16 rounded-full ml-auto" />
              </div>
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-xs text-gray-400 dark:text-gray-600">No uploads yet</div>
        ) : (
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
                <span className="text-base">📄</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{h.filename || h.file_name || 'Dataset'}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-600">{h.rows || h.total_rows || '?'} rows · {h.uploaded_at ? new Date(h.uploaded_at).toLocaleDateString() : '—'}</p>
                </div>
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                  h.status === 'confirmed' || h.status === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                    : h.status === 'pending'
                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500 border-gray-200 dark:border-gray-700'
                }`}>
                  {h.status || 'uploaded'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Users tab ──────────────────────────────────────── */
function UsersTab({ loading, filtered, search, setSearch, roleFilter, setRoleFilter, me, onEdit, onDelete, onNew }) {
  return (
    <>
      {/* Search + filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email, department…"
            className="input-field pl-9 h-9" />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          )}
        </div>

        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="px-3 py-2 h-9 text-sm rounded-xl cursor-pointer appearance-none
                     bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800
                     text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all">
          <option value="">All roles</option>
          <option value="admin">Admin</option>
          <option value="super_admin">Super Admin</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                {['User', 'Role', 'Phone', 'Department', 'Status', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 dark:text-gray-500 tracking-wide uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800/60">
              {loading ? (
                [...Array(4)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-4"><div className="flex items-center gap-3"><div className="shimmer w-8 h-8 rounded-xl shrink-0"/><div className="space-y-1.5"><div className="shimmer h-3.5 w-32 rounded-md"/><div className="shimmer h-3 w-44 rounded-md"/></div></div></td>
                    <td className="px-4 py-4"><div className="shimmer h-5 w-20 rounded-full"/></td>
                    <td className="px-4 py-4"><div className="shimmer h-4 w-28 rounded-md"/></td>
                    <td className="px-4 py-4"><div className="shimmer h-4 w-28 rounded-md"/></td>
                    <td className="px-4 py-4"><div className="shimmer h-5 w-16 rounded-full"/></td>
                    <td className="px-4 py-4"><div className="shimmer h-7 w-16 rounded-lg"/></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon="users"
                      title={search || roleFilter ? 'No users match your search' : 'No users yet'}
                      description={search || roleFilter ? 'Try adjusting your search or filter.' : 'Create the first user account.'}
                      action={search || roleFilter ? () => { setSearch(''); setRoleFilter('') } : onNew}
                      actionLabel={search || roleFilter ? 'Clear filters' : 'Create user'}
                    />
                  </td>
                </tr>
              ) : (
                filtered.map(u => {
                  const initial = (u.full_name?.[0] || u.email?.[0] || '?').toUpperCase()
                  const roleBadge = ROLE_BADGE[u.role] || ROLE_BADGE.admin
                  const isMe = String(u.id) === String(me?.id ?? '')
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors group">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          {u.avatar
                            ? <img src={u.avatar} alt="" className="w-8 h-8 rounded-xl object-cover shrink-0 border border-gray-200 dark:border-gray-700" />
                            : (
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 border ${
                                u.role === 'super_admin'
                                  ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800/50'
                                  : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50'
                              }`}>
                                {initial}
                              </div>
                            )
                          }
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {u.full_name || '—'}
                              {isMe && <span className="text-xs text-blue-500 font-normal ml-1.5">(you)</span>}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-600 truncate">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${roleBadge}`}>
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-600 dark:text-gray-400">
                        {u.phone || <span className="text-gray-300 dark:text-gray-700">—</span>}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-gray-600 dark:text-gray-400">
                        {u.department || <span className="text-gray-300 dark:text-gray-700">—</span>}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                          u.is_active
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500 border-gray-200 dark:border-gray-700'
                        }`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => onEdit(u)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                            title="Edit">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                            </svg>
                          </button>
                          {!isMe && (
                            <button onClick={() => onDelete(u)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                              title="Delete">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

/* ── Main page ──────────────────────────────────────── */
export default function AdminPanel() {
  const { user: me, updateUser } = useAuthStore()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [modal, setModal] = useState(null)
  const [delTarget, setDelTarget] = useState(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [activeTab, setActiveTab] = useState('users')

  const isSuperAdmin = me?.role === 'super_admin'

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/auth/users')
      setUsers(data)
    } catch (err) {
      showToast(fmtErr(err.response?.data?.detail, 'Failed to load users'), 'error')
    } finally { setLoading(false) }
  }, [showToast])

  useEffect(() => { loadUsers() }, [loadUsers])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return users.filter(u => {
      const matchesSearch = !q ||
        u.email?.toLowerCase().includes(q) ||
        u.full_name?.toLowerCase().includes(q) ||
        u.department?.toLowerCase().includes(q) ||
        u.phone?.includes(q)
      const matchesRole = !roleFilter || u.role === roleFilter
      return matchesSearch && matchesRole
    })
  }, [users, search, roleFilter])

  const savedUserId = modal?.user?.id
  const savedMode = modal?.mode
  const handleSaved = useCallback(async () => {
    setModal(null)
    await loadUsers()
    showToast(savedMode === 'create' ? 'User created successfully' : 'User updated successfully')
    if (savedMode === 'edit' && savedUserId && String(savedUserId) === String(me?.id)) {
      try {
        const { data: fresh } = await api.get('/auth/me')
        updateUser(fresh)
      } catch { /* silent */ }
    }
  }, [savedMode, savedUserId, me, loadUsers, updateUser, showToast])

  const handleDeleted = useCallback(async () => {
    setDelTarget(null)
    await loadUsers()
    showToast('User deleted')
  }, [loadUsers, showToast])

  const TABS = [
    { id: 'users', label: 'Users', icon: '👥' },
    ...(isSuperAdmin ? [
      { id: 'upload', label: 'Data Upload', icon: '📤' },
    ] : []),
  ]

  return (
    <div className="space-y-5 w-full">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[100] flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium shadow-lg border animate-slide-up ${
          toast.type === 'error'
            ? 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/50'
            : 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50'
        }`}>
          {toast.type === 'error'
            ? <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            : <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
          }
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Admin Panel</h1>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">
            {users.length} account{users.length !== 1 ? 's' : ''}
            {filtered.length !== users.length && activeTab === 'users' && ` · ${filtered.length} shown`}
          </p>
        </div>
        {activeTab === 'users' && (
          <button onClick={() => setModal({ mode: 'create' })} className="btn-primary gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
            New user
          </button>
        )}
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}>
            <span className="text-base">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'users' && (
        <UsersTab
          users={users}
          loading={loading}
          filtered={filtered}
          search={search}
          setSearch={setSearch}
          roleFilter={roleFilter}
          setRoleFilter={setRoleFilter}
          me={me}
          onEdit={(u) => setModal({ mode: 'edit', user: u })}
          onDelete={setDelTarget}
          onNew={() => setModal({ mode: 'create' })}
        />
      )}

      {activeTab === 'upload' && isSuperAdmin && (
        <DataUploadTab showToast={showToast} />
      )}

      {modal && (
        <UserModal mode={modal.mode} initial={modal.user} onClose={() => setModal(null)} onSaved={handleSaved} />
      )}
      {delTarget && (
        <DeleteDialog user={delTarget} onClose={() => setDelTarget(null)} onDeleted={handleDeleted} />
      )}
    </div>
  )
}
