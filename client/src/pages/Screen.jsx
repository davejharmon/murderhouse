// client/src/pages/Screen.jsx
import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import { SlideType, SlideStyle, SlideStyleColors, GamePhase, PlayerStatus } from '@shared/constants.js';
import styles from './Screen.module.css';

export default function Screen() {
  const { connected, gameState, currentSlide, slideQueue, connectAsScreen } = useGame();

  // Use currentSlide if available, otherwise fall back to slideQueue.current
  // This handles timing gaps where SLIDE_QUEUE arrives but SLIDE hasn't yet
  const effectiveSlide = currentSlide || slideQueue?.current;

  // Debug logging
  useEffect(() => {
    console.log('[Screen] State update:', {
      connected,
      phase: gameState?.phase,
      playerCount: gameState?.players?.length,
      currentSlide: currentSlide ? { type: currentSlide.type, id: currentSlide.id } : null,
      slideQueueCurrent: slideQueue?.current ? { type: slideQueue.current.type, id: slideQueue.current.id } : null,
      effectiveSlide: effectiveSlide ? { type: effectiveSlide.type, id: effectiveSlide.id } : null,
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
      console.log('[Screen] renderSlide: no effectiveSlide, rendering fallback');
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
        return renderGallery(effectiveSlide);

      case SlideType.COUNTDOWN:
        return renderCountdown(effectiveSlide);

      case SlideType.DEATH:
        return renderDeath(effectiveSlide);

      case SlideType.VICTORY:
        return renderVictory(effectiveSlide);

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
        <h1 className={styles.title}>
          {slide.title}
        </h1>
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
        <div className={styles.playerReveal}>
          <img
            src={`/images/players/${player.portrait}`}
            alt={player.name}
            className={styles.largePortrait}
          />
          <h1 className={styles.title}>{player.name}</h1>
          {slide.revealRole && player.role && (
            <p
              className={styles.roleReveal}
              style={{ color: player.roleColor }}
            >
              {player.roleName}
            </p>
          )}
        </div>
        {voters.length > 0 && (
          <div className={styles.votersSection}>
            <div className={styles.votersGallery}>
              {voters.map((voter) => (
                <div key={voter.id} className={styles.voterThumb}>
                  <img src={`/images/players/${voter.portrait}`} alt={voter.name} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderVoteTally = (slide) => {
    const { tally, voters, frontrunners, anonymousVoting, title, subtitle } = slide;

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
  const deadWerewolves = useMemo(() =>
    allPlayers
      .filter(p => p.status !== PlayerStatus.ALIVE && p.roleTeam === 'werewolf')
      .sort((a, b) => (a.deathTimestamp || 0) - (b.deathTimestamp || 0)),
    [allPlayers]
  );

  const renderGallery = (slide) => {
    const players = (slide.playerIds || []).map(getPlayer).filter(Boolean);

    // Filter out dead werewolves from main gallery
    const playersWithoutDeadWerewolves = players.filter(p =>
      p.status === PlayerStatus.ALIVE || p.roleTeam !== 'werewolf'
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
                      <img src={`/images/players/${deadWerewolf.portrait}`} alt={deadWerewolf.name} />
                      <span className={styles.thumbName}>{deadWerewolf.name}</span>
                    </div>
                  );
                } else {
                  // Show anonymous placeholder
                  return (
                    <div
                      key={`werewolf-${index}`}
                      className={`${styles.playerThumb} ${styles.anonWerewolf}`}
                    >
                      <img src="/images/players/anon.png" alt="Unknown Werewolf" />
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
        <h1 className={styles.title} style={{ color: getSlideColor(slide, SlideStyle.HOSTILE) }}>
          {slide.title || 'ELIMINATED'}
        </h1>
        <div className={styles.deathReveal}>
          <img
            src={`/images/players/${player.portrait}`}
            alt={player.name}
            className={`${styles.largePortrait} ${styles.deathPortrait}`}
          />
          <h2 className={styles.deathName}>{slide.subtitle || player.name}</h2>
          {slide.revealRole && player.role && (
            <p
              className={styles.roleReveal}
              style={{ color: player.roleColor }}
            >
              {player.roleName}
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderVictory = (slide) => {
    return (
      <div key={slide.id} className={`${styles.slide} ${styles.victorySlide}`}>
        <h1 className={styles.victoryTitle} style={{ color: getSlideColor(slide) }}>
          {slide.title}
        </h1>
        {slide.subtitle && <p className={styles.subtitle}>{slide.subtitle}</p>}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.navLinks}>
        <Link to='/host'>Host</Link>
        <Link to='/debug'>Debug</Link>
      </div>
      <div key={effectiveSlide?.id} className={styles.slideWrapper}>
        {renderSlide()}
      </div>
    </div>
  );
}
