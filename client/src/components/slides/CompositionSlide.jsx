// client/src/components/slides/CompositionSlide.jsx
import { USE_PIXEL_GLYPHS } from '@shared/constants.js'
import { fitFontSize } from './slideUtils.js'
import { SLIDE_STRINGS } from './slideStrings.js'
import PixelGlyph from '../PixelGlyph'
import styles from '../../pages/Screen.module.css'

export default function CompositionSlide({ slide, strings = SLIDE_STRINGS.composition }) {
  const { roles = [], teamCounts = {} } = slide

  const cellRoles = roles.filter((r) => r.team === 'cell')
  const circleRoles = roles.filter((r) => r.team === 'circle')
  const unassignedCount = teamCounts.unassigned || 0

  const pluralize = (name, count) => count > 1 ? `${name}s` : name

  const renderRoleCluster = (role, index) => (
    <div key={role.roleId} className={`${styles.compCluster} ${index > 0 ? styles.compClusterSep : ''}`}>
      <div className={styles.compClusterEmojis}>
        {Array(role.count)
          .fill(null)
          .map((_, i) => (
            <span key={i} className={styles.compEmoji}>
              {USE_PIXEL_GLYPHS ? (
                <PixelGlyph iconId={role.roleId} size="6vw">
                  {role.roleEmoji}
                </PixelGlyph>
              ) : role.roleEmoji}
            </span>
          ))}
      </div>
      <span className={styles.compLabel}>{pluralize(role.roleName, role.count)}</span>
    </div>
  )

  return (
    <div key={slide.id} className={styles.slide}>
      <h1 className={styles.title} style={{ fontSize: fitFontSize(slide.title) }}>{slide.title}</h1>
      <div className={styles.compRow}>
        {cellRoles.length > 0 && (
          <div className={`${styles.compGroup} ${styles.compGroupCell}`}>
            {cellRoles.map(renderRoleCluster)}
          </div>
        )}
        {circleRoles.length > 0 && (
          <div className={`${styles.compGroup} ${styles.compGroupCircle}`}>
            {circleRoles.map(renderRoleCluster)}
          </div>
        )}
        {unassignedCount > 0 && (
          <div className={styles.compGroup}>
            <div className={styles.compCluster}>
              <div className={styles.compClusterEmojis}>
                {Array(unassignedCount)
                  .fill(null)
                  .map((_, i) => (
                    <span key={i} className={styles.compEmoji}>👤</span>
                  ))}
              </div>
              <span className={styles.compLabel}>{strings.unassigned}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
