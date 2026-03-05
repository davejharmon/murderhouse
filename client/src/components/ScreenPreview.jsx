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
    const ro = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / NATIVE_W)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    <div
      ref={containerRef}
      className={styles.container}
      style={{ height: Math.round(NATIVE_H * scale) }}
    >
      <iframe
        src='/screen'
        className={styles.frame}
        style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
        title='Screen preview'
      />
    </div>
  )
}
