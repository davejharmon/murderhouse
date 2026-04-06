// client/src/hooks/useHostModals.js
// Groups all Host modal/overlay visibility state in one place.

import { useState } from 'react'

export function useHostModals() {
  const [showSidebar, setShowSidebar] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showTutorialSlides, setShowTutorialSlides] = useState(false)
  const [showHeartbeat, setShowHeartbeat] = useState(false)
  const [showCalibration, setShowCalibration] = useState(false)
  const [showScores, setShowScores] = useState(false)
  const [showScreenPreview, setShowScreenPreview] = useState(
    () => localStorage.getItem('host.showScreenPreview') !== 'false',
  )
  const [showOperator, setShowOperator] = useState(true)

  const toggleScreenPreview = (v) => {
    setShowScreenPreview((prev) => {
      const next = typeof v === 'boolean' ? v : !prev
      localStorage.setItem('host.showScreenPreview', next)
      return next
    })
  }

  return {
    showSidebar, setShowSidebar,
    showLog, setShowLog,
    showSettings, setShowSettings,
    showTutorialSlides, setShowTutorialSlides,
    showHeartbeat, setShowHeartbeat,
    showCalibration, setShowCalibration,
    showScores, setShowScores,
    showScreenPreview, toggleScreenPreview,
    showOperator, setShowOperator,
  }
}
