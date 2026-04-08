// client/src/pages/SlideEditor.jsx
// Developer tool: preview all slide types with mock data and edit static strings live.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SlideType } from '@shared/constants.js'
import {
  FallbackSlide,
  TitleSlide,
  PlayerRevealSlide,
  VoteTallySlide,
  GallerySlide,
  CountdownSlide,
  DeathSlide,
  VictorySlide,
  CompositionSlide,
  RoleTipSlide,
  ItemTipSlide,
  OperatorSlide,
  ScoresSlide,
  HeartbeatSlide,
} from '../components/slides/index.js'
import { SLIDE_STRINGS } from '../components/slides/slideStrings.js'
import {
  MOCK_SLIDES,
  MOCK_PLAYERS,
  MOCK_GAME_STATE_LOBBY,
  MOCK_GAME_STATE_DAY,
  SLIDE_EDITOR_LIST,
  SLIDE_STRING_KEYS,
} from '../components/slides/mockSlides.js'
import styles from './SlideEditor.module.css'

const LS_KEY = 'slide_strings_overrides'

function loadOverrides() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function mergeStrings(overrides) {
  const merged = {}
  for (const group of Object.keys(SLIDE_STRINGS)) {
    merged[group] = { ...SLIDE_STRINGS[group], ...(overrides[group] || {}) }
  }
  return merged
}

function renderSlideComponent(slideType, variantKey, slide, gameState, strings) {
  const players = MOCK_PLAYERS

  if (slideType === 'fallback') {
    return <FallbackSlide gameState={gameState ?? MOCK_GAME_STATE_LOBBY} strings={strings.fallback} />
  }

  switch (slideType) {
    case SlideType.TITLE:
      return <TitleSlide slide={slide} players={players} />
    case SlideType.PLAYER_REVEAL:
      return <PlayerRevealSlide slide={slide} players={players} />
    case SlideType.VOTE_TALLY:
      return <VoteTallySlide slide={slide} players={players} />
    case SlideType.GALLERY:
      return <GallerySlide slide={slide} players={players} gameState={MOCK_GAME_STATE_DAY} strings={strings.gallery} />
    case SlideType.COUNTDOWN:
      return <CountdownSlide slide={slide} />
    case SlideType.DEATH:
      return <DeathSlide slide={slide} players={players} strings={strings.death} />
    case SlideType.VICTORY:
      return <VictorySlide slide={slide} />
    case SlideType.COMPOSITION:
      return <CompositionSlide slide={slide} strings={strings.composition} />
    case SlideType.ROLE_TIP:
      return <RoleTipSlide slide={slide} strings={strings.roleTip} />
    case SlideType.ITEM_TIP:
      return <ItemTipSlide slide={slide} strings={strings.roleTip} />
    case SlideType.OPERATOR:
      return <OperatorSlide slide={slide} />
    case SlideType.SCORES:
      return <ScoresSlide slide={slide} strings={strings.scores} />
    case SlideType.HEARTBEAT:
      return <HeartbeatSlide slide={slide} gameState={MOCK_GAME_STATE_DAY} strings={strings.heartbeat} />
    default:
      return <div className={styles.unknown}>Unknown slide type: {slideType}</div>
  }
}

// Apply same auto-scale as Screen.jsx
function useAutoScale(wrapperRef, deps) {
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current
    const slide = wrapper?.firstElementChild
    if (!slide) return
    slide.style.transform = ''
    const availableH = wrapper.clientHeight
    const naturalH = slide.offsetHeight
    if (naturalH > availableH) {
      slide.style.transform = `scale(${availableH / naturalH})`
    }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
}

export default function SlideEditor() {
  const [selectedType, setSelectedType]     = useState(SLIDE_EDITOR_LIST[0].type)
  const [selectedVariant, setSelectedVariant] = useState(0)
  const [overrides, setOverrides]           = useState(loadOverrides)
  const [copyFeedback, setCopyFeedback]     = useState(false)

  const strings = mergeStrings(overrides)

  const entryDef = SLIDE_EDITOR_LIST.find(e => e.type === selectedType) || SLIDE_EDITOR_LIST[0]
  const variant  = entryDef.variants[selectedVariant] || entryDef.variants[0]
  const slide    = MOCK_SLIDES[variant.key]
  const gameState = variant.gameState ?? (selectedType === 'fallback' ? MOCK_GAME_STATE_LOBBY : MOCK_GAME_STATE_DAY)

  const wrapperRef = useRef(null)
  useAutoScale(wrapperRef, [selectedType, selectedVariant, strings])

  // Which string groups to show
  const stringGroupKeys = SLIDE_STRING_KEYS[selectedType] || []

  function handleStringChange(group, key, value) {
    setOverrides(prev => {
      const next = { ...prev, [group]: { ...(prev[group] || {}), [key]: value } }
      localStorage.setItem(LS_KEY, JSON.stringify(next))
      return next
    })
  }

  function handleReset() {
    localStorage.removeItem(LS_KEY)
    setOverrides({})
  }

  function handleCopyJson() {
    navigator.clipboard.writeText(JSON.stringify(strings, null, 2)).then(() => {
      setCopyFeedback(true)
      setTimeout(() => setCopyFeedback(false), 2000)
    })
  }

  // Reset variant index when switching slide type
  function handleSelectType(type) {
    setSelectedType(type)
    setSelectedVariant(0)
  }

  const isCellBg = selectedType === SlideType.ROLE_TIP && slide?.team === 'children'
  const isHeartbeatBg = selectedType === SlideType.HEARTBEAT

  return (
    <div className={styles.editor}>
      {/* ── Left sidebar: slide list ──────────────────────────────── */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>SLIDES</div>
        {SLIDE_EDITOR_LIST.map(entry => (
          <button
            key={entry.type}
            className={`${styles.sidebarItem} ${selectedType === entry.type ? styles.sidebarItemActive : ''}`}
            onClick={() => handleSelectType(entry.type)}
          >
            {entry.label}
          </button>
        ))}
      </aside>

      {/* ── Center: preview ──────────────────────────────────────── */}
      <main className={styles.preview}>
        <div
          ref={wrapperRef}
          className={`${styles.previewFrame} ${isCellBg ? styles.cellBg : ''} ${isHeartbeatBg ? styles.heartbeatBg : ''}`}
        >
          {renderSlideComponent(selectedType, variant.key, slide, gameState, strings)}
        </div>

        {/* Variant tabs */}
        {entryDef.variants.length > 1 && (
          <div className={styles.variantTabs}>
            {entryDef.variants.map((v, i) => (
              <button
                key={v.key}
                className={`${styles.variantTab} ${selectedVariant === i ? styles.variantTabActive : ''}`}
                onClick={() => setSelectedVariant(i)}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}
      </main>

      {/* ── Right: string editor ─────────────────────────────────── */}
      <aside className={styles.stringPanel}>
        <div className={styles.stringPanelHeader}>STRINGS</div>
        {stringGroupKeys.length === 0 ? (
          <p className={styles.noStrings}>No editable strings for this slide type.</p>
        ) : (
          stringGroupKeys.map(group => (
            <div key={group} className={styles.stringGroup}>
              <div className={styles.stringGroupLabel}>{group}</div>
              {Object.entries(SLIDE_STRINGS[group] || {}).map(([key, defaultVal]) => (
                <div key={key} className={styles.stringField}>
                  <label className={styles.stringLabel}>{key}</label>
                  <input
                    className={styles.stringInput}
                    type="text"
                    value={strings[group]?.[key] ?? defaultVal}
                    onChange={e => handleStringChange(group, key, e.target.value)}
                  />
                </div>
              ))}
            </div>
          ))
        )}

        <div className={styles.stringActions}>
          <button className={styles.actionBtn} onClick={handleCopyJson}>
            {copyFeedback ? 'Copied!' : 'Copy JSON'}
          </button>
          <button className={`${styles.actionBtn} ${styles.actionBtnReset}`} onClick={handleReset}>
            Reset Defaults
          </button>
        </div>
      </aside>
    </div>
  )
}
