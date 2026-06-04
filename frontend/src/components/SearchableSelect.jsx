import { useState, useRef, useEffect, useCallback } from 'react'

/**
 * SearchableSelect — zero-dependency filterable combobox.
 *
 * Props:
 *   value       {string}   — currently selected value
 *   onChange    {fn}       — called with new value string
 *   options     {string[]} — list of selectable strings
 *   placeholder {string}
 *   loading     {boolean}  — show spinner while options load
 *   disabled    {boolean}
 *   className   {string}   — extra classes on the wrapper div
 */
export default function SearchableSelect({
  value = '',
  onChange,
  options = [],
  placeholder = 'Select…',
  loading = false,
  disabled = false,
  className = '',
}) {
  const [open, setOpen]           = useState(false)
  const [query, setQuery]         = useState('')
  const [cursor, setCursor]       = useState(-1)

  const inputRef    = useRef(null)
  const listRef     = useRef(null)
  const containerRef = useRef(null)

  // Filter options (case-insensitive substring) — cap at 100 for performance
  const filtered = options
    .filter(o => String(o ?? '').toLowerCase().includes(query.toLowerCase()))
    .slice(0, 100)

  // Close on click outside
  useEffect(() => {
    function onMouseDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
        setQuery('')
        setCursor(-1)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  // Scroll highlighted item into view
  useEffect(() => {
    if (cursor >= 0 && listRef.current) {
      const item = listRef.current.children[cursor]
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [cursor])

  const select = useCallback((opt) => {
    onChange(opt)
    setOpen(false)
    setQuery('')
    setCursor(-1)
    inputRef.current?.blur()
  }, [onChange])

  function handleKeyDown(e) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setOpen(true)
        setCursor(0)
        e.preventDefault()
      }
      return
    }
    if (e.key === 'ArrowDown') {
      setCursor(c => Math.min(c + 1, filtered.length - 1))
      e.preventDefault()
    } else if (e.key === 'ArrowUp') {
      setCursor(c => Math.max(c - 1, 0))
      e.preventDefault()
    } else if (e.key === 'Enter') {
      if (cursor >= 0 && filtered[cursor]) select(filtered[cursor])
      e.preventDefault()
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery('')
      setCursor(-1)
    }
  }

  const displayValue = open ? query : (value || '')

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          placeholder={value || placeholder}
          disabled={disabled || loading}
          onFocus={() => { setOpen(true); setQuery(''); setCursor(-1) }}
          onChange={e => { setQuery(e.target.value); setCursor(-1) }}
          onKeyDown={handleKeyDown}
          className={[
            'w-full px-3 py-2 pr-8 rounded-lg border text-sm transition-colors',
            'bg-white dark:bg-gray-800',
            'border-gray-300 dark:border-gray-600',
            'text-gray-900 dark:text-gray-100',
            'placeholder-gray-400 dark:placeholder-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            disabled || loading ? 'opacity-50 cursor-not-allowed' : 'cursor-text',
          ].join(' ')}
        />

        {/* Chevron / spinner */}
        <span className="absolute inset-y-0 right-2 flex items-center pointer-events-none">
          {loading ? (
            <svg className="animate-spin h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : (
            <svg className={`h-4 w-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
                 viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd"
                    d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                    clipRule="evenodd" />
            </svg>
          )}
        </span>
      </div>

      {/* Dropdown */}
      {open && !loading && (
        <ul
          ref={listRef}
          className={[
            'absolute z-50 mt-1 w-full rounded-lg border shadow-lg',
            'bg-white dark:bg-gray-800',
            'border-gray-200 dark:border-gray-600',
            'overflow-y-auto',
          ].join(' ')}
          style={{ maxHeight: 240 }}
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500 select-none">
              No matches found
            </li>
          ) : (
            filtered.map((opt, i) => (
              <li
                key={String(opt)}
                onMouseDown={() => select(opt)}
                onMouseEnter={() => setCursor(i)}
                className={[
                  'px-3 py-2 text-sm cursor-pointer select-none',
                  i === cursor
                    ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    : opt === value
                      ? 'bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-medium'
                      : 'text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700',
                ].join(' ')}
              >
                {opt}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
