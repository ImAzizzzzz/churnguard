import { useRef } from 'react'

/**
 * ChartCard — reusable card that wraps Recharts content and provides
 * PNG and PDF export buttons (appear on hover).
 *
 * Props:
 *   title     {string}   — chart title (used in export filenames + PDF header)
 *   subtitle  {string}   — optional subtitle below the title
 *   children  {node}     — chart content
 *   className {string}   — extra classes for the outer wrapper
 *   wide      {boolean}  — when true the card spans 2 columns (col-span-2)
 *                          and uses landscape A4 for PDF export
 */
export default function ChartCard({ title, subtitle, children, className = '', wide = false }) {
  const containerRef = useRef(null)

  // ── helpers ─────────────────────────────────────────────────────────────────

  const slug = (s) => (s || 'chart').replace(/\s+/g, '_').toLowerCase()

  /**
   * Capture the whole card (title + subtitle + chart + legend) to a high-res
   * canvas via html2canvas. Serializing just the <svg> dropped the HTML legend
   * and CSS fonts, which made exports look broken — rendering the live DOM at
   * 3× fixes both. The export toolbar is skipped via the data-export-ignore tag.
   */
  const captureCard = async () => {
    const { default: html2canvas } = await import('html2canvas')
    const isDark = document.documentElement.classList.contains('dark')
    const el = containerRef.current
    return html2canvas(el, {
      scale: 3,
      backgroundColor: isDark ? '#111827' : '#ffffff',
      useCORS: true,
      logging: false,
      scrollX: 0,
      scrollY: 0,
      ignoreElements: (node) => node.dataset?.exportIgnore === 'true',
      onclone: (doc) => {
        // Pin the chart to its live size so the right edge isn't clipped.
        const live = el.querySelectorAll('.recharts-responsive-container')
        doc.querySelectorAll('.recharts-responsive-container').forEach((node, i) => {
          const r = live[i]?.getBoundingClientRect()
          if (r) { node.style.width = `${r.width}px`; node.style.height = `${r.height}px` }
        })
        // Metrics-safe font + generous line-height so glyph bottoms aren't clipped.
        const fix = doc.createElement('style')
        fix.textContent = 'body * { font-family: Arial, Helvetica, sans-serif !important; line-height: 1.6 !important; }'
        doc.head.appendChild(fix)
      },
    })
  }

  /** Fallback: download the raw SVG when canvas export fails (e.g. tainted canvas). */
  const fallbackSVGDownload = () => {
    const svg = containerRef.current?.querySelector('.recharts-surface')
    if (!svg) return
    const svgStr = new XMLSerializer().serializeToString(svg)
    const blob   = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const url    = URL.createObjectURL(blob)
    Object.assign(document.createElement('a'), {
      href:     url,
      download: `${slug(title)}.svg`,
    }).click()
    URL.revokeObjectURL(url)
  }

  // ── export PNG ───────────────────────────────────────────────────────────────

  const exportPNG = async () => {
    try {
      const canvas = await captureCard()
      Object.assign(document.createElement('a'), {
        href:     canvas.toDataURL('image/png'),
        download: `${slug(title)}.png`,
      }).click()
    } catch {
      fallbackSVGDownload()
    }
  }

  // ── export PDF ───────────────────────────────────────────────────────────────

  const exportPDF = async () => {
    try {
      const canvas = await captureCard()
      const { default: jsPDF } = await import('jspdf')

      // Page sized exactly to the chart card (small margin) — no wasted whitespace.
      const margin = 6
      const imgW = 180                          // mm
      const imgH = (canvas.height / canvas.width) * imgW
      const pageW = imgW + margin * 2
      const pageH = imgH + margin * 2
      const pdf = new jsPDF({
        orientation: pageW >= pageH ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [pageW, pageH],
      })
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, margin, imgW, imgH)
      pdf.save(`${slug(title)}.pdf`)
    } catch {
      // If PDF fails try PNG as last resort
      try { await exportPNG() } catch { /* silent */ }
    }
  }

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className={`card p-5 relative group ${wide ? 'col-span-2' : ''} ${className}`}
    >
      {/* Header */}
      {(title || subtitle) && (
        <div className="mb-4">
          {title && (
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 leading-tight">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>
          )}
        </div>
      )}

      {/* Export buttons — visible on hover (excluded from the exported image) */}
      <div data-export-ignore="true"
        className="absolute top-4 right-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
        {/* PNG download */}
        <button
          onClick={exportPNG}
          title="Export as PNG"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium
                     text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800
                     border border-gray-200 dark:border-gray-700
                     hover:text-blue-600 dark:hover:text-blue-400
                     hover:border-blue-300 dark:hover:border-blue-600
                     transition-all duration-150 shadow-sm"
        >
          {/* Arrow-down icon */}
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          PNG
        </button>

        {/* PDF download */}
        <button
          onClick={exportPDF}
          title="Export as PDF"
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium
                     text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800
                     border border-gray-200 dark:border-gray-700
                     hover:text-red-600 dark:hover:text-red-400
                     hover:border-red-300 dark:hover:border-red-600
                     transition-all duration-150 shadow-sm"
        >
          {/* Document icon */}
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          PDF
        </button>
      </div>

      {/* Chart content */}
      {children}
    </div>
  )
}
