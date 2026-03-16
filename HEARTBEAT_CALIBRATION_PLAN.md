# Heartbeat Calibration Tool — Design Plan

## Problem

The AD8232 sensors read differently per player depending on electrode placement, skin conductivity, body composition, and individual resting heart rate. One player's resting 55 BPM might read as 60, another's genuine 75 might read as 60 too. We need everyone's signal to look believable and responsive on the big screen — "good enough for TV."

## Approach: Server-Side Normalization

The ESP32 detection parameters (threshold ratio, refractory, min range) are hardcoded in firmware and work well enough at the hardware level. Rather than trying to push tuning parameters to each terminal over WebSocket, we **normalize on the server** after receiving raw BPM values.

Each player gets a calibration profile:

```json
{
  "restingBpm": 60,       // Their measured resting average
  "elevatedBpm": 85,      // Their measured elevated average
  "displayRestingBpm": 65, // What resting should show as on screen
  "displayElevatedBpm": 110 // What elevated should show as on screen
}
```

The server maps incoming raw BPM through this profile before broadcasting:

```
displayBpm = displayResting + (rawBpm - restingBpm) / (elevatedBpm - restingBpm) * (displayElevated - displayResting)
```

This means:
- A calm player with low resting HR shows ~65 on screen (not suspiciously low)
- A nervous player who's already at 80 doesn't start near the panic threshold
- Everyone's "stressed" range maps to the same dramatic zone (~100-120)
- The spike threshold (default 110) works consistently across all players

## Physical Calibration Procedure

**Setup:** All players seated at their terminals with electrodes attached. Host opens `/host` and enters calibration mode. All players calibrate simultaneously — no need to go one at a time since each terminal reports independently.

### Phase 1: Resting Baseline (30 seconds)

1. Host presses **"Start Calibration"** button
2. Big screen shows: **"REMAIN STILL. BREATHE NORMALLY."**
3. Timer counts down 30 seconds
4. Server collects BPM samples from each player every 2 seconds (~15 samples)
5. Discards first 5 seconds (settling time), averages the rest
6. Result stored as `restingBpm` per player
7. Screen shows each player's resting average as it stabilizes

### Phase 2: Elevated Baseline (30 seconds)

1. Host presses **"Start Elevated Test"** (or auto-advances after Phase 1)
2. Big screen shows: **"BREATHE RAPIDLY. CLENCH YOUR FISTS."**
3. Players hyperventilate and tense their arms for 30 seconds
4. Server collects samples, discards first 5 seconds, averages the rest
5. Result stored as `elevatedBpm` per player
6. If a player's elevated reading isn't at least 10% above resting, flag them for electrode check

### Phase 3: Review & Save

1. Host sees a summary table:
   ```
   PLAYER    RESTING   ELEVATED   RANGE   STATUS
   DEMI      58        72         14      OK
   GEGGY     65        80         15      OK
   MARK      60        63         3       WEAK SIGNAL
   ```
2. Host can manually adjust any player's values or re-run a phase
3. Players with "WEAK SIGNAL" can be re-calibrated individually
4. Host presses **"Save & Apply"** — config written to `host-settings.json`
5. Normalization activates immediately for all heartbeat broadcasts

### Fallback: No Calibration

Players without calibration data (or with no AD8232 connected) continue to work as today — raw BPM passed through unmodified. The fake heartbeat system also bypasses calibration (it already generates TV-ready values).

## Architecture

### New Message Types (shared/constants.js)

```
ClientMsg.START_CALIBRATION     // Host starts calibration mode
ClientMsg.STOP_CALIBRATION      // Host cancels/exits calibration
ClientMsg.SAVE_CALIBRATION      // Host saves calibration results
```

### Server Changes (Game.js / handlers)

- **Calibration mode state**: `this.calibrationPhase` — `null`, `'resting'`, `'elevated'`, `'review'`
- **Sample collection**: Accumulate BPM readings per player during calibration phases
- **Normalization function**: Applied in `getGameState()` before broadcasting heartbeat data
- **Persistence**: Per-player calibration stored in `host-settings.json` under `heartbeatCalibration`:

```json
{
  "heartbeatCalibration": {
    "1": { "restingBpm": 58, "elevatedBpm": 72, "displayRestingBpm": 65, "displayElevatedBpm": 110 },
    "2": { "restingBpm": 65, "elevatedBpm": 80, "displayRestingBpm": 65, "displayElevatedBpm": 110 }
  }
}
```

### Client Changes

- **Host page**: "Calibrate Heartbeats" button → enters calibration flow
- **CalibrationModal.jsx**: Multi-step modal showing progress bars, live BPM per player, phase instructions, results table
- **Screen page**: Calibration slide type showing instructions and live readings during calibration

### ESP32 Changes

**None.** The terminal firmware stays as-is. It reports raw BPM; the server handles normalization.

## Display Ranges (Configurable by Host)

| Setting | Default | Purpose |
|---------|---------|---------|
| `displayRestingBpm` | 65 | What a calm player shows on screen |
| `displayElevatedBpm` | 110 | What a stressed player shows on screen |
| `heartbeatThreshold` | 110 | BPM that triggers the NOVOTE panic penalty |

The host can adjust `displayRestingBpm` and `displayElevatedBpm` to taste. Lower resting = more dramatic range. Higher elevated = harder to trigger panic.

## Design Decisions

1. **Host-only UI** — calibration runs entirely in a modal on the host dashboard. Nothing shown on the big screen so players can't see their own numbers and self-regulate.

2. **Normalize for display** — raw BPM is transformed before broadcast in `getGameState()`. Logs and internal state use the normalized value (what the audience sees is what matters).

3. **Single-player recalibration** — available anytime from the host heartbeat modal. Useful for mid-game electrode issues. Same two-phase flow but for one player only.

4. **Physical stress test only** — elevated phase uses breathing/clenching, not mental prompts. More reliable and repeatable.

5. **Available anytime** — calibration button accessible from host dashboard regardless of game phase. Can recalibrate between rounds without resetting the game.
