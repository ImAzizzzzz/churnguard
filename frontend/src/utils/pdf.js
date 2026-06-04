/**
 * Export a DOM element to a single, content-fitted PDF page (no A4 whitespace).
 * - Captures WYSIWYG via html2canvas (real layout — no width/window overrides
 *   that clip charts or pad the right edge).
 * - Recharts containers are pinned to their live size so charts don't reflow.
 * - Anything with `data-export-ignore="true"` (e.g. buttons) is omitted.
 *
 * @param {HTMLElement} el       element to capture
 * @param {object}      opts
 * @param {string}      opts.title     header shown at the top of the PDF
 * @param {string}      opts.filename  download filename
 */
export async function exportElementToPDF(el, { title = 'Report', filename = 'report.pdf' } = {}) {
  if (!el) return
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ])

  const isDark = document.documentElement.classList.contains('dark')
  const bg = isDark ? '#030712' : '#ffffff'

  const canvas = await html2canvas(el, {
    scale: 3,                              // sharper text (avoids sub-pixel clipping)
    backgroundColor: bg,
    useCORS: true,
    logging: false,
    scrollX: 0,
    scrollY: 0,
    ignoreElements: (node) => node.dataset?.exportIgnore === 'true',
    onclone: (doc) => {
      // Pin Recharts charts to their live size so they don't reflow/clip.
      const live = el.querySelectorAll('.recharts-responsive-container')
      doc.querySelectorAll('.recharts-responsive-container').forEach((node, i) => {
        const r = live[i]?.getBoundingClientRect()
        if (r) { node.style.width = `${r.width}px`; node.style.height = `${r.height}px` }
      })
      // html2canvas uniformly clips the bottom of glyphs with the Inter webfont
      // (bad baseline metrics) and with tight Tailwind line-heights. Render the
      // capture in a metrics-safe font + generous line-height so text is whole.
      const fix = doc.createElement('style')
      fix.textContent = `
        body * {
          font-family: Arial, Helvetica, sans-serif !important;
          line-height: 1.6 !important;
        }
      `
      doc.head.appendChild(fix)
    },
  })

  const margin = 8
  const headerH = 16
  const contentW = 210                 // mm — comfortable reading width
  const imgW = contentW - margin * 2
  const imgH = (canvas.height / canvas.width) * imgW
  const pageH = imgH + headerH + margin

  const pdf = new jsPDF({
    orientation: contentW >= pageH ? 'landscape' : 'portrait',
    unit: 'mm',
    format: [contentW, pageH],
  })
  pdf.setFontSize(15)
  pdf.setFont('helvetica', 'bold')
  pdf.text(title, margin, 11)
  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(130, 130, 130)
  pdf.text(`Generated ${new Date().toLocaleString()}`, margin, 15)
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', margin, headerH, imgW, imgH)
  pdf.save(filename)
}
