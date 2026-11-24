// Presentation rules for the horizontal order tracker (components/OrderTracker.jsx).
// They only decide how stages look: which one is done, current or still to come.
// The stages and where an order is in them always come from the server's statuses.

/**
 * 'done' | 'current' | 'upcoming' for each of `count` stages.
 * `current` is the stage the order is in (-1: none yet, e.g. a cancelled order);
 * `finished` says that stage is complete too (a delivered order).
 */
export function trackerState(count, current, finished = false) {
  return Array.from({ length: count }, (_, i) => {
    if (i < current) return 'done';
    if (i === current) return finished ? 'done' : 'current';
    return 'upcoming';
  });
}

/** For lists where each stage says whether it happened ([{ done }]): where the order is now. */
export function fromDoneFlags(steps) {
  const list = Array.isArray(steps) ? steps : [];
  const firstOpen = list.findIndex((s) => !s.done);
  return firstOpen === -1
    ? { current: list.length - 1, finished: list.length > 0 }
    : { current: firstOpen, finished: false };
}

/** Stage keys (order statuses and delivery steps) to an icon name from components/Icon.jsx. */
export const STAGE_ICON = {
  PENDING: 'receipt', PLACED: 'receipt',
  CONFIRMED: 'wallet', PAID: 'wallet',
  PROCESSING: 'box', READY_FOR_SHIPMENT: 'box', PICKED_UP: 'box',
  SHIPPED: 'truck', OUT_FOR_DELIVERY: 'truck',
  DELIVERED: 'home', COMPLETED: 'home',
};

/** "12 Nov, 14:30": date and time for a stage, or '' when it has none (or an unreadable one). */
export function stageTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
