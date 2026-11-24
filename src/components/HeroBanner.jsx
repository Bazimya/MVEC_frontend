import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import ProductImage from './ProductImage';
import { money } from '../utils/format';
import { buyNowLink } from '../utils/shopping';

/** How long an ad without bought time (older bookings, sponsored campaigns) stays in the banner. */
export const DEFAULT_SLIDE_SECONDS = 5;

/**
 * One advertisement as the banner shows it: the product's picture, the seller's
 * big title, a short description (cut off with "…" when it is long), the price,
 * and two buttons that open this exact product. With `preview` the buttons do
 * nothing, so a seller can see their ad before paying.
 */
export function HeroSlide({ slide, preview = false, advertiseLink, eager = false }) {
  const { product } = slide;
  const Buy = preview ? 'span' : Link;
  const Details = preview ? 'span' : Link;
  const onSale = Number(product.oldPrice) > Number(product.price);
  return (
    <div className="hb-slide">
      <div className="hb-copy">
        <span className="hb-tag">Sponsored</span>
        <h2 className="hb-title" title={slide.title}>{slide.title}</h2>
        {slide.description && <p className="hb-desc">{slide.description}</p>}
        {Number(product.price) > 0 && <p className="hb-price">{money(product.price)}{onSale && <del>{money(product.oldPrice)}</del>}</p>}
        <div className="hb-actions">
          <Buy className="hb-btn primary" {...(preview ? { 'aria-disabled': true } : { to: buyNowLink(product) })}>Buy now</Buy>
          <Details className="hb-btn" {...(preview ? { 'aria-disabled': true } : { to: `/product/${product.id}` })}>Description</Details>
        </div>
      </div>
      <div className="hb-media">
        <ProductImage src={product.image} alt={product.name} loading={eager ? 'eager' : 'lazy'} decoding="async" />
        {advertiseLink && <Link to={advertiseLink} className="hb-advertise">Advertise here</Link>}
      </div>
    </div>
  );
}

/**
 * The home page banner: paid ads take turns, each for the seconds its seller
 * bought. One timer runs at a time (a fresh one per slide, cleared before the
 * next starts), it waits while someone hovers or focuses the banner or the tab
 * is hidden, and it starts the slide's full time again afterwards.
 *
 * `slides`: [{ key, product, title, description, seconds }]. Without any, `empty` shows instead.
 */
export default function HeroBanner({ slides, advertiseLink, empty = null }) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const [tick, setTick] = useState(0); // a manual move restarts the clock even on the same slide

  // The timer reads the current list through a ref and re-arms only when the
  // list really changes, not every time the page re-renders.
  const slidesRef = useRef(slides);
  slidesRef.current = slides;
  const signature = useMemo(() => slides.map((s) => `${s.key}:${s.seconds || ''}`).join('|'), [slides]);

  const active = count ? index % count : 0;

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  // Back to the first ad when the set of ads changes.
  useEffect(() => { setIndex(0); }, [signature]);

  // Exactly one pending timer: this effect clears it before arming the next.
  useEffect(() => {
    if (count < 2 || paused || hidden) return undefined;
    const seconds = slidesRef.current[active]?.seconds || DEFAULT_SLIDE_SECONDS;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % count), seconds * 1000);
    return () => clearTimeout(timer);
  }, [active, count, paused, hidden, tick, signature]);

  // Fetch the next picture while this one shows, so the change doesn't flash.
  useEffect(() => {
    if (count < 2) return;
    const next = slidesRef.current[(active + 1) % count]?.product?.image;
    if (next) new Image().src = next;
  }, [active, count, signature]);

  if (!count) return empty;
  const go = (i) => { setIndex(((i % count) + count) % count); setTick((t) => t + 1); };
  const current = slides[active];
  const pointer = (on) => (e) => { if (e.pointerType === 'mouse') setPaused(on); }; // touch "hover" would stick

  return (
    <section className="hb" aria-roledescription="carousel" aria-label="Featured products">
      <h1 className="hb-sr">Ikiguzi, Rwanda&apos;s marketplace</h1>
      <div
        className="hb-frame"
        onPointerEnter={pointer(true)}
        onPointerLeave={pointer(false)}
        onFocus={() => setPaused(true)}
        onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false); }}
      >
        <div key={current.key} role="group" aria-roledescription="slide" aria-label={`${active + 1} of ${count}`} className="hb-fade">
          <HeroSlide slide={current} advertiseLink={advertiseLink} eager={active === 0} />
        </div>
        {count > 1 && (
          <>
            <button type="button" className="hb-arrow prev" onClick={() => go(active - 1)} aria-label="Previous ad"><Icon name="left" size={18} /></button>
            <button type="button" className="hb-arrow next" onClick={() => go(active + 1)} aria-label="Next ad"><Icon name="right" size={18} /></button>
          </>
        )}
      </div>
      {count > 1 && (
        <div className="hb-dots" role="group" aria-label="Choose an ad">
          {slides.map((s, i) => (
            <button type="button" key={s.key} className={i === active ? 'on' : ''} aria-label={`Show ad ${i + 1} of ${count}: ${s.title}`} aria-current={i === active ? 'true' : undefined} onClick={() => go(i)} />
          ))}
        </div>
      )}
    </section>
  );
}
