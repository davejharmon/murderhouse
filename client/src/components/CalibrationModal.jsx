// client/src/components/CalibrationModal.jsx
import { useState, useEffect } from 'react';
import Modal from './Modal';
import { ClientMsg } from '@shared/constants.js';
import { getStr } from '../strings/index.js';
import styles from './CalibrationModal.module.css';

export default function CalibrationModal({
  isOpen,
  onClose,
  players,
  calibrationState,
  hostSettings,
  send,
}) {
  const [displayResting, setDisplayResting] = useState(65);
  const [displayElevated, setDisplayElevated] = useState(110);
  const [threshold, setThreshold] = useState(110);
  const [countdown, setCountdown] = useState(0);

  // Sync display range + threshold from host settings
  useEffect(() => {
    if (hostSettings) {
      setDisplayResting(hostSettings.heartbeatDisplayResting ?? 65);
      setDisplayElevated(hostSettings.heartbeatDisplayElevated ?? 110);
      setThreshold(hostSettings.heartbeatThreshold ?? 110);
    }
  }, [hostSettings]);

  // Countdown timer
  useEffect(() => {
    if (!calibrationState || calibrationState.phase === 'review') {
      setCountdown(0);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil(
        (calibrationState.startTime + calibrationState.duration - Date.now()) / 1000
      ));
      setCountdown(remaining);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [calibrationState]);

  const calConfig = hostSettings?.heartbeatCalibration || {};
  const phase = calibrationState?.phase || null;
  const isActive = !!calibrationState;
  const hasSimulated = Object.values(calConfig).some(c => c.simulated);

  const handleManualEdit = (playerId, field, value) => {
    const cal = calConfig[playerId] || {};
    const resting = field === 'restingBpm' ? Number(value) : (cal.restingBpm || 60);
    const elevated = field === 'elevatedBpm' ? Number(value) : (cal.elevatedBpm || 100);
    if (resting > 0 && elevated > resting) {
      send(ClientMsg.SET_PLAYER_CALIBRATION, { playerId, restingBpm: resting, elevatedBpm: elevated });
    }
  };

  const handleSaveDisplayRange = () => {
    send(ClientMsg.SAVE_HOST_SETTINGS, {
      heartbeatDisplayResting: displayResting,
      heartbeatDisplayElevated: displayElevated,
      heartbeatThreshold: threshold,
    });
  };

  const handleRecommend = () => {
    // Smallest display range for swingy graphs, threshold high enough to rarely trigger
    // Resting = just below the lowest calibrated resting (mapped)
    // Elevated = just above the highest calibrated elevated (mapped)
    // Threshold = 85% of the way from resting to elevated — triggers only on genuine spikes
    const cals = Object.values(calConfig).filter(c => c.restingBpm && c.elevatedBpm && c.elevatedBpm > c.restingBpm);
    if (!cals.length) return;
    const minRange = Math.min(...cals.map(c => c.elevatedBpm - c.restingBpm));
    // Display range: tight window around the narrowest player range
    const recResting = 60;
    const recElevated = recResting + Math.max(20, Math.round(minRange * 1.2));
    const recThreshold = Math.round(recResting + (recElevated - recResting) * 0.85);
    setDisplayResting(recResting);
    setDisplayElevated(recElevated);
    setThreshold(recThreshold);
    send(ClientMsg.SAVE_HOST_SETTINGS, {
      heartbeatDisplayResting: recResting,
      heartbeatDisplayElevated: recElevated,
      heartbeatThreshold: recThreshold,
    });
  };

  // Idle view — show calibration data table + controls
  const renderIdle = () => {
    const sensorPlayers = (players || []).filter(p => p.heartbeat?.active || p.heartbeat?.rawBpm > 0);
    return (
      <>
        <div className={styles.section}>
          <h3>{getStr('host', 'calibration.displayRange')}</h3>
          <div className={styles.rangeRow}>
            <label>
              {getStr('host', 'calibration.colResting')}
              <input
                type="number"
                className={styles.rangeInput}
                value={displayResting}
                onChange={e => setDisplayResting(Number(e.target.value))}
                onBlur={handleSaveDisplayRange}
                min={40}
                max={100}
              />
            </label>
            <label>
              {getStr('host', 'calibration.colElevated')}
              <input
                type="number"
                className={styles.rangeInput}
                value={displayElevated}
                onChange={e => setDisplayElevated(Number(e.target.value))}
                onBlur={handleSaveDisplayRange}
                min={80}
                max={200}
              />
            </label>
            <label>
              {getStr('host', 'calibration.threshold')}
              <input
                type="number"
                className={styles.rangeInput}
                value={threshold}
                onChange={e => setThreshold(Number(e.target.value))}
                onBlur={handleSaveDisplayRange}
                min={60}
                max={200}
              />
            </label>
            <button className={styles.smallBtn} onClick={handleRecommend}>
              {getStr('host', 'calibration.recommend')}
            </button>
          </div>
        </div>

        <div className={styles.section}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{getStr('host', 'calibration.colName')}</th>
                <th>{getStr('host', 'calibration.colResting')}</th>
                <th>{getStr('host', 'calibration.colElevated')}</th>
                <th>{getStr('host', 'calibration.colLive')}</th>
                <th>{getStr('host', 'calibration.colEnabled')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(players || []).map(p => {
                const cal = calConfig[p.id];
                const rawBpm = p.heartbeat?.rawBpm ?? p.heartbeat?.bpm ?? 0;
                const hasActive = p.heartbeat?.active;
                return (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td>
                      <input
                        type="number"
                        className={styles.calInput}
                        value={cal?.restingBpm ?? ''}
                        placeholder="—"
                        min={30}
                        max={150}
                        onChange={e => handleManualEdit(p.id, 'restingBpm', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className={styles.calInput}
                        value={cal?.elevatedBpm ?? ''}
                        placeholder="—"
                        min={40}
                        max={200}
                        onChange={e => handleManualEdit(p.id, 'elevatedBpm', e.target.value)}
                      />
                    </td>
                    <td className={styles.liveValue}>
                      {hasActive ? rawBpm : '—'}
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={cal?.enabled ?? false}
                        disabled={!cal}
                        onChange={() => send(ClientMsg.TOGGLE_PLAYER_HEARTBEAT, { playerId: p.id })}
                      />
                    </td>
                    <td className={styles.actionCell}>
                      {hasActive && (
                        <button
                          className={styles.smallBtn}
                          onClick={() => send(ClientMsg.START_SINGLE_CALIBRATION, { playerId: p.id })}
                        >
                          {getStr('host', 'calibration.startSingle')}
                        </button>
                      )}
                      <button
                        className={`${styles.smallBtn} ${cal?.simulated ? styles.simActive : styles.simBtn}`}
                        onClick={() => send(ClientMsg.TOGGLE_PLAYER_SIMULATED, { playerId: p.id })}
                        title="Secretly simulate heartbeat for this player"
                      >
                        {getStr('host', 'calibration.simulate')}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {sensorPlayers.length === 0 && (
          <p className={styles.noSensors}>{getStr('host', 'calibration.noSensors')}</p>
        )}

        <div className={styles.toggleRow}>
          <div className={styles.optionToggle}>
            <label>
              <input
                type="checkbox"
                checked={hostSettings?.heartbeatAddNoise ?? false}
                onChange={e => send(ClientMsg.SAVE_HOST_SETTINGS, { heartbeatAddNoise: e.target.checked })}
              />
              <span>{getStr('host', 'calibration.addNoise')}</span>
            </label>
          </div>
          {hasSimulated && (
            <div className={styles.simToggle}>
              <label>
                <input
                  type="checkbox"
                  checked={hostSettings?.simsCanLose ?? false}
                  onChange={e => send(ClientMsg.SAVE_HOST_SETTINGS, { simsCanLose: e.target.checked })}
                />
                <span>{getStr('host', 'calibration.simsCanLose')}</span>
              </label>
            </div>
          )}
        </div>

        <button
          className="primary"
          disabled={sensorPlayers.length === 0}
          onClick={() => send(ClientMsg.START_CALIBRATION)}
        >
          {getStr('host', 'calibration.startFull')}
        </button>
      </>
    );
  };

  // Active calibration view (resting or elevated)
  const renderActive = () => {
    const phaseLabel = phase === 'resting'
      ? getStr('host', 'calibration.phaseResting')
      : getStr('host', 'calibration.phaseElevated');
    const instruction = phase === 'resting'
      ? getStr('host', 'calibration.instructionResting')
      : getStr('host', 'calibration.instructionElevated');
    const samples = calibrationState.samples || {};

    return (
      <>
        <div className={styles.phaseHeader}>
          <span className={styles.phaseLabel}>{phaseLabel}</span>
          <span className={styles.timerDisplay}>{countdown}s</span>
        </div>
        <p className={styles.instruction}>{instruction}</p>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>{getStr('host', 'calibration.colName')}</th>
              <th>{getStr('host', 'calibration.colLive')}</th>
              <th>Samples</th>
            </tr>
          </thead>
          <tbody>
            {(calibrationState.playerIds || []).map(id => {
              const player = (players || []).find(p => String(p.id) === String(id));
              const rawBpm = player?.heartbeat?.rawBpm ?? player?.heartbeat?.bpm ?? 0;
              const sampleCount = samples[id]?.[phase]?.length ?? 0;
              return (
                <tr key={id}>
                  <td>{player?.name ?? `Player ${id}`}</td>
                  <td className={styles.liveValue}>{rawBpm || '—'}</td>
                  <td>{sampleCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <button className="danger" onClick={() => send(ClientMsg.STOP_CALIBRATION)}>
          {getStr('host', 'calibration.stop')}
        </button>
      </>
    );
  };

  // Review view
  const renderReview = () => {
    const samples = calibrationState.samples || {};

    return (
      <>
        <div className={styles.phaseHeader}>
          <span className={styles.phaseLabel}>{getStr('host', 'calibration.phaseReview')}</span>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>{getStr('host', 'calibration.colName')}</th>
              <th>{getStr('host', 'calibration.colResting')}</th>
              <th>{getStr('host', 'calibration.colElevated')}</th>
              <th>Samples</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(calibrationState.playerIds || []).map(id => {
              const player = (players || []).find(p => String(p.id) === String(id));
              const restingSamples = samples[id]?.resting || [];
              const elevatedSamples = samples[id]?.elevated || [];
              const restingMedian = median(restingSamples);
              const elevatedMedian = median(elevatedSamples);
              const unrealistic = (restingMedian > 0 && (restingMedian < 40 || restingMedian > 120))
                || (elevatedMedian > 0 && (elevatedMedian < 50 || elevatedMedian > 200));
              const bad = !restingMedian || !elevatedMedian || elevatedMedian <= restingMedian || unrealistic;
              const lowSamples = restingSamples.length < 5 || elevatedSamples.length < 5;
              return (
                <tr key={id} className={bad ? styles.rowError : lowSamples ? styles.rowWarn : ''}>
                  <td>{player?.name ?? `Player ${id}`}</td>
                  <td>{restingMedian || '—'}</td>
                  <td>{elevatedMedian || '—'}</td>
                  <td>{restingSamples.length} / {elevatedSamples.length}</td>
                  <td className={styles.statusCell}>
                    {bad ? 'BAD' : lowSamples ? 'LOW' : 'OK'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className={styles.reviewButtons}>
          <button className="primary" onClick={() => send(ClientMsg.SAVE_CALIBRATION)}>
            {getStr('host', 'calibration.save')}
          </button>
          <button className="danger" onClick={() => send(ClientMsg.STOP_CALIBRATION)}>
            {getStr('host', 'calibration.discard')}
          </button>
        </div>
      </>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={getStr('host', 'calibration.title')}>
      <div className={styles.container}>
        {!isActive && renderIdle()}
        {isActive && phase !== 'review' && renderActive()}
        {isActive && phase === 'review' && renderReview()}
      </div>
    </Modal>
  );
}

function median(arr) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}
