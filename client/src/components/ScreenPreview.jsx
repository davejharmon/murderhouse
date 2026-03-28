// client/src/components/ScreenPreview.jsx
import { useRef, useEffect, useState } from 'react'
import styles from './ScreenPreview.module.css'

const NATIVE_W = 1920
const NATIVE_H = 1080

export default function ScreenPreview() {
  const containerRef = useRef(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const update = () => {
      const parent = el.parentElement
      if (!parent) return
      // Scale to fit available width, but also cap to available height in the scroll area
      const widthScale = el.clientWidth / NATIVE_W
      const availHeight = parent.clientHeight * 0.6 // Use at most 60% of scrollable area
      const heightScale = availHeight / NATIVE_H
      setScale(Math.min(widthScale, heightScale))
    }
    const ro = new ResizeObserver(update)
    ro.observe(el)
    if (el.parentElement) ro.observe(el.parentElement)
    return () => ro.disconnect()
  }, [])

  const scaledW = Math.round(NATIVE_W * scale)
  const scaledH = Math.round(NATIVE_H * scale)

  return (
    <div
      ref={containerRef}
      className={styles.container}
      style={{ height: scaledH }}
    >
      <div style={{ width: scaledW, height: scaledH, overflow: 'hidden' }}>
        <iframe
          src='/screen'
          className={styles.frame}
          style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
          title='Screen preview'
        />
      </div>
    </div>
  )
}
