// client/src/components/TinyScreen.jsx
// Three-line display for player terminals
// Designed to match 256x64 amber monochrome OLED physical display

import PixelGlyph from './PixelGlyph';
import styles from './TinyScreen.module.css';

// Character glyph substitutions (ASCII, matching ESP32 terminal rendering)
const CHAR_GLYPHS = {
  ':pistol:': '*',
  ':phone:': '$',
  ':crystal:': '@',
  ':village:': 'V',
  ':lock:': '!',
  ':check:': '+',
  ':x:': '-',
  ':alpha:': 'A',
  ':pack:': 'P',
};

// Bitmap glyphs rendered as PixelGlyph components
const BITMAP_GLYPHS = new Set([':wolf:', ':skull:']);

/**
 * Render glyph strings to JSX (mix of text spans and PixelGlyph components)
 * @param {string} str - Text with :glyph: tokens
 * @param {number} px - Pixel size for bitmap glyphs
 * @returns {React.ReactNode}
 */
function renderGlyphs(str, px = 1.5) {
  if (!str) return '';

  const parts = [];
  let lastIndex = 0;
  const regex = /:(\w+):/g;
  let match;

  while ((match = regex.exec(str)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      parts.push(str.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (BITMAP_GLYPHS.has(token)) {
      const name = match[1]; // 'wolf' or 'skull'
      parts.push(<PixelGlyph key={`${name}-${match.index}`} name={name} px={px} />);
    } else if (CHAR_GLYPHS[token]) {
      parts.push(CHAR_GLYPHS[token]);
    } else {
      parts.push(token); // Unknown glyph, pass through
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < str.length) {
    parts.push(str.slice(lastIndex));
  }

  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : parts;
}

/**
 * TinyScreen - Three-line display component
 *
 * Props:
 *   display: {
 *     line1: { left: string, right: string },
 *     line2: { text: string, style: 'normal'|'locked'|'abstained'|'waiting' },
 *     line3: { text: string } OR { left: string, right: string },
 *     leds: { yes: string, no: string }
 *   }
 */
export default function TinyScreen({ display, compact = false }) {
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
  const isLocked = line2.style === 'locked';

  // Pixel sizes: smaller for lines 1/3, larger for line 2
  const smallPx = compact ? 1 : 1.5;
  const bigPx = compact ? 1.5 : 3;

  // Line 3 can be centered text or left/right aligned (for button labels)
  const hasLine3LeftRight = line3.left || line3.right;

  return (
    <div className={`${styles.screen} ${styleClass}`}>
      <div className={styles.line1}>
        <span className={styles.left}>{renderGlyphs(line1.left, smallPx)}</span>
        <span className={styles.right}>{renderGlyphs(line1.right, smallPx)}</span>
      </div>
      <div className={styles.line2}>
        {isLocked ? (
          <span className={styles.lockedFrame}>{renderGlyphs(line2.text, bigPx)}</span>
        ) : (
          renderGlyphs(line2.text, bigPx)
        )}
      </div>
      {hasLine3LeftRight ? (
        <div className={styles.line3Split}>
          <span className={styles.left}>{renderGlyphs(line3.left, smallPx)}</span>
          <span className={styles.right}>{renderGlyphs(line3.right, smallPx)}</span>
        </div>
      ) : (
        <div className={styles.line3}>{renderGlyphs(line3.text, smallPx)}</div>
      )}
    </div>
  );
}
