// client/src/components/slides/CountdownSlide.jsx
import { fitFontSize } from './slideUtils.js'
import styles from '../../pages/Screen.module.css'

export default function CountdownSlide({ slide }) {
  return (
    <div key={slide.id} className={styles.slide}>
      {slide.title && <h1 className={styles.title} style={{ fontSize: fitFontSize(slide.title) }}>{slide.title}</h1>}
      <div className={styles.countdown}>{slide.seconds || 0}</div>
      {slide.subtitle && <p className={styles.subtitle}>{slide.subtitle}</p>}
    </div>
  )
}
