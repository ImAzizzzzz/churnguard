/* Reusable empty-state component with inline SVG illustrations */

const ICONS = {
  chart: (
    <svg viewBox="0 0 80 64" fill="none" className="w-20 h-16">
      <rect x="8"  y="36" width="12" height="20" rx="2" className="fill-gray-200 dark:fill-gray-700" />
      <rect x="26" y="24" width="12" height="32" rx="2" className="fill-gray-200 dark:fill-gray-700" />
      <rect x="44" y="16" width="12" height="40" rx="2" className="fill-gray-200 dark:fill-gray-700" />
      <rect x="62" y="28" width="12" height="28" rx="2" className="fill-gray-200 dark:fill-gray-700" />
      <line x1="4" y1="58" x2="76" y2="58" className="stroke-gray-300 dark:stroke-gray-600" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="40" cy="20" r="10" className="fill-gray-100 dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600" strokeWidth="1.5"/>
      <line x1="40" y1="15" x2="40" y2="20" className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="40" cy="23" r="1.5" className="fill-gray-400 dark:fill-gray-500"/>
    </svg>
  ),
  database: (
    <svg viewBox="0 0 80 64" fill="none" className="w-20 h-16">
      <ellipse cx="40" cy="16" rx="24" ry="8" className="fill-gray-100 dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600" strokeWidth="1.5"/>
      <path d="M16 16 L16 40" className="stroke-gray-300 dark:stroke-gray-600" strokeWidth="1.5"/>
      <path d="M64 16 L64 40" className="stroke-gray-300 dark:stroke-gray-600" strokeWidth="1.5"/>
      <ellipse cx="40" cy="40" rx="24" ry="8" className="fill-gray-100 dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600" strokeWidth="1.5"/>
      <path d="M16 28 Q16 36 40 36 Q64 36 64 28" className="stroke-gray-200 dark:stroke-gray-700" strokeWidth="1.5" fill="none"/>
      <circle cx="40" cy="40" r="9" className="fill-white dark:fill-gray-900 stroke-gray-300 dark:stroke-gray-600" strokeWidth="1.5"/>
      <line x1="40" y1="35.5" x2="40" y2="40" className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="40" cy="43" r="1.5" className="fill-gray-400 dark:fill-gray-500"/>
    </svg>
  ),
  search: (
    <svg viewBox="0 0 80 64" fill="none" className="w-20 h-16">
      <circle cx="32" cy="28" r="18" className="fill-gray-100 dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600" strokeWidth="2"/>
      <line x1="45" y1="41" x2="68" y2="58" className="stroke-gray-300 dark:stroke-gray-600" strokeWidth="4" strokeLinecap="round"/>
      <circle cx="32" cy="28" r="8" className="fill-gray-200 dark:fill-gray-700" />
      <line x1="28" y1="24" x2="36" y2="32" className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  users: (
    <svg viewBox="0 0 80 64" fill="none" className="w-20 h-16">
      <circle cx="30" cy="20" r="10" className="fill-gray-100 dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600" strokeWidth="1.5"/>
      <circle cx="52" cy="22" r="8" className="fill-gray-100 dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600" strokeWidth="1.5"/>
      <path d="M6 54 C6 42 54 42 54 54" className="stroke-gray-300 dark:stroke-gray-600 fill-none" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M52 50 C52 44 74 44 74 50" className="stroke-gray-200 dark:stroke-gray-700 fill-none" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="52" cy="46" r="5" className="fill-white dark:fill-gray-900 stroke-gray-300 dark:stroke-gray-600" strokeWidth="1.5"/>
      <line x1="52" y1="43" x2="52" y2="46" className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="52" cy="48.5" r="1" className="fill-gray-400 dark:fill-gray-500"/>
    </svg>
  ),
  prediction: (
    <svg viewBox="0 0 80 64" fill="none" className="w-20 h-16">
      <rect x="8" y="8" width="64" height="48" rx="6" className="fill-gray-100 dark:fill-gray-800 stroke-gray-300 dark:stroke-gray-600" strokeWidth="1.5"/>
      <line x1="20" y1="32" x2="60" y2="32" className="stroke-gray-200 dark:stroke-gray-700" strokeWidth="1"/>
      <line x1="20" y1="42" x2="60" y2="42" className="stroke-gray-200 dark:stroke-gray-700" strokeWidth="1"/>
      <rect x="20" y="20" width="18" height="6" rx="2" className="fill-gray-200 dark:fill-gray-700"/>
      <rect x="42" y="20" width="18" height="6" rx="2" className="fill-gray-200 dark:fill-gray-700"/>
      <circle cx="40" cy="37" r="9" className="fill-white dark:fill-gray-900 stroke-gray-300 dark:stroke-gray-600" strokeWidth="1.5"/>
      <path d="M36 37 L39 40 L44 34" className="stroke-gray-400 dark:stroke-gray-500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
}

export default function EmptyState({ icon = 'chart', title, description, action, actionLabel }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="mb-4 opacity-80">
        {ICONS[icon] || ICONS.chart}
      </div>
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">{title}</p>
      {description && (
        <p className="text-xs text-gray-400 dark:text-gray-600 max-w-[240px] leading-relaxed">{description}</p>
      )}
      {action && actionLabel && (
        <button onClick={action}
          className="mt-4 btn-outline text-xs px-4 py-1.5 h-auto">
          {actionLabel}
        </button>
      )}
    </div>
  )
}
