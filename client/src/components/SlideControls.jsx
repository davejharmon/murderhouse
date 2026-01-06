// client/src/components/SlideControls.jsx
import styles from './SlideControls.module.css';

export default function SlideControls({
  slideQueue,
  onNext,
  onPrev,
  onClear,
}) {
  const { queue = [], currentIndex = -1 } = slideQueue;
  const total = queue.length;
  const current = currentIndex + 1;
  const hasSlides = total > 0;
  const canPrev = currentIndex > 0;
  const canNext = currentIndex < total - 1;

  return (
    <section className={styles.controls}>
      <h2>Slides</h2>

      <div className={styles.counter}>
        {hasSlides ? `${current} / ${total}` : 'No slides'}
      </div>

      <div className={styles.buttons}>
        <button
          onClick={onPrev}
          disabled={!canPrev}
          title="Previous slide"
        >
          ◀ Prev
        </button>
        <button
          onClick={onNext}
          disabled={!canNext}
          className={canNext ? 'primary' : ''}
          title="Next slide"
        >
          Next ▶
        </button>
      </div>

      {hasSlides && (
        <button
          className={styles.clearBtn}
          onClick={onClear}
        >
          Clear All
        </button>
      )}
    </section>
  );
}
