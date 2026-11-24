// Shows a seller what an ad will cost as they choose. This is a preview only:
// the server prices every ad again (utils/adPricing.js in the backend) and
// ignores any price the browser sends. The rules come from GET /ad-bookings/pricing.
//
//   price   = basePrice + (seconds - baseSeconds) × extraSecondPrice
//   seconds = baseSeconds + (amount - basePrice) ÷ extraSecondPrice

/** Price in RWF for `seconds`, or null when it isn't a whole number inside the rules. */
export function priceForSeconds(seconds, rules) {
  const s = Number(seconds);
  if (!rules || !Number.isInteger(s) || s < rules.baseSeconds || s > rules.maxSeconds) return null;
  return rules.basePrice + (s - rules.baseSeconds) * rules.extraSecondPrice;
}

/** Seconds that `amount` buys, or null when the amount isn't exactly a price on the ladder. */
export function secondsForAmount(amount, rules) {
  const a = Number(amount);
  if (!rules || !Number.isInteger(a) || a < rules.basePrice) return null;
  const extra = a - rules.basePrice;
  if (extra % rules.extraSecondPrice !== 0) return null;
  const s = rules.baseSeconds + extra / rules.extraSecondPrice;
  return s <= rules.maxSeconds ? s : null;
}

/** Why an amount can't be used, in words a seller can act on; '' when it is fine. */
export function amountProblem(amount, rules, format = (n) => `${n} RWF`) {
  if (!rules) return '';
  const text = String(amount ?? '').trim();
  if (!text) return '';
  if (!/^\d+$/.test(text)) return 'Enter the amount in whole Rwandan francs, for example 12000.';
  const a = Number(text);
  if (a < rules.basePrice) return `The minimum payment is ${format(rules.basePrice)} for ${rules.baseSeconds} seconds.`;
  if (secondsForAmount(a, rules) !== null) return '';
  const top = priceForSeconds(rules.maxSeconds, rules);
  if (a > top) return `An ad can run at most ${rules.maxSeconds} seconds (${format(top)}).`;
  const down = rules.basePrice + Math.floor((a - rules.basePrice) / rules.extraSecondPrice) * rules.extraSecondPrice;
  return `Each extra second costs ${format(rules.extraSecondPrice)}. Try ${format(down)} or ${format(down + rules.extraSecondPrice)}.`;
}
