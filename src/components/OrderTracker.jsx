import { useEffect, useRef } from 'react';
import Icon from './Icon';
import { stageTime, trackerState } from '../utils/tracker';

const STATE_TEXT = { done: 'Completed', current: 'Current stage', upcoming: 'Upcoming' };

/**
 * The order's journey as one horizontal row: stages joined by a line that fills
 * as the order moves. Done stages are solid, the current one is ringed, the
 * rest are faint. On a narrow screen the row scrolls sideways (and opens on the
 * current stage) instead of squeezing the stages together.
 *
 * `steps`: [{ key, label, sub?, at?, icon? }]. `current` is the stage the order
 * is in (-1: none), `finished` says that stage is complete as well. Where a stage
 * happened (`at`), its date and time show; stages are never given invented times.
 */
export default function OrderTracker({ steps, current, finished = false, label = 'Order progress' }) {
  const wrap = useRef(null);
  const states = trackerState(steps.length, current, finished);
  const focus = Math.max(0, finished ? steps.length - 1 : current);

  // Open scrolled to the current stage when the row doesn't fit.
  useEffect(() => {
    const row = wrap.current;
    const item = row?.querySelectorAll('li')[focus];
    if (!row || !item || row.scrollWidth <= row.clientWidth) return;
    row.scrollLeft = Math.max(0, item.offsetLeft - (row.clientWidth - item.clientWidth) / 2);
  }, [focus, steps.length]);

  return (
    <div className="otrack-wrap" ref={wrap} role="group" aria-label={label} tabIndex={0}>
      <ol className="otrack">
        {steps.map((s, i) => {
          const state = states[i];
          const time = state === 'upcoming' ? '' : stageTime(s.at);
          return (
            <li key={s.key || s.label} className={`otrack-step ${state}`} aria-current={state === 'current' ? 'step' : undefined}>
              <span className="otrack-dot"><Icon name={s.icon || 'box'} size={16} /></span>
              <b>{s.label}</b>
              {s.sub && <small>{s.sub}</small>}
              {time && <time dateTime={new Date(s.at).toISOString()}>{time}</time>}
              <span className="otrack-sr">{STATE_TEXT[state]}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
