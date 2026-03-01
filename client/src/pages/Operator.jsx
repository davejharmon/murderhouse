// client/src/pages/Operator.jsx
// Dead-player cryptic message terminal

import { useEffect, useRef, useCallback, useState } from 'react';
import { ServerMsg, ClientMsg, OPERATOR_WORDS, OPERATOR_CATEGORIES } from '@shared/constants.js';
import styles from './Operator.module.css';

const WS_URL = import.meta.env.DEV
  ? `ws://${window.location.hostname}:8080`
  : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

const CATEGORY_LABELS = {
  WARNINGS: 'WARNINGS',
  SUBJECTS: 'SUBJECTS',
  STATE:    'STATE',
  CHAOS:    'CHAOS',
  READY:    '— READY —',
};

export default function Operator() {
  const wsRef = useRef(null);
  const [connected, setConnected] = useState(false);

  // Server-sync state
  const [words, setWords] = useState([]);
  const [ready, setReady] = useState(false);
  const [cleared, setCleared] = useState(false); // flash when host sends

  // Local UI state
  const [layer, setLayer] = useState('category'); // 'category' | 'word'
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
            // Detect host-send clear: was non-empty and ready, now empty
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

  // Keyboard controls
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowUp')   { e.preventDefault(); handleDialUp(); }
      if (e.key === 'ArrowDown') { e.preventDefault(); handleDialDown(); }
      if (e.key === 'Enter')     { e.preventDefault(); handleYes(); }
      if (e.key === 'Backspace' || e.key === 'Escape') { e.preventDefault(); handleNo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }); // re-binds each render so closures are fresh

  const currentCategory = OPERATOR_CATEGORIES[categoryIndex];
  const currentWords    = currentCategory === 'READY' ? [] : (OPERATOR_WORDS[currentCategory] || []);
  const currentWord     = layer === 'word' ? currentWords[wordIndex] : null;

  function handleDialUp() {
    if (layer === 'category') {
      setCategoryIndex(i => (i - 1 + OPERATOR_CATEGORIES.length) % OPERATOR_CATEGORIES.length);
    } else {
      setWordIndex(i => (i - 1 + currentWords.length) % currentWords.length);
    }
  }

  function handleDialDown() {
    if (layer === 'category') {
      setCategoryIndex(i => (i + 1) % OPERATOR_CATEGORIES.length);
    } else {
      setWordIndex(i => (i + 1) % currentWords.length);
    }
  }

  function handleYes() {
    if (ready) return; // locked in ready state, host must act

    if (layer === 'category') {
      if (currentCategory === 'READY') {
        if (words.length > 0) {
          send(ClientMsg.OPERATOR_READY);
        }
      } else {
        setWordIndex(0);
        setLayer('word');
      }
    } else {
      // confirm word
      send(ClientMsg.OPERATOR_ADD, { word: currentWords[wordIndex] });
      setLayer('category');
    }
  }

  function handleNo() {
    if (ready) {
      send(ClientMsg.OPERATOR_UNREADY);
      return;
    }

    if (layer === 'word') {
      setLayer('category');
    } else {
      // delete last word
      send(ClientMsg.OPERATOR_DELETE);
    }
  }

  // Derived display strings
  const messageText = words.length > 0 ? words.join(' ') : '...';

  let selectionLine = '';
  let subLine = '';
  let yesLabel = '';
  let noLabel  = '';

  if (cleared) {
    selectionLine = 'MESSAGE SENT';
    subLine       = '';
    yesLabel      = '';
    noLabel       = '';
  } else if (ready) {
    selectionLine = messageText;
    subLine       = 'WAITING FOR HOST...';
    yesLabel      = '';
    noLabel       = 'CANCEL';
  } else if (layer === 'category') {
    selectionLine = CATEGORY_LABELS[currentCategory];
    subLine       = currentCategory === 'READY'
                      ? (words.length === 0 ? 'NO MESSAGE YET' : 'SUBMIT MESSAGE')
                      : `${currentWords.length} WORDS`;
    yesLabel = currentCategory === 'READY' ? 'SEND' : 'SELECT';
    noLabel  = words.length > 0 ? 'DELETE' : '';
  } else {
    selectionLine = currentWord || '';
    subLine       = `${currentCategory}  ${wordIndex + 1}/${currentWords.length}`;
    yesLabel      = 'ADD';
    noLabel       = 'BACK';
  }

  return (
    <div className={styles.terminal}>
      {/* Connection dot */}
      <div className={`${styles.connDot} ${connected ? styles.connOnline : styles.connOffline}`} />

      {/* Message accumulator */}
      <div className={styles.messageArea}>
        <span className={`${styles.messageText} ${words.length === 0 ? styles.messagePlaceholder : ''}`}>
          {messageText}
        </span>
      </div>

      {/* Main selection display */}
      <div className={`${styles.selectionArea} ${cleared ? styles.sentFlash : ''} ${ready ? styles.readyGlow : ''}`}>
        <div className={styles.selectionMain}>{selectionLine}</div>
        {subLine && <div className={styles.selectionSub}>{subLine}</div>}
      </div>

      {/* Dial indicators */}
      {!ready && !cleared && (
        <div className={styles.dialIndicators}>
          <button className={styles.dialBtn} onClick={handleDialUp}>▲</button>
          <button className={styles.dialBtn} onClick={handleDialDown}>▼</button>
        </div>
      )}

      {/* YES / NO buttons */}
      <div className={styles.buttonRow}>
        <button
          className={`${styles.btn} ${styles.btnNo}  ${!noLabel  ? styles.btnDisabled : ''}`}
          onClick={handleNo}
          disabled={!noLabel}
        >
          {noLabel || '—'}
        </button>
        <button
          className={`${styles.btn} ${styles.btnYes} ${!yesLabel ? styles.btnDisabled : ''}`}
          onClick={handleYes}
          disabled={!yesLabel}
        >
          {yesLabel || '—'}
        </button>
      </div>
    </div>
  );
}
