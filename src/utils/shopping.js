// Where "Buy now" takes a shopper. Shared by product cards and the home banner
// so both start the same existing purchase flow.

/** True when a product is sold in sizes or colours, so one must be chosen first. */
export const needsChoice = (product) => Array.isArray(product?.variants) && product.variants.length > 0;

/**
 * The page "Buy now" opens: straight into checkout for this product (the
 * existing /checkout?product=…&qty=… flow, which also works for guests), or the
 * product's own page when a size or colour has to be picked first.
 */
export const buyNowLink = (product) => (needsChoice(product)
  ? `/product/${product.id}`
  : `/checkout?product=${encodeURIComponent(product.id)}&qty=1`);
