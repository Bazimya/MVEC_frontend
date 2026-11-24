import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { trackerState, fromDoneFlags, stageTime, STAGE_ICON } from './tracker.js';

describe('order tracker stages', () => {
  it('marks earlier stages done, the order\'s stage current, the rest upcoming', () => {
    assert.deepEqual(trackerState(5, 2), ['done', 'done', 'current', 'upcoming', 'upcoming']);
    assert.deepEqual(trackerState(5, 0), ['current', 'upcoming', 'upcoming', 'upcoming', 'upcoming']);
  });

  it('a finished order has every stage done', () => {
    assert.deepEqual(trackerState(3, 2, true), ['done', 'done', 'done']);
  });

  it('an order that left the normal flow shows nothing as current', () => {
    assert.deepEqual(trackerState(3, -1), ['upcoming', 'upcoming', 'upcoming']);
  });
});

describe('stages that carry their own done flag (riders)', () => {
  it('the first open stage is the current one', () => {
    const steps = [{ done: true }, { done: true }, { done: false }, { done: false }];
    assert.deepEqual(fromDoneFlags(steps), { current: 2, finished: false });
  });

  it('all done means the delivery is finished', () => {
    assert.deepEqual(fromDoneFlags([{ done: true }, { done: true }]), { current: 1, finished: true });
  });

  it('copes with nothing at all', () => {
    assert.deepEqual(fromDoneFlags(undefined), { current: -1, finished: false });
    assert.deepEqual(fromDoneFlags([]), { current: -1, finished: false });
  });
});

describe('stage times and icons', () => {
  it('formats a date and time, and shows nothing for a missing or bad one', () => {
    assert.match(stageTime('2026-11-12T14:30:00'), /^12 Nov, 14:30$/);
    for (const bad of [null, undefined, '', 'not a date']) assert.equal(stageTime(bad), '');
  });

  it('every order status has an icon', () => {
    for (const key of ['PENDING', 'CONFIRMED', 'PROCESSING', 'READY_FOR_SHIPMENT', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED']) assert.ok(STAGE_ICON[key], key);
  });
});
