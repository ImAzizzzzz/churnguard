import { useState, useEffect, useRef } from 'react'

export function useCountUp(target, duration = 1000) {
  const [value, setValue] = useState(0)
  const raf = useRef()

  useEffect(() => {
    const num = parseFloat(target)
    if (target == null || isNaN(num)) return
    const start = performance.now()

    const step = (now) => {
      const t = Math.min((now - start) / duration, 1)
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(num * eased)
      if (t < 1) raf.current = requestAnimationFrame(step)
      else setValue(num)
    }

    raf.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf.current)
  }, [target, duration])

  return value
}
