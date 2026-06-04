import { useState, useCallback, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/uiStore'
import api from '../api/axios'
import { DEPARTMENTS } from '../utils/constants'
import { resizeToAvatar } from '../utils/image'

// Stable per-color palette — derived from email hash
const AVATAR_COLORS = [
  'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50',
  'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800/50',
  'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50',
  'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50',
  'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50',
  'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/50',
]

const ROLE_LABEL = { super_admin: 'Super Admin', admin: 'Admin' }
const ROLE_BADGE = {
  super_admin: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800/50',
  admin:       'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50',
}

export default function Profile() {
  const { user, setUser } = useAuthStore()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ full_name: user?.full_name || '', phone: user?.phone || '', department: user?.department || '' })
  const [avatarBusy, setAvatarBusy] = useState(false)
  const avatarFileRef = useRef()

  const saveAvatar = useCallback(async (avatar) => {
    setAvatarBusy(true)
    try {
      const { data } = await api.put('/auth/users/me', { avatar })
      if (setUser) setUser(data)
      toast.success(avatar ? 'Photo updated' : 'Photo removed', 'Your profile photo has been saved.')
    } catch {
      toast.error('Upload failed', 'Could not save your photo. Please try again.')
    } finally {
      setAvatarBusy(false)
    }
  }, [setUser])

  const onPickAvatar = useCallback(async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const dataUrl = await resizeToAvatar(file)
      await saveAvatar(dataUrl)
    } catch (err) {
      toast.error('Invalid image', err.message || 'Please choose a JPG or PNG.')
    }
  }, [saveAvatar])

  // Change-password state
  const [pwd, setPwd] = useState({ current_password: '', new_password: '', confirm: '' })
  const [pwdSaving, setPwdSaving] = useState(false)

  const handleChangePassword = useCallback(async () => {
    if (pwd.new_password.length < 8) {
      toast.error('Validation', 'New password must be at least 8 characters.'); return
    }
    if (pwd.new_password !== pwd.confirm) {
      toast.error('Validation', 'New password and confirmation do not match.'); return
    }
    setPwdSaving(true)
    try {
      await api.put('/auth/users/me/password', {
        current_password: pwd.current_password,
        new_password: pwd.new_password,
      })
      toast.success('Password changed', 'Use your new password next time you sign in.')
      setPwd({ current_password: '', new_password: '', confirm: '' })
    } catch (err) {
      toast.error('Could not change password', err.response?.data?.detail || 'Please try again.')
    } finally {
      setPwdSaving(false)
    }
  }, [pwd])

  const initial = (user?.full_name?.[0] || user?.email?.[0] || '?').toUpperCase()
  const initials = (user?.full_name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('') || initial

  const colorIdx = (user?.email || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 6
  const avatarColor = AVATAR_COLORS[colorIdx]

  const handleSave = useCallback(async () => {
    if (!form.full_name.trim()) { toast.error('Validation', 'Name cannot be empty.'); return }
    setSaving(true)
    try {
      const { data } = await api.put('/auth/users/me', {
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || null,
        department: form.department || null,
      })
      if (setUser) setUser(data)
      toast.success('Profile updated', 'Your changes have been saved.')
      setEditing(false)
    } catch {
      toast.error('Save failed', 'Could not save your profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }, [form, setUser])

  return (
    <div className="max-w-2xl space-y-6 mx-auto">
      {/* Avatar + name header */}
      <div className="card p-8 flex flex-col items-center gap-5">
        <div className="relative">
          <button
            type="button"
            onClick={() => avatarFileRef.current?.click()}
            disabled={avatarBusy}
            aria-label="Change profile photo"
            className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-700 group disabled:opacity-60">
            {user?.avatar
              ? <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
              : <div className={`w-full h-full flex items-center justify-center text-3xl font-bold ${avatarColor}`}>{initials}</div>}
            <div className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {avatarBusy ? (
                <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </div>
          </button>
          <input ref={avatarFileRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
        </div>
        {user?.avatar && !avatarBusy && (
          <button type="button" onClick={() => saveAvatar(null)}
            className="-mt-2 text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:underline">
            Remove photo
          </button>
        )}
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{user?.full_name || '—'}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">{user?.email}</p>
          <span className={`mt-2 inline-flex text-[11px] font-semibold px-3 py-0.5 rounded-full border ${ROLE_BADGE[user?.role] || ROLE_BADGE.admin}`}>
            {ROLE_LABEL[user?.role] || user?.role}
          </span>
        </div>
      </div>

      {/* Profile details */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Profile details</p>
          {!editing && (
            <button
              onClick={() => { setForm({ full_name: user?.full_name || '', phone: user?.phone || '', department: user?.department || '' }); setEditing(true) }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4">
          {/* Full name */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-500 block mb-1.5">Full name</label>
            {editing ? (
              <input
                type="text"
                value={form.full_name}
                onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
              />
            ) : (
              <p className="text-sm text-gray-900 dark:text-gray-100 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                {user?.full_name || '—'}
              </p>
            )}
          </div>

          {/* Email — always read-only */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-500 block mb-1.5">Email <span className="text-gray-400">(read-only)</span></label>
            <p className="text-sm text-gray-700 dark:text-gray-400 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
              {user?.email || '—'}
            </p>
          </div>

          {/* Phone */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-500 block mb-1.5">Phone</label>
            {editing ? (
              <input
                type="tel"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="+216 XX XXX XXX"
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
              />
            ) : (
              <p className="text-sm text-gray-900 dark:text-gray-100 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                {user?.phone || <span className="text-gray-400 dark:text-gray-600 italic">Not set</span>}
              </p>
            )}
          </div>

          {/* Department — choose from a list */}
          <div>
            <label className="text-xs font-medium text-gray-500 dark:text-gray-500 block mb-1.5">Department</label>
            {editing ? (
              <select
                value={form.department}
                onChange={e => setForm(f => ({ ...f, department: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all cursor-pointer">
                <option value="">Select a department…</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            ) : (
              <p className="text-sm text-gray-900 dark:text-gray-100 px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-100 dark:border-gray-800">
                {user?.department || <span className="text-gray-400 dark:text-gray-600 italic">Not set</span>}
              </p>
            )}
          </div>
        </div>

        {editing && (
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary h-9 px-5 text-sm disabled:opacity-50">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="px-4 py-2 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Change password */}
      <div className="card p-6 space-y-4">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Change password</p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">Choose a strong password of at least 8 characters.</p>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {[
            { key: 'current_password', label: 'Current password', auto: 'current-password' },
            { key: 'new_password', label: 'New password', auto: 'new-password' },
            { key: 'confirm', label: 'Confirm new password', auto: 'new-password' },
          ].map(({ key, label, auto }) => (
            <div key={key}>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-500 block mb-1.5">{label}</label>
              <input
                type="password"
                autoComplete={auto}
                value={pwd[key]}
                onChange={e => setPwd(p => ({ ...p, [key]: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
              />
            </div>
          ))}
        </div>
        <div className="pt-1">
          <button
            onClick={handleChangePassword}
            disabled={pwdSaving || !pwd.current_password || !pwd.new_password || !pwd.confirm}
            className="btn-primary h-9 px-5 text-sm disabled:opacity-50">
            {pwdSaving ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </div>
    </div>
  )
}
