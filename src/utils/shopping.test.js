import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buyNowLink, needsChoice } from './shopping.js';

describe('buy now', () => {
  it('goes straight to checkout for this product', () => {
    assert.equal(buyNowLink({ id: 'abc123' }), '/checkout?product=abc123&qty=1');
    assert.equal(buyNowLink({ id: 'abc123', variants: [] }), '/checkout?product=abc123&qty=1');
  });

  it('sends a product with sizes or colours to its page to choose first', () => {
    const shirt = { id: 'p9', variants: [{ id: 'v1' }] };
    assert.equal(needsChoice(shirt), true);
    assert.equal(buyNowLink(shirt), '/product/p9');
  });

  it('never lets an id break out of the link', () => {
    assert.equal(buyNowLink({ id: 'a&qty=9' }), '/checkout?product=a%26qty%3D9&qty=1');
  });
});
