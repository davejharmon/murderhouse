// client/src/components/slides/HeartbeatSlide.jsx
import { useEffect, useRef, useState } from 'react'
import { bpmColor } from './slideUtils.js'
import { SLIDE_STRINGS } from './slideStrings.js'
import styles from '../../pages/Screen.module.css'

const BPM_HISTORY_DURATION = 30000 // 30 seconds visible on graph
const BPM_SAMPLE_INTERVAL  = 200   // Record a point every 200ms

function HeartbeatGraph({ bpm, active }) {
  const canvasRef    = useRef(null)
  const animRef      = useRef(null)
  const bpmRef       = useRef(bpm || 72)
  const activeRef    = useRef(active)
  const historyRef   = useRef([])
  const lastSampleRef = useRef(0)

  bpmRef.current    = bpm
  activeRef.current = active

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    const W = canvas.width
    const H = canvas.height
    const PAD_TOP = 30
    const PAD_BOT = 20
    const graphH = H - PAD_TOP - PAD_BOT

    const startTime = performance.now()
    historyRef.current = [{ time: startTime, bpm: bpmRef.current }]
    lastSampleRef.current = startTime

    const draw = (now) => {
      const currentBpm = bpmRef.current
      const isActive = activeRef.current

      if (now - lastSampleRef.current >= BPM_SAMPLE_INTERVAL) {
        historyRef.current.push({ time: now, bpm: isActive ? currentBpm : -1 })
        lastSampleRef.current = now
        const cutoff = now - BPM_HISTORY_DURATION - 2000
        while (historyRef.current.length > 2 && historyRef.current[0].time < cutoff) {
          historyRef.current.shift()
        }
      }

      const history = historyRef.current
      const yMin = 50
      const yMax = 180
      const yRange = yMax - yMin
      const bpmToY = (v) => PAD_TOP + graphH - ((v - yMin) / yRange) * graphH
      const timeToX = (t) => ((t - (now - BPM_HISTORY_DURATION)) / BPM_HISTORY_DURATION) * W

      ctx.fillStyle = 'rgba(10, 12, 15, 1)'
      ctx.fillRect(0, 0, W, H)

      // Grid lines
      ctx.strokeStyle = 'rgba(201, 76, 76, 0.08)'
      ctx.lineWidth = 1
      const gridStep = 20
      const gridStart = Math.ceil(yMin / gridStep) * gridStep
      ctx.font = '16px monospace'
      ctx.fillStyle = 'rgba(201, 76, 76, 0.25)'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      for (let v = gridStart; v <= yMax; v += gridStep) {
        const gy = bpmToY(v)
        ctx.beginPath()
        ctx.moveTo(0, gy)
        ctx.lineTo(W, gy)
        ctx.stroke()
        ctx.fillText(String(v), W - 8, gy)
      }

      // Trend line
      ctx.lineWidth = 4
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'

      let inSegment = false
      let lastActiveY = bpmToY(currentBpm > 0 ? currentBpm : (yMin + yMax) / 2)

      for (let i = 0; i < history.length; i++) {
        const pt = history[i]
        const x = timeToX(pt.time)
        if (x < -20) continue
        if (pt.bpm < 0) {
          if (inSegment) { ctx.stroke(); ctx.shadowBlur = 0; inSegment = false }
          continue
        }
        const y = bpmToY(pt.bpm)
        lastActiveY = y
        if (!inSegment) {
          ctx.beginPath()
          ctx.strokeStyle = '#c94c4c'
          ctx.shadowColor = '#c94c4c'
          ctx.shadowBlur = 16
          ctx.moveTo(x, y)
          inSegment = true
        } else {
          ctx.lineTo(x, y)
        }
      }
      if (inSegment) { ctx.stroke(); ctx.shadowBlur = 0 }

      // Leading dot
      if (isActive && history.length > 0) {
        const lastPt = history[history.length - 1]
        const x = timeToX(lastPt.time)
        const y = lastPt.bpm > 0 ? bpmToY(lastPt.bpm) : lastActiveY
        ctx.beginPath()
        ctx.arc(x, y, 7, 0, Math.PI * 2)
        ctx.fillStyle = '#ff6b6b'
        ctx.shadowColor = '#ff6b6b'
        ctx.shadowBlur = 24
        ctx.fill()
        ctx.shadowBlur = 0
      }

      // SIGNAL LOST overlay
      if (!isActive) {
        const flatY = H / 2
        ctx.strokeStyle = 'rgba(201, 76, 76, 0.3)'
        ctx.shadowBlur = 0
        ctx.lineWidth = 2
        ctx.setLineDash([12, 8])
        ctx.beginPath()
        ctx.moveTo(0, flatY)
        ctx.lineTo(W, flatY)
        ctx.stroke()
        ctx.setLineDash([])
        const blink = Math.sin(now / 500) > 0
        if (blink) {
          ctx.font = 'bold 40px monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = 'rgba(201, 76, 76, 0.8)'
          ctx.fillText('SIGNAL LOST', W / 2, H / 2)
        }
      }

      animRef.current = requestAnimationFrame(draw)
    }

    animRef.current = requestAnimationFrame(draw)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      width={1200}
      height={300}
      className={styles.heartbeatCanvas}
    />
  )
}

function AnimatedBpm({ value, threshold }) {
  const [displayed, setDisplayed] = useState(value)
  const displayedRef = useRef(value)
  const targetRef    = useRef(value)

  targetRef.current = value

  useEffect(() => {
    const tick = setInterval(() => {
      const target = targetRef.current
      const current = displayedRef.current
      if (current === target) return
      const next = current + Math.sign(target - current)
      displayedRef.current = next
      setDisplayed(next)
    }, 30)
    return () => clearInterval(tick)
  }, [])

  return (
    <span
      className={`${styles.thumbBpm} ${displayed >= threshold ? styles.thumbBpmDanger : ''}`}
      style={{ color: bpmColor(displayed, threshold) }}
    >{displayed}</span>
  )
}

export default function HeartbeatSlide({ slide, gameState, strings = SLIDE_STRINGS.heartbeat }) {
  const livePlayer = gameState?.players?.find(p => p.id === slide.playerId)
  const liveActive = livePlayer?.heartbeat?.active ?? true
  const liveBpm    = liveActive ? (livePlayer?.heartbeat?.bpm || slide.bpm || 72) : 0
  const isDebug    = livePlayer?.heartbeat?.fake ?? slide.fake ?? false

  return (
    <div className={`${styles.slide} ${styles.heartbeatSlide}`}>
      <div className={styles.heartbeatHeader}>
        <div className={styles.portraitWrap}>
          <img
            src={`/images/players/${slide.portrait}`}
            alt={slide.playerName}
            className={styles.heartbeatPortrait}
          />
          {livePlayer?.hasNovote && <div className={styles.tooMadBadgeLarge}>{strings.mad ?? SLIDE_STRINGS.death.mad}</div>}
        </div>
        <span className={styles.heartbeatName}>{slide.playerName}</span>
        {isDebug && <span className={styles.heartbeatDebugBadge}>{strings.debug}</span>}
      </div>
      {slide.title && (
        <p className={styles.heartbeatSlideTitle}>{slide.title}</p>
      )}
      <HeartbeatGraph bpm={liveBpm} active={liveActive} />
      <div className={styles.heartbeatBpmRow}>
        <span className={`${styles.heartbeatBpm} ${!liveActive ? styles.heartbeatBpmLost : ''}`}>
          {liveActive ? liveBpm : '—'}
        </span>
        <span className={styles.heartbeatLabel}>{strings.bpm}</span>
      </div>
      {slide.subtitle && (
        <p className={styles.heartbeatSlideSubtitle}>{slide.subtitle}</p>
      )}
    </div>
  )
}
