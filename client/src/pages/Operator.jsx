// client/src/pages/Operator.jsx
// Dead-player cryptic message terminal — OLED terminal presentation

import { useEffect, useRef, useCallback, useState } from 'react';
import { ServerMsg, ClientMsg, OPERATOR_WORDS, OPERATOR_CATEGORIES } from '@shared/constants.js';
import TinyScreen from '../components/TinyScreen';
import styles from './Operator.module.css';

const WS_URL = import.meta.env.DEV
  ? `ws://${window.location.hostname}:8080`
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

// Max chars for message on line 1: 32 chars = 192px, leaving room for right text
const MSG_MAX = 32;

function buildDisplay(layer, categoryIndex, wordIndex, words, ready, cleared) {
  const currentCategory = OPERATOR_CATEGORIES[categoryIndex];
  const currentWords = currentCategory === 'READY' ? [] : (OPERATOR_WORDS[currentCategory] || []);
  const currentWord = currentWords[wordIndex] || '';
  const wc = words.length;

  // Line 1: accumulated message (last MSG_MAX chars), or placeholder
  const msgFull = words.join(' ');
  const msgLeft = msgFull.length > MSG_MAX ? msgFull.slice(-MSG_MAX) : msgFull;

  if (cleared) {
    return {
      line1: { left: '' },
      line2: { text: 'SENT!', style: 'critical' },
      line3: { text: '' },
    };
  }

  if (ready) {
    return {
      line1: { left: msgLeft },
      line2: { text: 'WAITING', style: 'waiting' },
      line3: { text: 'NO:CANCEL' },
    };
  }

  if (layer === 'word') {
    return {
      line1: { left: msgLeft, right: `${wordIndex + 1}/${currentWords.length}` },
      line2: { text: currentWord },
      line3: { left: 'YES:ADD', right: 'NO:BACK' },
    };
  }

  // Category layer
  const isReadyCat = currentCategory === 'READY';
  if (isReadyCat) {
    return {
      line1: { left: msgLeft },
      line2: { text: 'READY' },
      line3: wc > 0
        ? { left: 'YES:SEND', right: 'NO:DEL' }
        : { text: 'NO MESSAGE YET' },
    };
  }

  return {
    line1: { left: msgLeft },
    line2: { text: currentCategory },
    line3: { left: 'YES:OPEN', right: wc > 0 ? 'NO:DEL' : 'NO:---' },
  };
}

export default function Operator() {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);

  // Server-sync state
  const [words, setWords] = useState([]);
  const [ready, setReady] = useState(false);
  const [cleared, setCleared] = useState(false);

  // Local UI state
  const [layer, setLayer] = useState('category');
  const [categoryIndex, setCategoryIndex] = useState(0);
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
            const wasReady = ready;
            setWords(payload.words);
            setReady(payload.ready);
            if (wasReady && payload.words.length === 0) {
              setCleared(true);
              setLayer('category');
              setCategoryIndex(0);
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

  const currentCategory = OPERATOR_CATEGORIES[categoryIndex];
  const currentWords = currentCategory === 'READY' ? [] : (OPERATOR_WORDS[currentCategory] || []);

  function handleDialUp() {
    if (ready || cleared) return;
    if (layer === 'category') {
      setCategoryIndex(i => (i - 1 + OPERATOR_CATEGORIES.length) % OPERATOR_CATEGORIES.length);
    } else {
      setWordIndex(i => (i - 1 + currentWords.length) % currentWords.length);
    }
  }

  function handleDialDown() {
    if (ready || cleared) return;
    if (layer === 'category') {
      setCategoryIndex(i => (i + 1) % OPERATOR_CATEGORIES.length);
    } else {
      setWordIndex(i => (i + 1) % currentWords.length);
    }
  }

  function handleYes() {
    if (ready || cleared) return;
    if (layer === 'category') {
      if (currentCategory === 'READY') {
        if (words.length > 0) send(ClientMsg.OPERATOR_READY);
      } else {
        setWordIndex(0);
        setLayer('word');
      }
    } else {
      send(ClientMsg.OPERATOR_ADD, { word: currentWords[wordIndex] });
      setLayer('category');
    }
  }

  function handleNo() {
    if (cleared) return;
    if (ready) {
      send(ClientMsg.OPERATOR_UNREADY);
      return;
    }
    if (layer === 'word') {
      setLayer('category');
    } else {
      send(ClientMsg.OPERATOR_DELETE);
    }
  }

  // Keyboard controls (re-binds each render for fresh closures)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowUp')                              { e.preventDefault(); handleDialUp(); }
      if (e.key === 'ArrowDown')                            { e.preventDefault(); handleDialDown(); }
      if (e.key === 'Enter')                                { e.preventDefault(); handleYes(); }
      if (e.key === 'Backspace' || e.key === 'Escape')      { e.preventDefault(); handleNo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const display = buildDisplay(layer, categoryIndex, wordIndex, words, ready, cleared);

  // Button enabled states
  const navEnabled = !ready && !cleared;
  const yesEnabled = !ready && !cleared && (
    layer === 'word' ||
    (layer === 'category' && currentCategory !== 'READY') ||
    (layer === 'category' && currentCategory === 'READY' && words.length > 0)
  );
  const noEnabled = !cleared && (
    ready ||
    layer === 'word' ||
    (layer === 'category' && words.length > 0)
  );

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

      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.buttonRow}>
          <button className={styles.navButton} onClick={handleDialUp} disabled={!navEnabled}>
            <span className={styles.arrow}>&#9650;</span>
          </button>
          <button className={styles.navButton} onClick={handleDialDown} disabled={!navEnabled}>
            <span className={styles.arrow}>&#9660;</span>
          </button>
          <button className={`${styles.yesButton} ${yesLedClass}`} onClick={handleYes} disabled={!yesEnabled}>
            YES
          </button>
          <button className={`${styles.noButton} ${noLedClass}`} onClick={handleNo} disabled={!noEnabled}>
            NO
          </button>
        </div>
      </div>
    </div>
  );
}
