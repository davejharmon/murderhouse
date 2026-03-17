// client/src/pages/Operator.jsx
// Dead-player cryptic message terminal — OLED terminal presentation

import { useEffect, useRef, useCallback, useState } from 'react';
import { ServerMsg, ClientMsg, OPERATOR_WORDS, OPERATOR_CATEGORIES } from '@shared/constants.js';
import TinyScreen from '../components/TinyScreen';
import styles from './Operator.module.css';

const WS_URL = import.meta.env.DEV
  ? `ws://${window.location.hostname}:8080`
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

// Build flat word list: all words sorted alphabetically across categories (deduplicated),
// then READY at end. catNum: 0 marks the READY sentinel entry.
const _allWords = new Set();
OPERATOR_CATEGORIES.slice(0, -1).forEach(cat => OPERATOR_WORDS[cat].forEach(w => _allWords.add(w)));
const FLAT_WORDS = [..._allWords].sort().map(word => {
  const c = word[0];
  const icon = c <= 'C' ? 'op_range_ac'
             : c <= 'H' ? 'op_range_dh'
             : c <= 'M' ? 'op_range_im'
             : c <= 'S' ? 'op_range_ns'
             :             'op_range_tz';
  return { word, icon };
});

function buildDisplay(wordIndex, words, ready, cleared) {
  const entry = FLAT_WORDS[wordIndex] || FLAT_WORDS[0];

  if (cleared) {
    return {
      line1: { left: '', right: '' },
      line2: { text: 'SENT!', style: 'critical' },
      line3: { text: '', left: '', right: '', center: '' },
      icons: [
        { id: 'empty', state: 'empty' },
        { id: 'empty', state: 'empty' },
        { id: 'empty', state: 'empty' },
      ],
      idleScrollIndex: 0,
    };
  }

  const previewWord = ready ? '' : entry.word;
  const catIconId   = ready ? 'empty' : entry.icon;

  return {
    line1: { left: words.join(' '), right: '' },
    line2: { text: previewWord, style: 'operator' },
    line3: { text: '', left: '', right: '', center: '' },
    icons: [
      { id: catIconId, state: 'normal' },
      { id: 'empty',   state: 'empty' },
      { id: ready ? 'op_tick' : 'empty', state: ready ? 'normal' : 'empty' },
    ],
    idleScrollIndex: 0,
  };
}

const LONG_PRESS_MS = 600;

export default function Operator() {
  const wsRef    = useRef(null);
  const readyRef = useRef(false);  // mutable ref for stale-closure-safe access in onmessage
  const yesTimerRef    = useRef(null);  // pointer long press timers
  const noTimerRef     = useRef(null);
  const keyYesTimerRef = useRef(null);  // keyboard long press timers
  const keyNoTimerRef  = useRef(null);
  const [connected, setConnected] = useState(false);

  // Server-sync state
  const [words, setWords] = useState([]);
  const [ready, setReady] = useState(false);
  const [cleared, setCleared] = useState(false);

  // Local dial state
  const [wordIndex, setWordIndex] = useState(0);

  const send = useCallback((type, payload = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  // WebSocket connection
  useEffect(() => {
    const connect = () => {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnected(true);
        ws.send(JSON.stringify({ type: ClientMsg.OPERATOR_JOIN, payload: {} }));
      };

      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 2000);
      };

      ws.onmessage = (event) => {
        try {
          const { type, payload } = JSON.parse(event.data);
          if (type === ServerMsg.OPERATOR_STATE) {
            const wasReady = readyRef.current;
            readyRef.current = payload.ready;
            setWords(payload.words);
            setReady(payload.ready);
            // Cleared: was ready and now words are empty (slide was sent)
            if (wasReady && payload.words.length === 0 && !payload.ready) {
              setCleared(true);
              setWordIndex(0);
              setTimeout(() => setCleared(false), 2000);
            }
          }
        } catch (e) {
          console.error('[Operator] Parse error:', e);
        }
      };
    };
    connect();
    return () => wsRef.current?.close();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const entry = FLAT_WORDS[wordIndex] || FLAT_WORDS[0];

  function handleDialUp() {
    if (ready || cleared) return;
    setWordIndex(i => (i - 1 + FLAT_WORDS.length) % FLAT_WORDS.length);
  }

  function handleDialDown() {
    if (ready || cleared) return;
    setWordIndex(i => (i + 1) % FLAT_WORDS.length);
  }

  function handleYes() {
    if (ready || cleared) return;
    send(ClientMsg.OPERATOR_ADD, { word: entry.word });
  }

  function handleNo() {
    if (cleared) return;
    if (ready) {
      send(ClientMsg.OPERATOR_UNREADY);
      return;
    }
    if (words.length > 0) {
      // Jump dial to the position of the word being deleted
      const lastWord = words[words.length - 1];
      const idx = FLAT_WORDS.findIndex(w => w.word === lastWord);
      if (idx !== -1) setWordIndex(idx);
      send(ClientMsg.OPERATOR_DELETE);
    }
  }

  function handleLongYes() {
    if (ready || cleared) return;
    if (words.length > 0) send(ClientMsg.OPERATOR_READY);
  }

  function handleLongNo() {
    if (cleared) return;
    if (words.length > 0 || ready) send(ClientMsg.OPERATOR_CLEAR);
  }

  // Pointer event handlers for YES button
  function handleYesPointerDown() {
    if (!yesEnabled) return;
    yesTimerRef.current = setTimeout(() => { yesTimerRef.current = null; handleLongYes(); }, LONG_PRESS_MS);
  }
  function handleYesPointerUp() {
    if (yesTimerRef.current) { clearTimeout(yesTimerRef.current); yesTimerRef.current = null; handleYes(); }
  }
  function handleYesPointerLeave() {
    clearTimeout(yesTimerRef.current); yesTimerRef.current = null;
  }

  // Pointer event handlers for NO button
  function handleNoPointerDown() {
    if (!noEnabled) return;
    noTimerRef.current = setTimeout(() => { noTimerRef.current = null; handleLongNo(); }, LONG_PRESS_MS);
  }
  function handleNoPointerUp() {
    if (noTimerRef.current) { clearTimeout(noTimerRef.current); noTimerRef.current = null; handleNo(); }
  }
  function handleNoPointerLeave() {
    clearTimeout(noTimerRef.current); noTimerRef.current = null;
  }

  // Keyboard controls (with long press support)
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'ArrowUp')   { e.preventDefault(); handleDialUp(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); handleDialDown(); }
      if (e.key === 'Enter' && !e.repeat) {
        e.preventDefault();
        keyYesTimerRef.current = setTimeout(() => { keyYesTimerRef.current = null; handleLongYes(); }, LONG_PRESS_MS);
      }
      if ((e.key === 'Backspace' || e.key === 'Escape') && !e.repeat) {
        e.preventDefault();
        keyNoTimerRef.current = setTimeout(() => { keyNoTimerRef.current = null; handleLongNo(); }, LONG_PRESS_MS);
      }
    };
    const onKeyUp = (e) => {
      if (e.key === 'Enter') {
        if (keyYesTimerRef.current) { clearTimeout(keyYesTimerRef.current); keyYesTimerRef.current = null; handleYes(); }
      }
      if (e.key === 'Backspace' || e.key === 'Escape') {
        if (keyNoTimerRef.current) { clearTimeout(keyNoTimerRef.current); keyNoTimerRef.current = null; handleNo(); }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  });

  const display = buildDisplay(wordIndex, words, ready, cleared);

  // Button enabled states
  const yesEnabled = !ready && !cleared;
  const noEnabled  = !cleared && (ready || words.length > 0);
  const navEnabled = !ready && !cleared;

  const yesLedClass = yesEnabled ? styles.led_yes_bright : styles.led_yes_off;
  const noLedClass  = noEnabled  ? styles.led_no_bright  : styles.led_no_off;

  return (
    <div className={styles.console}>
      {/* Indicator row */}
      <div className={styles.indicators}>
        <div className={styles.powerLed} />
        <div className={`${styles.connDot} ${connected ? styles.connOnline : styles.connOffline}`} />
        <span className={styles.label}>OPERATOR</span>
      </div>

      {/* OLED display */}
      <TinyScreen display={display} />

      {/* Large message preview */}
      {words.length > 0 && !cleared && (
        <div className={styles.messagePreview}>
          <span className={styles.messageText}>{words.join(' ')}</span>
        </div>
      )}

      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.buttonRow}>
          <button className={styles.navButton} onClick={handleDialUp} disabled={!navEnabled}>
            <span className={styles.arrow}>&#9650;</span>
          </button>
          <button className={styles.navButton} onClick={handleDialDown} disabled={!navEnabled}>
            <span className={styles.arrow}>&#9660;</span>
          </button>
          <button
            className={`${styles.yesButton} ${yesLedClass}`}
            onPointerDown={handleYesPointerDown}
            onPointerUp={handleYesPointerUp}
            onPointerLeave={handleYesPointerLeave}
            disabled={!yesEnabled}
          >YES</button>
          <button
            className={`${styles.noButton} ${noLedClass}`}
            onPointerDown={handleNoPointerDown}
            onPointerUp={handleNoPointerUp}
            onPointerLeave={handleNoPointerLeave}
            disabled={!noEnabled}
          >NO</button>
        </div>
      </div>
    </div>
  );
}
