// client/src/components/slides/ItemTipSlide.jsx
import { USE_PIXEL_GLYPHS } from '@shared/constants.js'
import { fitFontSize } from './slideUtils.js'
import { SLIDE_STRINGS } from './slideStrings.js'
import PixelGlyph from '../PixelGlyph'
import styles from '../../pages/Screen.module.css'

export default function ItemTipSlide({ slide, strings = SLIDE_STRINGS.roleTip }) {
  const itemColor = '#d4af37'
  const usesLabel = slide.maxUses === -1
    ? strings.passive
    : slide.maxUses === 1
      ? strings.singleUse
      : `${slide.maxUses} ${strings.uses}`

  return (
    <div key={slide.id} className={styles.slide}>
      {slide.title && <h1 className={styles.title} style={{ fontSize: fitFontSize(slide.title) }}>{slide.title}</h1>}
      <div className={styles.roleEmoji}>
        {USE_PIXEL_GLYPHS ? (
          <PixelGlyph iconId={slide.itemId} size="15vw">
            {slide.itemEmoji}
          </PixelGlyph>
        ) : slide.itemEmoji}
      </div>
      <h1 className={styles.title} style={{ fontSize: fitFontSize(slide.itemName), color: itemColor }}>
        {slide.itemName}
      </h1>
      <div className={styles.badgeRow}>
        <div className={styles.abilityBadge} style={{ borderColor: itemColor, color: itemColor }}>
          {usesLabel}
        </div>
      </div>
      <p className={styles.roleTipText}>{slide.itemDescription}</p>
    </div>
  )
}
