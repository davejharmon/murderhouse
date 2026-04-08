// client/src/components/slides/RoleTipSlide.jsx
import { USE_PIXEL_GLYPHS } from '@shared/constants.js'
import { fitFontSize } from './slideUtils.js'
import { SLIDE_STRINGS } from './slideStrings.js'
import PixelGlyph from '../PixelGlyph'
import styles from '../../pages/Screen.module.css'

export default function RoleTipSlide({ slide, strings = SLIDE_STRINGS.roleTip }) {
  const isCell = slide.team === 'children'
  const isNeutral = slide.team === 'outsider'
  const teamColor = isCell ? '#c94c4c' : isNeutral ? '#e8a020' : '#7eb8da'
  const teamLabel = isCell ? (strings.cell ?? 'CELL') : isNeutral ? strings.independent : (strings.circle ?? 'CIRCLE')

  return (
    <div
      key={slide.id}
      className={`${styles.slide} ${isCell ? styles.cellTip : ''}`}
    >
      {slide.title && <h1 className={styles.title} style={{ fontSize: fitFontSize(slide.title) }}>{slide.title}</h1>}
      <div className={styles.roleEmoji}>
        {USE_PIXEL_GLYPHS ? (
          <PixelGlyph iconId={slide.roleId} size="15vw">
            {slide.roleEmoji}
          </PixelGlyph>
        ) : slide.roleEmoji}
      </div>
      <h1 className={styles.title} style={{ fontSize: fitFontSize(slide.roleName), color: slide.roleColor }}>
        {slide.roleName}
      </h1>
      <div className={styles.badgeRow}>
        <div
          className={styles.teamBadge}
          style={{ borderColor: teamColor, color: teamColor, backgroundColor: teamColor + '28' }}
        >
          {teamLabel}
        </div>
        {[...(slide.abilities || [])]
          .sort((a, b) => {
            const order = { '#c94c4c': 0, '#7eb8da': 1, '#d4af37': 2 }
            return (order[a.color] ?? 3) - (order[b.color] ?? 3)
          })
          .map((ability) => (
            <div
              key={ability.label}
              className={styles.abilityBadge}
              style={{ borderColor: ability.color, color: ability.color }}
            >
              {ability.label}
            </div>
          ))}
      </div>
      <p className={styles.roleTipText}>{slide.detailedTip}</p>
    </div>
  )
}
