// client/src/pages/Screen.jsx
import { useEffect } from 'react';
import { useGame } from '../context/GameContext';
import { SlideType, GamePhase, PlayerStatus } from '@shared/constants.js';
import styles from './Screen.module.css';

export default function Screen() {
  const {
    connected,
    gameState,
    currentSlide,
    connectAsScreen,
  } = useGame();

  // Connect as screen on mount
  useEffect(() => {
    if (connected) {
      connectAsScreen();
    }
  }, [connected, connectAsScreen]);

  // Get player by ID
  const getPlayer = (id) => gameState?.players?.find(p => p.id === id);

  // Render slide based on type
  const renderSlide = () => {
    if (!currentSlide) {
      return renderFallback();
    }

    switch (currentSlide.type) {
      case SlideType.TITLE:
        return renderTitle(currentSlide);
      
      case SlideType.PLAYER_REVEAL:
        return renderPlayerReveal(currentSlide);
      
      case SlideType.VOTE_TALLY:
        return renderVoteTally(currentSlide);
      
      case SlideType.GALLERY:
        return renderGallery(currentSlide);
      
      case SlideType.COUNTDOWN:
        return renderCountdown(currentSlide);
      
      case SlideType.DEATH:
        return renderDeath(currentSlide);
      
      case SlideType.VICTORY:
        return renderVictory(currentSlide);
      
      default:
        return renderTitle(currentSlide);
    }
  };

  const renderFallback = () => {
    const phase = gameState?.phase;

    if (!phase || phase === GamePhase.LOBBY) {
      return (
        <div className={styles.slide}>
          <h1 className={styles.title}>MURDERHAUS</h1>
          <p className={styles.subtitle}>
            {gameState?.players?.length || 0} players connected
          </p>
        </div>
      );
    }

    return (
      <div className={styles.slide}>
        <h1 className={styles.title}>
          {phase === GamePhase.DAY ? `DAY ${gameState.dayCount}` : `NIGHT ${gameState.dayCount}`}
        </h1>
        <div className={styles.gallery}>
          {gameState?.players?.map(p => (
            <div 
              key={p.id} 
              className={`${styles.playerThumb} ${p.status !== PlayerStatus.ALIVE ? styles.dead : ''}`}
            >
              <img 
                src={`/images/players/${p.portrait}`}
                alt={p.name}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTitle = (slide) => (
    <div className={styles.slide}>
      <h1 className={styles.title} style={{ color: slide.color }}>
        {slide.title}
      </h1>
      {slide.subtitle && (
        <p className={styles.subtitle}>{slide.subtitle}</p>
      )}
    </div>
  );

  const renderPlayerReveal = (slide) => {
    const player = getPlayer(slide.playerId);
    if (!player) return null;

    return (
      <div className={styles.slide}>
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
      </div>
    );
  };

  const renderVoteTally = (slide) => {
    const { tally, title, subtitle } = slide;
    
    // Convert tally to sorted array
    const sorted = Object.entries(tally || {})
      .map(([id, count]) => ({ player: getPlayer(id), count }))
      .filter(entry => entry.player)
      .sort((a, b) => b.count - a.count);

    return (
      <div className={styles.slide}>
        <h1 className={styles.title}>{title || 'VOTE RESULTS'}</h1>
        <div className={styles.tallyList}>
          {sorted.map(({ player, count }) => (
            <div key={player.id} className={styles.tallyRow}>
              <img 
                src={`/images/players/${player.portrait}`}
                alt={player.name}
                className={styles.tallyPortrait}
              />
              <span className={styles.tallyName}>{player.name}</span>
              <span className={styles.tallyCount}>{count}</span>
            </div>
          ))}
        </div>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
    );
  };

  const renderGallery = (slide) => {
    const players = (slide.playerIds || []).map(getPlayer).filter(Boolean);

    return (
      <div className={styles.slide}>
        {slide.title && <h1 className={styles.title}>{slide.title}</h1>}
        <div className={styles.gallery}>
          {players.map(p => (
            <div 
              key={p.id} 
              className={`${styles.playerThumb} ${p.status !== PlayerStatus.ALIVE ? styles.dead : ''}`}
            >
              <img 
                src={`/images/players/${p.portrait}`}
                alt={p.name}
              />
              <span className={styles.thumbName}>{p.name}</span>
            </div>
          ))}
        </div>
        {slide.subtitle && <p className={styles.subtitle}>{slide.subtitle}</p>}
      </div>
    );
  };

  const renderCountdown = (slide) => (
    <div className={styles.slide}>
      {slide.title && <h1 className={styles.title}>{slide.title}</h1>}
      <div className={styles.countdown}>{slide.seconds || 0}</div>
      {slide.subtitle && <p className={styles.subtitle}>{slide.subtitle}</p>}
    </div>
  );

  const renderDeath = (slide) => {
    const player = getPlayer(slide.playerId);
    if (!player) return null;

    return (
      <div className={`${styles.slide} ${styles.deathSlide}`}>
        <h1 className={styles.title}>{slide.title || 'ELIMINATED'}</h1>
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

  const renderVictory = (slide) => (
    <div className={`${styles.slide} ${styles.victorySlide}`}>
      <h1 
        className={styles.victoryTitle}
        style={{ color: slide.color }}
      >
        {slide.title}
      </h1>
      {slide.subtitle && (
        <p className={styles.subtitle}>{slide.subtitle}</p>
      )}
    </div>
  );

  return (
    <div className={styles.container}>
      {renderSlide()}
    </div>
  );
}
