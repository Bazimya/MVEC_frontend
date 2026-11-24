import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { priceForSeconds, secondsForAmount, amountProblem } from './adPricing.js';

const rules = { basePrice: 5000, baseSeconds: 3, extraSecondPrice: 1000, maxSeconds: 60 };

describe('banner ad price preview', () => {
  it('5,000 RWF is 3 seconds and each extra second costs 1,000 RWF', () => {
    const table = { 3: 5000, 4: 6000, 5: 7000, 6: 8000, 7: 9000, 8: 10000, 9: 11000, 10: 12000, 15: 17000, 20: 22000 };
    for (const [seconds, price] of Object.entries(table)) assert.equal(priceForSeconds(Number(seconds), rules), price);
  });

  it('works backwards from an amount', () => {
    assert.equal(secondsForAmount(5000, rules), 3);
    assert.equal(secondsForAmount(12000, rules), 10);
    assert.equal(secondsForAmount(22000, rules), 20);
  });

  it('refuses anything that is not a price on the ladder', () => {
    for (const bad of [0, 2999, 4999, 5500, 12001, 1e9, -5000, 5000.5, 'abc']) assert.equal(secondsForAmount(bad, rules), null, String(bad));
    for (const bad of [0, 2, 3.5, 61, -3, 'x']) assert.equal(priceForSeconds(bad, rules), null, String(bad));
  });

  it('explains what is wrong with an amount', () => {
    assert.match(amountProblem('4000', rules), /minimum payment is 5000 RWF for 3 seconds/);
    assert.match(amountProblem('5500', rules), /Try 5000 RWF or 6000 RWF/);
    assert.match(amountProblem('12k', rules), /whole Rwandan francs/);
    assert.match(amountProblem('999999999', rules), /at most 60 seconds/);
    assert.equal(amountProblem('12000', rules), '');
    assert.equal(amountProblem('', rules), '');
  });
});
