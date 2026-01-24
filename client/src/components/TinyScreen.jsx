// client/src/components/TinyScreen.jsx
// Three-line display for player terminals
// Designed to match 256x64 OLED physical display format

import { DisplayStyle } from '@shared/constants.js';
import styles from './TinyScreen.module.css';

// Glyph rendering for React (physical displays use bitmap icons)
const GLYPH_MAP = {
  ':pistol:': '🔫',
  ':phone:': '📱',
  ':crystal:': '🔮',
  ':wolf:': '🐺',
  ':village:': '🏠',
  ':lock:': '🔒',
  ':check:': '✓',
  ':x:': '✗',
  ':alpha:': '👑',
  ':pack:': '🐾',
  ':skull:': '💀',
};

/**
 * Render glyph strings to display characters
 */
function renderGlyphs(str) {
  if (!str) return '';
  return str.replace(/:(\w+):/g, (match) => GLYPH_MAP[match] || match);
}

/**
 * TinyScreen - Three-line display component
 *
 * Props:
 *   display: {
 *     line1: { left: string, right: string },
 *     line2: { text: string, style: 'normal'|'locked'|'abstained'|'waiting' },
 *     line3: { text: string },
 *     leds: { yes: string, no: string }
 *   }
 */
export default function TinyScreen({ display }) {
  if (!display) {
    return (
      <div className={styles.screen}>
        <div className={styles.line1}>
          <span className={styles.left}>CONNECTING</span>
          <span className={styles.right}></span>
        </div>
        <div className={styles.line2}>...</div>
        <div className={styles.line3}>Please wait</div>
      </div>
    );
  }

  const { line1, line2, line3 } = display;
  const styleClass = styles[line2.style] || '';

  return (
    <div className={`${styles.screen} ${styleClass}`}>
      <div className={styles.line1}>
        <span className={styles.left}>{renderGlyphs(line1.left)}</span>
        <span className={styles.right}>{renderGlyphs(line1.right)}</span>
      </div>
      <div className={styles.line2}>{line2.text}</div>
      <div className={styles.line3}>{line3.text}</div>
    </div>
  );
}

/**
 * Get CSS class for LED state (for button styling)
 */
export function getLedClass(ledState) {
  return styles[`led_${ledState}`] || '';
}
