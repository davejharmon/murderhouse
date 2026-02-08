// client/src/components/StatusLed.jsx
// Neopixel status LED indicator - mirrors the WS2811 on GPIO 8

import styles from './StatusLed.module.css';

const STATUS_COLORS = {
  lobby:    { r: 100, g: 100, b: 100 },
  day:      { r: 0,   g: 255, b: 0   },
  night:    { r: 0,   g: 0,   b: 255 },
  voting:   { r: 255, g: 200, b: 0   },
  locked:   { r: 0,   g: 255, b: 0   },
  abstained:{ r: 60,  g: 60,  b: 60  },
  dead:     { r: 255, g: 0,   b: 0   },
  gameOver: { r: 100, g: 100, b: 100 },
};

const PULSE_STATES = new Set(['voting']);

export default function StatusLed({ status }) {
  const color = STATUS_COLORS[status];
  if (!color) return null;

  const { r, g, b } = color;
  const rgb = `${r}, ${g}, ${b}`;
  const isPulsing = PULSE_STATES.has(status);

  return (
    <div
      className={`${styles.led} ${isPulsing ? styles.pulse : ''}`}
      style={{
        backgroundColor: `rgb(${rgb})`,
        boxShadow: `0 0 8px rgba(${rgb}, 0.6), 0 0 16px rgba(${rgb}, 0.3)`,
      }}
    />
  );
}
