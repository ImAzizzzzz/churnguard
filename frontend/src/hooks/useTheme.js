import { useState, useEffect, useCallback } from 'react'

export function useTheme() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  )

  useEffect(() => {
    const obs = new MutationObserver(() => {
      setDark(document.documentElement.classList.contains('dark'))
    })
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  const toggle = useCallback(() => {
    const next = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('cg-theme', next ? 'dark' : 'light')
  }, [])

  const chart = {
    grid:          dark ? '#1f2937' : '#e5e7eb',
    axis:          dark ? '#6b7280' : '#9ca3af',
    tooltipBg:     dark ? '#111827' : '#ffffff',
    tooltipBorder: dark ? '#374151' : '#e5e7eb',
    tooltipText:   dark ? '#f3f4f6' : '#111827',
    tooltipSub:    dark ? '#9ca3af' : '#6b7280',
  }

  return { dark, toggle, chart }
}
