// client/src/pages/Screen.jsx
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import {
  SlideType,
  SlideStyle,
  SlideStyleColors,
  GamePhase,
  PlayerStatus,
  USE_PIXEL_GLYPHS,
} from '@shared/constants.js';
import PixelGlyph from '../components/PixelGlyph';
import styles from './Screen.module.css';

// BPM history ring buffer — stores {time, bpm} samples for the trend graph
const BPM_HISTORY_DURATION = 30000; // 30 seconds visible on graph
const BPM_SAMPLE_INTERVAL = 200;    // Record a point every 200ms

function HeartbeatSlide({ slide, gameState }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const bpmRef = useRef(slide.bpm || 72);
  const activeRef = useRef(true);
  const historyRef = useRef([]); // [{time, bpm}]
  const lastSampleRef = useRef(0);

  // Live data from gameState
  const livePlayer = gameState?.players?.find(p => p.id === slide.playerId);
  const liveActive = livePlayer?.heartbeat?.active ?? true;
  const liveBpm = liveActive ? (livePlayer?.heartbeat?.bpm || slide.bpm || 72) : 0;

  bpmRef.current = liveBpm;
  activeRef.current = liveActive;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const PAD_TOP = 30;
    const PAD_BOT = 20;
    const graphH = H - PAD_TOP - PAD_BOT;

    // Seed history with initial BPM
    const startTime = performance.now();
    historyRef.current = [{ time: startTime, bpm: bpmRef.current }];
    lastSampleRef.current = startTime;

    const draw = (now) => {
      const currentBpm = bpmRef.current;
      const isActive = activeRef.current;

      // Sample BPM into history at regular intervals
      if (now - lastSampleRef.current >= BPM_SAMPLE_INTERVAL) {
        historyRef.current.push({ time: now, bpm: isActive ? currentBpm : -1 });
        lastSampleRef.current = now;
        // Trim old entries
        const cutoff = now - BPM_HISTORY_DURATION - 2000;
        while (historyRef.current.length > 2 && historyRef.current[0].time < cutoff) {
          historyRef.current.shift();
        }
      }

      const history = historyRef.current;

      // Fixed Y range: 50 BPM (ice calm) to 180 BPM (apoplectic)
      const yMin = 50;
      const yMax = 180;
      const yRange = yMax - yMin;

      const bpmToY = (bpm) => PAD_TOP + graphH - ((bpm - yMin) / yRange) * graphH;
      const timeToX = (t) => ((t - (now - BPM_HISTORY_DURATION)) / BPM_HISTORY_DURATION) * W;

      // Clear
      ctx.fillStyle = 'rgba(10, 12, 15, 1)';
      ctx.fillRect(0, 0, W, H);

      // Grid lines (faint horizontal)
      ctx.strokeStyle = 'rgba(201, 76, 76, 0.08)';
      ctx.lineWidth = 1;
      const gridStep = yRange < 30 ? 5 : yRange < 80 ? 10 : 20;
      const gridStart = Math.ceil(yMin / gridStep) * gridStep;
      ctx.font = '16px monospace';
      ctx.fillStyle = 'rgba(201, 76, 76, 0.25)';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let v = gridStart; v <= yMax; v += gridStep) {
        const gy = bpmToY(v);
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
        ctx.stroke();
        ctx.fillText(String(v), W - 8, gy);
      }

      // Draw BPM trend line
      // Split into active/inactive segments
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      let inSegment = false;
      let lastActiveY = bpmToY(currentBpm > 0 ? currentBpm : (yMin + yMax) / 2);

      for (let i = 0; i < history.length; i++) {
        const pt = history[i];
        const x = timeToX(pt.time);
        if (x < -20) continue; // Off-screen left

        if (pt.bpm < 0) {
          // Inactive — end current segment
          if (inSegment) {
            ctx.stroke();
            ctx.shadowBlur = 0;
            inSegment = false;
          }
          continue;
        }

        const y = bpmToY(pt.bpm);
        lastActiveY = y;

        if (!inSegment) {
          ctx.beginPath();
          ctx.strokeStyle = '#c94c4c';
          ctx.shadowColor = '#c94c4c';
          ctx.shadowBlur = 16;
          ctx.moveTo(x, y);
          inSegment = true;
        } else {
          ctx.lineTo(x, y);
        }
      }

      if (inSegment) {
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Leading dot at the latest point
      if (isActive && history.length > 0) {
        const lastPt = history[history.length - 1];
        const x = timeToX(lastPt.time);
        const y = lastPt.bpm > 0 ? bpmToY(lastPt.bpm) : lastActiveY;

        ctx.beginPath();
        ctx.arc(x, y, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#ff6b6b';
        ctx.shadowColor = '#ff6b6b';
        ctx.shadowBlur = 24;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // "SIGNAL LOST" overlay when inactive
      if (!isActive) {
        // Dim flatline across center
        const flatY = H / 2;
        ctx.strokeStyle = 'rgba(201, 76, 76, 0.3)';
        ctx.shadowBlur = 0;
        ctx.lineWidth = 2;
        ctx.setLineDash([12, 8]);
        ctx.beginPath();
        ctx.moveTo(0, flatY);
        ctx.lineTo(W, flatY);
        ctx.stroke();
        ctx.setLineDash([]);

        // Blinking text
        const blink = Math.sin(now / 500) > 0;
        if (blink) {
          ctx.font = 'bold 40px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(201, 76, 76, 0.8)';
          ctx.fillText('SIGNAL LOST', W / 2, H / 2);
        }
      }

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  return (
    <div className={`${styles.slide} ${styles.heartbeatSlide}`}>
      <div className={styles.heartbeatHeader}>
        <img
          src={`/images/players/${slide.portrait}`}
          alt={slide.playerName}
          className={styles.heartbeatPortrait}
        />
        <span className={styles.heartbeatName}>{slide.playerName}</span>
      </div>
      <canvas
        ref={canvasRef}
        width={1200}
        height={300}
        className={styles.heartbeatCanvas}
      />
      <div className={styles.heartbeatBpmRow}>
        <span className={`${styles.heartbeatBpm} ${!liveActive ? styles.heartbeatBpmLost : ''}`}>
          {liveActive ? liveBpm : '—'}
        </span>
        <span className={styles.heartbeatLabel}>BPM</span>
      </div>
    </div>
  );
}

export default function Screen() {
  const {
    connected,
    gameState,
    currentSlide,
    slideQueue,
    eventTimers,
    connectAsScreen,
  } = useGame();

  // Use currentSlide if available, otherwise fall back to slideQueue.current
  // This handles timing gaps where SLIDE_QUEUE arrives but SLIDE hasn't yet
  const effectiveSlide = currentSlide || slideQueue?.current;

  // Debug logging
  useEffect(() => {
    console.log('[Screen] State update:', {
      connected,
      phase: gameState?.phase,
      playerCount: gameState?.players?.length,
      currentSlide: currentSlide
        ? { type: currentSlide.type, id: currentSlide.id }
        : null,
      slideQueueCurrent: slideQueue?.current
        ? { type: slideQueue.current.type, id: slideQueue.current.id }
        : null,
      effectiveSlide: effectiveSlide
        ? { type: effectiveSlide.type, id: effectiveSlide.id }
        : null,
      slideQueueLen: slideQueue?.queue?.length,
    });
  }, [connected, gameState, currentSlide, slideQueue, effectiveSlide]);

  // Set page title
  useEffect(() => {
    document.title = 'Screen - MURDERHOUSE';
  }, []);

  // Connect as screen on mount
  useEffect(() => {
    if (connected) {
      connectAsScreen();
    }
  }, [connected, connectAsScreen]);

  // Auto-advance is now controlled by host, no per-slide auto-advance

  // Get player by ID
  const getPlayer = (id) => gameState?.players?.find((p) => p.id === id);

  // Get title color from slide style
  const getSlideColor = (slide, defaultStyle = SlideStyle.NEUTRAL) => {
    const slideStyle = slide.style || defaultStyle;
    return SlideStyleColors[slideStyle];
  };

  // Render slide based on type
  const renderSlide = () => {
    if (!effectiveSlide) {
      console.log(
        '[Screen] renderSlide: no effectiveSlide, rendering fallback',
      );
      return renderFallback();
    }
    console.log('[Screen] renderSlide:', effectiveSlide.type);

    switch (effectiveSlide.type) {
      case SlideType.TITLE:
        return renderTitle(effectiveSlide);

      case SlideType.PLAYER_REVEAL:
        return renderPlayerReveal(effectiveSlide);

      case SlideType.VOTE_TALLY:
        return renderVoteTally(effectiveSlide);

      case SlideType.GALLERY:
        if (effectiveSlide.timerEventId)
          return renderTimerGallery(effectiveSlide);
        return renderGallery(effectiveSlide);

      case SlideType.COUNTDOWN:
        return renderCountdown(effectiveSlide);

      case SlideType.DEATH:
        return renderDeath(effectiveSlide);

      case SlideType.VICTORY:
        return renderVictory(effectiveSlide);

      case SlideType.COMPOSITION:
        return renderComposition(effectiveSlide);

      case SlideType.ROLE_TIP:
        return renderRoleTip(effectiveSlide);

      case SlideType.HEARTBEAT:
        return <HeartbeatSlide slide={effectiveSlide} gameState={gameState} />;

      default:
        return renderTitle(effectiveSlide);
    }
  };

  const renderFallback = () => {
    const phase = gameState?.phase;

    if (!phase || phase === GamePhase.LOBBY) {
      return (
        <div className={styles.slide}>
          <h1 className={styles.title}>MURDERHOUSE</h1>
          <p className={styles.subtitle}>
            {gameState?.players?.length || 0} players connected
          </p>
        </div>
      );
    }

    return (
      <div className={styles.slide}>
        <h1 className={styles.title}>
          {phase === GamePhase.DAY
            ? `DAY ${gameState.dayCount}`
            : `NIGHT ${gameState.dayCount}`}
        </h1>
        <div className={styles.gallery}>
          {gameState?.players?.map((p) => (
            <div
              key={p.id}
              className={`${styles.playerThumb} ${
                p.status !== PlayerStatus.ALIVE ? styles.dead : ''
              }`}
            >
              <img src={`/images/players/${p.portrait}`} alt={p.name} />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTitle = (slide) => {
    const player = slide.playerId ? getPlayer(slide.playerId) : null;

    return (
      <div className={styles.slide}>
        {player && (
          <img
            src={`/images/players/${player.portrait}`}
            alt={player.name}
            className={styles.largePortrait}
          />
        )}
        <h1 className={styles.title}>{slide.title}</h1>
        {slide.subtitle && <p className={styles.subtitle}>{slide.subtitle}</p>}
      </div>
    );
  };

  const renderPlayerReveal = (slide) => {
    const player = getPlayer(slide.playerId);
    if (!player) {
      // Player data not yet synced - show fallback
      return renderFallback();
    }

    // Get voters who voted for this player (for vote elimination slides)
    const voters = (slide.voterIds || []).map(getPlayer).filter(Boolean);

    return (
      <div key={slide.id} className={styles.slide}>
        {slide.title && (
          <h1 className={styles.title} style={{ color: getSlideColor(slide) }}>
            {slide.title}
          </h1>
        )}
        <div className={styles.playerReveal}>
          <img
            src={`/images/players/${player.portrait}`}
            alt={player.name}
            className={styles.largePortrait}
          />
          {slide.subtitle ? (
            <h2 className={styles.deathName}>{slide.subtitle}</h2>
          ) : (
            <h1 className={styles.title}>{player.name}</h1>
          )}
          {slide.revealRole && (player.role || slide.revealText) && (
            <p
              className={styles.roleReveal}
              style={{ color: slide.revealText ? '#888' : player.roleColor }}
            >
              {slide.revealText || player.roleName}
            </p>
          )}
        </div>
        {voters.length > 0 && (
          <div className={styles.votersSection}>
            <div className={styles.votersGallery}>
              {voters.map((voter) => (
                <div key={voter.id} className={styles.voterThumb}>
                  <img
                    src={`/images/players/${voter.portrait}`}
                    alt={voter.name}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderVoteTally = (slide) => {
    const { tally, voters, frontrunners, anonymousVoting, title, subtitle } =
      slide;

    // Convert tally to sorted array
    const sorted = Object.entries(tally || {})
      .map(([id, count]) => ({
        player: getPlayer(id),
        count,
        voterIds: voters?.[id] || [],
        isFrontrunner: frontrunners?.includes(id) || false,
      }))
      .filter((entry) => entry.player)
      .sort((a, b) => b.count - a.count);

    return (
      <div key={slide.id} className={styles.slide}>
        <h1 className={styles.title}>{title || 'VOTES'}</h1>
        <div className={styles.tallyList}>
          {sorted.map(({ player, count, voterIds, isFrontrunner }) => (
            <div
              key={player.id}
              className={`${styles.tallyRow} ${isFrontrunner ? styles.tallyRowFrontrunner : ''}`}
            >
              <img
                src={`/images/players/${player.portrait}`}
                alt={player.name}
                className={styles.tallyPortrait}
              />
              <span className={styles.tallyName}>{player.name}</span>
              {anonymousVoting ? (
                <span className={styles.tallyCount}>{count}</span>
              ) : (
                <div className={styles.tallyVoters}>
                  {voterIds.map((voterId) => {
                    const voter = getPlayer(voterId);
                    return voter ? (
                      <img
                        key={voterId}
                        src={`/images/players/${voter.portrait}`}
                        alt={voter.name}
                        title={voter.name}
                        className={styles.tallyVoterPortrait}
                      />
                    ) : null;
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
    );
  };

  // Memoize dead werewolves at top level (hooks can't be inside render functions)
  const allPlayers = gameState?.players || [];
  const deadWerewolves = useMemo(
    () =>
      allPlayers
        .filter(
          (p) => p.status !== PlayerStatus.ALIVE && p.roleTeam === 'werewolf',
        )
        .sort((a, b) => (a.deathTimestamp || 0) - (b.deathTimestamp || 0)),
    [allPlayers],
  );

  const renderGallery = (slide) => {
    const players = (slide.playerIds || []).map(getPlayer).filter(Boolean);

    // targetsOnly mode: just title, subtitle, then gallery — no werewolf tracker
    if (slide.targetsOnly) {
      const respondentIds = gameState?.eventRespondents?.[slide.activeEventId];
      const confirmedSet = respondentIds ? new Set(respondentIds) : null;

      return (
        <div key={slide.id} className={styles.slide}>
          {slide.title && <h1 className={styles.title}>{slide.title}</h1>}
          {slide.subtitle && (
            <p className={styles.subtitle}>{slide.subtitle}</p>
          )}
          <div className={styles.gallery}>
            {players.map((p) => (
              <div
                key={p.id}
                className={`${styles.playerThumb} ${confirmedSet?.has(p.id) ? styles.confirmed : ''}`}
              >
                <img src={`/images/players/${p.portrait}`} alt={p.name} />
                <span className={styles.thumbName}>{p.name}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Filter out dead werewolves from main gallery
    const playersWithoutDeadWerewolves = players.filter(
      (p) => p.status === PlayerStatus.ALIVE || p.roleTeam !== 'werewolf',
    );

    // Get werewolf info from game state
    const totalWerewolves = gameState?.totalWerewolves || 0;

    return (
      <div key={slide.id} className={styles.slide}>
        {slide.title && <h1 className={styles.title}>{slide.title}</h1>}

        {/* Main player gallery */}
        <div className={styles.gallery}>
          {playersWithoutDeadWerewolves.map((p) => {
            const isDead = p.status !== PlayerStatus.ALIVE;

            return (
              <div
                key={p.id}
                className={`${styles.playerThumb} ${isDead ? styles.dead : ''}`}
              >
                <img src={`/images/players/${p.portrait}`} alt={p.name} />
                <span className={styles.thumbName}>{p.name}</span>
              </div>
            );
          })}
        </div>

        {slide.subtitle && <p className={styles.subtitle}>{slide.subtitle}</p>}

        {/* Werewolf tracker section - only show during active game */}
        {totalWerewolves > 0 && gameState?.phase !== GamePhase.LOBBY && (
          <div className={styles.werewolfTracker}>
            <div className={styles.gallery}>
              {Array.from({ length: totalWerewolves }).map((_, index) => {
                const deadWerewolf = deadWerewolves[index];

                if (deadWerewolf) {
                  // Show revealed dead werewolf
                  return (
                    <div
                      key={`werewolf-${index}`}
                      className={`${styles.playerThumb} ${styles.deadWerewolf}`}
                    >
                      <img
                        src={`/images/players/${deadWerewolf.portrait}`}
                        alt={deadWerewolf.name}
                      />
                      <span className={styles.thumbName}>
                        {deadWerewolf.name}
                      </span>
                    </div>
                  );
                } else {
                  // Show anonymous placeholder
                  return (
                    <div
                      key={`werewolf-${index}`}
                      className={`${styles.playerThumb} ${styles.anonWerewolf}`}
                    >
                      <img
                        src='/images/players/anon.png'
                        alt='Unknown Werewolf'
                      />
                      <span className={styles.thumbName}>WEREWOLF</span>
                    </div>
                  );
                }
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderCountdown = (slide) => (
    <div key={slide.id} className={styles.slide}>
      {slide.title && <h1 className={styles.title}>{slide.title}</h1>}
      <div className={styles.countdown}>{slide.seconds || 0}</div>
      {slide.subtitle && <p className={styles.subtitle}>{slide.subtitle}</p>}
    </div>
  );

  const renderDeath = (slide) => {
    const player = getPlayer(slide.playerId);
    if (!player) {
      // Player data not yet synced - show fallback
      return renderFallback();
    }

    return (
      <div key={slide.id} className={`${styles.slide} ${styles.deathSlide}`}>
        <h1
          className={styles.title}
          style={{ color: getSlideColor(slide, SlideStyle.HOSTILE) }}
        >
          {slide.title || 'ELIMINATED'}
        </h1>
        <div className={styles.deathReveal}>
          <img
            src={`/images/players/${player.portrait}`}
            alt={player.name}
            className={`${styles.largePortrait} ${styles.deathPortrait}`}
          />
          <h2 className={styles.deathName}>{slide.subtitle || player.name}</h2>
          {slide.revealRole && (player.role || slide.revealText) && (
            <p
              className={styles.roleReveal}
              style={{ color: slide.revealText ? '#888' : player.roleColor }}
            >
              {slide.revealText || player.roleName}
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderComposition = (slide) => {
    const { roles = [], teamCounts = {} } = slide;

    const werewolfRoles = roles.filter((r) => r.team === 'werewolf');
    const villageRoles = roles.filter((r) => r.team === 'village');
    const unassignedCount = teamCounts.unassigned || 0;

    const pluralize = (name, count) => count > 1 ? `${name}s` : name;

    const renderRoleCluster = (role, index) => (
      <div key={role.roleId} className={`${styles.compCluster} ${index > 0 ? styles.compClusterSep : ''}`}>
        <div className={styles.compClusterEmojis}>
          {Array(role.count)
            .fill(null)
            .map((_, i) => (
              <span key={i} className={styles.compEmoji}>
                {USE_PIXEL_GLYPHS ? (
                  <PixelGlyph iconId={role.roleId} size="6vw">
                    {role.roleEmoji}
                  </PixelGlyph>
                ) : role.roleEmoji}
              </span>
            ))}
        </div>
        <span className={styles.compLabel}>{pluralize(role.roleName, role.count)}</span>
      </div>
    );

    return (
      <div key={slide.id} className={styles.slide}>
        <h1 className={styles.title}>{slide.title}</h1>
        <div className={styles.compRow}>
          {werewolfRoles.length > 0 && (
            <div className={`${styles.compGroup} ${styles.compGroupWerewolf}`}>
              {werewolfRoles.map(renderRoleCluster)}
            </div>
          )}
          {villageRoles.length > 0 && (
            <div className={`${styles.compGroup} ${styles.compGroupVillage}`}>
              {villageRoles.map(renderRoleCluster)}
            </div>
          )}
          {unassignedCount > 0 && (
            <div className={styles.compGroup}>
              <div className={styles.compCluster}>
                <div className={styles.compClusterEmojis}>
                  {Array(unassignedCount)
                    .fill(null)
                    .map((_, i) => (
                      <span key={i} className={styles.compEmoji}>
                        👤
                      </span>
                    ))}
                </div>
                <span className={styles.compLabel}>Unassigned</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderRoleTip = (slide) => {
    const isWerewolf = slide.team === 'werewolf';
    const teamColor = isWerewolf ? '#c94c4c' : '#7eb8da';

    return (
      <div
        key={slide.id}
        className={`${styles.slide} ${isWerewolf ? styles.werewolfTip : ''}`}
      >
        {slide.title && <h1 className={styles.title}>{slide.title}</h1>}
        <div className={styles.roleEmoji}>
          {USE_PIXEL_GLYPHS ? (
            <PixelGlyph iconId={slide.roleId} size="15vw">
              {slide.roleEmoji}
            </PixelGlyph>
          ) : slide.roleEmoji}
        </div>
        <h1 className={styles.title} style={{ color: slide.roleColor }}>
          {slide.roleName}
        </h1>
        <div className={styles.badgeRow}>
          <div
            className={styles.teamBadge}
            style={{ borderColor: teamColor, color: teamColor }}
          >
            {isWerewolf ? 'WEREWOLF' : 'VILLAGE'}
          </div>
          {[...(slide.abilities || [])]
            .sort((a, b) => {
              const order = { '#c94c4c': 0, '#7eb8da': 1, '#d4af37': 2 };
              return (order[a.color] ?? 3) - (order[b.color] ?? 3);
            })
            .map((ability) => (
              <div
                key={ability.label}
                className={styles.abilityBadge}
                style={{ borderColor: ability.color, color: ability.color }}
              >
                {ability.label}
              </div>
            ))}
        </div>
        <p className={styles.roleTipText}>{slide.detailedTip}</p>
      </div>
    );
  };

  const renderVictory = (slide) => {
    return (
      <div key={slide.id} className={`${styles.slide} ${styles.victorySlide}`}>
        <h1
          className={styles.victoryTitle}
          style={{ color: getSlideColor(slide) }}
        >
          {slide.title}
        </h1>
        {slide.subtitle && <p className={styles.subtitle}>{slide.subtitle}</p>}
        {slide.winners && slide.winners.length > 0 && (
          <div className={styles.victoryGallery}>
            {slide.winners.map((w) => (
              <div
                key={w.id}
                className={`${styles.playerThumb} ${!w.isAlive ? styles.dead : ''}`}
              >
                <img src={`/images/players/${w.portrait}`} alt={w.name} />
                <span className={styles.thumbName}>{w.name}</span>
                <span
                  className={styles.victoryRole}
                  style={{ color: w.roleColor }}
                >
                  {w.roleName}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Auto-scale slide content to fit viewport
  const wrapperRef = useRef(null);
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    const slide = wrapper?.firstElementChild;
    if (!slide) return;

    // Reset scale to measure natural size
    slide.style.transform = '';

    const availableH = wrapper.clientHeight;
    const naturalH = slide.offsetHeight;

    if (naturalH > availableH) {
      const scale = availableH / naturalH;
      slide.style.transform = `scale(${scale})`;
    }
  }, [effectiveSlide, gameState]);

  // Event timer countdown (drives radial widget on timer slides)
  const [timerDisplay, setTimerDisplay] = useState(null); // { seconds, fraction }

  useEffect(() => {
    const entries = Object.entries(eventTimers);
    if (entries.length === 0) {
      setTimerDisplay(null);
      return;
    }

    const earliest = entries.reduce(
      (min, [, t]) => (t.endsAt < min.endsAt ? t : min),
      entries[0][1],
    );

    const tick = () => {
      const remaining = Math.max(0, earliest.endsAt - Date.now());
      if (remaining <= 0) {
        setTimerDisplay(null);
      } else {
        setTimerDisplay({
          seconds: Math.ceil(remaining / 1000),
          fraction: remaining / earliest.duration,
        });
      }
    };

    tick();
    const interval = setInterval(tick, 50);
    return () => clearInterval(interval);
  }, [eventTimers]);

  const TIMER_RADIUS = 50;
  const TIMER_CIRCUMFERENCE = 2 * Math.PI * TIMER_RADIUS;

  const renderTimerGallery = (slide) => {
    const players = (slide.playerIds || []).map(getPlayer).filter(Boolean);
    const dashOffset = timerDisplay
      ? TIMER_CIRCUMFERENCE * (1 - timerDisplay.fraction)
      : TIMER_CIRCUMFERENCE;
    const respondentIds = gameState?.eventRespondents?.[slide.timerEventId];
    const confirmedSet = respondentIds ? new Set(respondentIds) : null;

    return (
      <div key={slide.id} className={styles.slide}>
        {slide.title && (
          <h1 className={styles.title} style={{ color: getSlideColor(slide) }}>
            {slide.title}
          </h1>
        )}

        {timerDisplay && (
          <div className={styles.timerWidget}>
            <svg viewBox='0 0 120 120' className={styles.timerSvg}>
              <circle
                cx='60'
                cy='60'
                r={TIMER_RADIUS}
                className={styles.timerTrack}
              />
              <circle
                cx='60'
                cy='60'
                r={TIMER_RADIUS}
                className={styles.timerFill}
                strokeDasharray={TIMER_CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <span className={styles.timerSeconds}>{timerDisplay.seconds}</span>
          </div>
        )}

        {slide.subtitle && <p className={styles.subtitle}>{slide.subtitle}</p>}

        <div className={styles.gallery}>
          {players.map((p) => (
            <div
              key={p.id}
              className={`${styles.playerThumb} ${confirmedSet?.has(p.id) ? styles.confirmed : ''}`}
            >
              <img src={`/images/players/${p.portrait}`} alt={p.name} />
              <span className={styles.thumbName}>{p.name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.navLinks}>
        <Link to='/host'>Host</Link>
        <Link to='/debug'>Debug</Link>
      </div>
      <div
        key={effectiveSlide?.id}
        ref={wrapperRef}
        className={`${styles.slideWrapper} ${effectiveSlide?.type === SlideType.ROLE_TIP && effectiveSlide?.team === 'werewolf' ? styles.werewolfBg : ''} ${effectiveSlide?.type === SlideType.HEARTBEAT ? styles.heartbeatBg : ''}`}
      >
        {renderSlide()}
      </div>
    </div>
  );
}
