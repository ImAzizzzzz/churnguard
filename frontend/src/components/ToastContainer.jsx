import { useUiStore } from '../store/uiStore'

const STYLES = {
  success: {
    ring: 'border-emerald-200 dark:border-emerald-800/50',
    bar: 'bg-emerald-500',
    iconWrap: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />,
  },
  error: {
    ring: 'border-red-200 dark:border-red-800/50',
    bar: 'bg-red-500',
    iconWrap: 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />,
  },
  warning: {
    ring: 'border-amber-200 dark:border-amber-800/50',
    bar: 'bg-amber-500',
    iconWrap: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />,
  },
  info: {
    ring: 'border-blue-200 dark:border-blue-800/50',
    bar: 'bg-blue-500',
    iconWrap: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
    icon: <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
  },
}

export default function ToastContainer() {
  const toasts = useUiStore((s) => s.toasts)
  const dismissToast = useUiStore((s) => s.dismissToast)

  if (!toasts.length) return null

  return (
    <div className="fixed bottom-5 right-5 z-[300] flex flex-col gap-2.5 w-[360px] max-w-[calc(100vw-2.5rem)] pointer-events-none">
      {toasts.map((t) => {
        const s = STYLES[t.type] || STYLES.info
        return (
          <div key={t.id}
            className={`pointer-events-auto relative flex items-start gap-3 pl-4 pr-3 py-3 rounded-xl bg-white dark:bg-gray-900 shadow-modal border ${s.ring} overflow-hidden animate-slide-up`}>
            <span className={`absolute left-0 top-0 bottom-0 w-1 ${s.bar}`} />
            <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${s.iconWrap}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.25} viewBox="0 0 24 24">
                {s.icon}
              </svg>
            </span>
            <div className="flex-1 min-w-0 pt-0.5">
              {t.title && (
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">{t.title}</p>
              )}
              {t.message && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed break-words">{t.message}</p>
              )}
            </div>
            <button onClick={() => dismissToast(t.id)}
              className="shrink-0 w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )
      })}
    </div>
  )
}
