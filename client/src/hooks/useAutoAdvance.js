// client/src/hooks/useAutoAdvance.js
// Manages auto-advance timer for the slide queue.
// Returns `pause()` to temporarily halt auto-advance (e.g. when host goes back a slide).

import { useEffect, useRef, useCallback } from 'react'
import { ClientMsg, AUTO_ADVANCE_DELAY } from '@shared/constants.js'

export function useAutoAdvance(autoAdvanceEnabled, slideQueue, send) {
  const timerRef = useRef(null)
  const pausedRef = useRef(false)
  const prevQueueLengthRef = useRef(0)

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (!autoAdvanceEnabled || !slideQueue) return

    const { currentIndex = -1, queue = [] } = slideQueue

    // Unpause when a new slide is pushed (queue grew)
    if (queue.length > prevQueueLengthRef.current) {
      pausedRef.current = false
    }
    prevQueueLengthRef.current = queue.length

    const canAdvance = currentIndex < queue.length - 1
    const currentSlide = queue[currentIndex]

    if (canAdvance && !pausedRef.current && !currentSlide?.skipProtected) {
      let delay = AUTO_ADVANCE_DELAY
      if (currentSlide?.type === 'operator') {
        const words = currentSlide.words ?? []
        const animDone = 1600 + Math.max(0, words.length - 1) * 1100 + 180
        delay = Math.max(delay, animDone + 1000)
      }
      timerRef.current = setTimeout(() => {
        send(ClientMsg.NEXT_SLIDE)
      }, delay)
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [autoAdvanceEnabled, slideQueue, send])

  const pause = useCallback(() => {
    pausedRef.current = true
  }, [])

  return { pause }
}
