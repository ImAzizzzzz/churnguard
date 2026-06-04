import { useEffect, useState, useRef, useCallback } from 'react'
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

export default function DataUpload() {
  const [toast, setToast] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [preview, setPreview] = useState(null)
  const [sessionToken, setSessionToken] = useState(null)
  const [confirming, setConfirming] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const fileRef = useRef()

  const showToast = useCallback((msg, type = 'success') => {
    setToast({ msg, type })
  }, [])

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true)
    try {
      const { data } = await api.get('/upload/history')
      setHistory(data || [])
    } catch { setHistory([]) }
    finally { setHistoryLoading(false) }
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  const uploadFile = async (file) => {
    if (!file) return
    const validExts = /\.(csv|xlsx|xls)$/i
    if (!validExts.test(file.name)) {
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
      showToast(`File uploaded — ${data.row_count || data.rows || '?'} rows detected`)
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
      // Backend expects Form data (session_token: str = Form(...))
      const fd = new FormData()
      fd.append('session_token', sessionToken)
      await api.post('/upload/confirm', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      showToast('Dataset imported successfully')
      setPreview(null)
      setSessionToken(null)
      await loadHistory()
    } catch (err) {
      showToast(fmtErr(err.response?.data?.detail, 'Import confirmation failed'), 'error')
    } finally { setConfirming(false) }
  }

  return (
    <div className="max-w-4xl space-y-6">

      {toast && <Toast msg={toast.msg} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Data Upload</h1>
        <p className="text-sm text-gray-500 dark:text-gray-500 mt-0.5">
          Upload CSV or XLSX datasets to update the prediction database
        </p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && fileRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-16 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-200 ${
          dragOver
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600'
            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10'
        } ${uploading ? 'pointer-events-none' : ''}`}>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
          onChange={e => uploadFile(e.target.files?.[0])} />
        {uploading ? (
          <>
            <svg className="w-12 h-12 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            <div className="w-56 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div className="h-2.5 rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-500">Uploading… {progress}%</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50">
              📁
            </div>
            <div className="text-center">
              <p className="text-base font-semibold text-gray-700 dark:text-gray-300">
                {dragOver ? 'Release to upload' : 'Drop CSV or XLSX here'}
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-600 mt-1">
                or <span className="text-blue-600 dark:text-blue-400 font-medium">browse files</span>
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-2">Supports .csv, .xlsx, .xls · Max 50 MB</p>
            </div>
          </>
        )}
      </div>

      {/* Preview */}
      {preview && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Preview</p>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                {preview.row_count || preview.rows || preview.total_rows || '?'} rows · {preview.columns?.length || '?'} columns
                {preview.columns && (
                  <> · Columns: <span className="font-medium text-gray-700 dark:text-gray-300">{preview.columns.slice(0, 5).join(', ')}{preview.columns.length > 5 ? ` +${preview.columns.length - 5} more` : ''}</span></>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setPreview(null); setSessionToken(null) }}
                className="btn-outline h-9 px-4 text-sm">
                Cancel
              </button>
              <button onClick={confirmImport} disabled={confirming || !sessionToken}
                className="btn-primary h-9 px-4 gap-2 text-sm disabled:opacity-50">
                {confirming ? (
                  <><svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Importing…</>
                ) : (
                  <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg> Confirm Import</>
                )}
              </button>
            </div>
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
              {(preview.row_count || preview.rows || preview.total_rows) > 10 && (
                <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30">
                  <p className="text-xs text-gray-400 dark:text-gray-600">
                    Showing 10 of {preview.row_count || preview.rows || preview.total_rows} rows
                  </p>
                </div>
              )}
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
              <div key={i} className="flex items-center gap-4 px-4 py-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
                <div className="shimmer h-4 w-40 rounded-md" />
                <div className="shimmer h-4 w-20 rounded-md" />
                <div className="shimmer h-4 w-24 rounded-md ml-auto" />
                <div className="shimmer h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="card p-8 flex flex-col items-center text-center">
            <span className="text-3xl mb-3">📭</span>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No uploads yet</p>
            <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">Uploaded datasets will appear here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i}
                className="flex items-center gap-4 px-4 py-3.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-colors">
                <span className="text-xl shrink-0">📄</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {h.filename || h.file_name || 'Dataset'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-600">
                    {h.rows || h.total_rows ? `${(h.rows || h.total_rows).toLocaleString()} rows · ` : ''}
                    {h.uploaded_at ? new Date(h.uploaded_at).toLocaleString() : '—'}
                    {h.uploaded_by && ` · by ${h.uploaded_by}`}
                  </p>
                </div>
                <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border shrink-0 ${
                  h.status === 'confirmed' || h.status === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50'
                    : h.status === 'pending'
                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50'
                    : h.status === 'failed'
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/50'
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
