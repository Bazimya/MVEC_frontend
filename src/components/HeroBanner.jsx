import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductImage from './ProductImage';
import { money } from '../utils/format';
import { buyNowLink } from '../utils/shopping';
import { resolveImageUrl } from '../utils/imageUrl';
import { adBookingsApi } from '../API/adBookings';

// Bought banner ads have booking numbers like ADB-XXXX; other slides are not counted.
const isBooking = (key) => /^ADB-/.test(String(key || ''));

/** How long each product position stays in view before the carousel advances. */
export const SLIDE_SECONDS = 3;

/**
 * One advertisement as the banner shows it: the product's picture, the seller's
 * big title, a short description (cut off with "…" when it is long), the price,
 * and two buttons that open this exact product. With `preview` the buttons do
 * nothing, so a seller can see their ad before paying.
 */
export function HeroSlide({ slide, preview = false, advertiseLink, eager = false, onOpen }) {
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
          <Buy className="hb-btn primary" {...(preview ? { 'aria-disabled': true } : { to: buyNowLink(product), onClick: onOpen })}>Buy now</Buy>
          <Details className="hb-btn" {...(preview ? { 'aria-disabled': true } : { to: `/product/${product.id}`, onClick: onOpen })}>Description</Details>
        </div>
      </div>
      <div className="hb-media">
        <ProductImage src={product.image} alt={product.name} loading={eager ? 'eager' : 'lazy'} decoding="async" />
        {advertiseLink && <Link to={advertiseLink} className="hb-advertise">Advertise here</Link>}
      </div>
    </div>
  );
}

function ProductBanner({ slide, eager = false, onOpen, tabIndex = 0, preview = false }) {
  const { product } = slide;
  const name = String(slide.title || product.name || '').replace(/\s+/g, ' ').trim();
  const description = String(slide.description || product.category || '')
    .replace(/\s+/g, ' ')
    .trim();
  const shortDescription = description.length > 90 ? `${description.slice(0, 87).trimEnd()}…` : description;
  const onSale = Number(product.oldPrice) > Number(product.price);
  const Card = preview ? 'span' : Link; // a preview does nothing when pressed

  return (
    <Card
      {...(preview ? {} : { to: `/product/${product.id}`, onClick: onOpen, tabIndex, 'aria-label': `View ${name}${shortDescription ? `, ${shortDescription}` : ''}` })}
      className="hb-product"
    >
      <span className="hb-product-media">
        <ProductImage src={product.image} alt={product.name} loading={eager ? 'eager' : 'lazy'} decoding="async" />
        <span className="hb-product-tag">Ad</span>
      </span>
      <span className="hb-product-copy">
        <b title={name}>{name}</b>
        {shortDescription && <small>{shortDescription}</small>}
        {Number(product.price) > 0 && <span className="hb-product-price">{money(product.price)}{onSale && <del>{money(product.oldPrice)}</del>}</span>}
      </span>
    </Card>
  );
}

/** One ad exactly as the home page showcase draws it, for a seller to check before paying. */
export function AdCardPreview({ slide }) {
  return <div className="hb-card-preview"><ProductBanner slide={slide} preview /></div>;
}

const Chevron = ({ dir }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d={dir === 'prev' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
  </svg>
);

/**
 * The home page's advertisement showcase: one framed container holding the ads as
 * cards (3 on a computer, 2 on a tablet, 1 on a phone) that slide sideways. The
 * arrows are always visible, it advances every SLIDE_SECONDS, pauses while the
 * shopper hovers or uses the keyboard in it, and loops in both directions: the
 * first cards are repeated after the last, and the strip jumps back unseen.
 * With no more ads than fit on screen nothing slides and the cards are centred.
 */
export default function HeroBanner({ slides, loading = false, advertiseLink = '/advertise' }) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visibleCount, setVisibleCount] = useState(3);
  const [offset, setOffset] = useState(0);
  const [noAnim, setNoAnim] = useState(false);
  const trackRef = useRef(null);
  const previousVisibleKeys = useRef(new Set());
  const signature = slides.map((slide) => slide.key).join('|');
  const canSlide = count > visibleCount;
  const nextImage = canSlide ? slides[(index + visibleCount) % count]?.product?.image : null;
  const renderedSlides = canSlide
    ? [...slides, ...Array.from({ length: visibleCount }, (_, i) => slides[i % count])]
    : slides;

  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(preference.matches);
    updatePreference();
    preference.addEventListener('change', updatePreference);
    return () => preference.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    const updateVisibleCount = () => {
      setVisibleCount(window.matchMedia('(max-width: 640px)').matches
        ? 1
        : window.matchMedia('(max-width: 900px)').matches ? 2 : 3);
    };
    updateVisibleCount();
    window.addEventListener('resize', updateVisibleCount);
    return () => window.removeEventListener('resize', updateVisibleCount);
  }, []);

  // New set of ads, or a different number on screen: start again from the first card.
  useEffect(() => { setIndex(0); }, [signature, visibleCount]);

  // Moves to `to` without animating, then (once painted) lets the strip animate again.
  const jump = (to, after) => {
    setNoAnim(true);
    setIndex(to);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      setNoAnim(false);
      after?.();
    }));
  };
  const next = () => { if (canSlide && !noAnim) setIndex((current) => (current < count ? current + 1 : current)); };
  const prev = () => {
    if (!canSlide || noAnim) return;
    if (index > 0) setIndex(index - 1);
    else jump(count, () => setIndex(count - 1)); // the repeated first cards look identical to the real ones
  };

  // The loop point is reached (the repeated cards are showing): jump back to the real first cards.
  const wrap = () => { if (index >= count) jump(0); };
  useEffect(() => {
    if (!canSlide || index < count || noAnim) return undefined;
    const timer = setTimeout(wrap, 800); // in case the slide's transitionend never arrives (reduced motion, hidden tab)
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, count, canSlide, noAnim]);

  useEffect(() => {
    if (!canSlide || paused || hidden || reducedMotion || noAnim || index >= count) return undefined;
    const timer = setTimeout(() => setIndex((current) => current + 1), SLIDE_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [index, count, canSlide, paused, hidden, reducedMotion, noAnim]);

  useEffect(() => {
    if (nextImage) new Image().src = resolveImageUrl(nextImage);
  }, [nextImage]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    const updateOffset = () => {
      const current = canSlide ? track.children[index] : null; // nothing slides when every ad fits: no offset, the cards stay centred
      setOffset(current ? current.offsetLeft : 0);
    };
    updateOffset();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateOffset);
      return () => window.removeEventListener('resize', updateOffset);
    }
    const observer = new ResizeObserver(updateOffset);
    observer.observe(track);
    Array.from(track.children).forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, [index, renderedSlides.length, visibleCount, canSlide]);

  // Tell the server which booked ads were just brought into view.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    if (hidden) {
      previousVisibleKeys.current = new Set();
      return;
    }
    const left = offset;
    const right = left + track.clientWidth;
    const visibleKeys = new Set(
      Array.from(track.children)
        .filter((item) => item.offsetLeft < right - 1 && item.offsetLeft + item.offsetWidth > left + 1)
        .map((item) => item.dataset.key)
        .filter(isBooking),
    );
    visibleKeys.forEach((key) => {
      if (!previousVisibleKeys.current.has(key)) adBookingsApi.track(key, 'view');
    });
    previousVisibleKeys.current = visibleKeys;
  }, [index, offset, hidden, signature, visibleCount]);

  const onTransitionEnd = (event) => {
    if (event.target === trackRef.current && event.propertyName === 'transform') wrap();
  };
  const pointer = (on) => (event) => { if (event.pointerType === 'mouse') setPaused(on); };
  const onFocus = (event) => { if (event.target.matches?.(':focus-visible')) setPaused(true); };
  const onBlur = (event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); };

  return (
    <section
      className="hb-carousel"
      aria-roledescription="carousel"
      aria-label="Advertised products"
      onPointerEnter={pointer(true)}
      onPointerLeave={pointer(false)}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <h1 className="hb-sr">Shop popular products on Ikiguzi</h1>
      <div className="hb-bar">
        <span className="hb-bar-title"><i aria-hidden="true" />Sponsored products</span>
        {advertiseLink && <Link to={advertiseLink} className="hb-advertise-btn">Advertise here</Link>}
      </div>

      {loading && <div className="hb-skeleton" aria-hidden="true">{Array.from({ length: 3 }, (_, i) => <span key={i} />)}</div>}

      {!loading && !count && (
        <div className="hb-empty">
          <div>
            <h2>Your product could be right here</h2>
            <p>Sellers promote their products in this space on the Ikiguzi home page. Meanwhile, explore everything on sale.</p>
          </div>
          <div className="hb-empty-actions">
            {advertiseLink && <Link to={advertiseLink} className="hb-btn primary">Advertise here</Link>}
            <Link to="/shop" className="hb-btn">Browse products</Link>
          </div>
        </div>
      )}

      {!loading && count > 0 && (
        <div className={`hb-stage${canSlide ? ' has-arrows' : ''}`}>
          {canSlide && (
            <button type="button" className="hb-arrow prev" onClick={prev} aria-label="Previous advertisements"><Chevron dir="prev" /></button>
          )}
          <div className="hb-viewport">
            <div
              ref={trackRef}
              className={`hb-track${noAnim ? ' is-resetting' : ''}${canSlide ? '' : ' is-static'}`}
              style={{ transform: `translate3d(-${offset}px, 0, 0)` }}
              onTransitionEnd={onTransitionEnd}
              aria-live={paused || !canSlide ? 'polite' : 'off'}
            >
              {renderedSlides.map((slide, position) => {
                const visible = !canSlide || (position >= index && position < index + visibleCount);
                return (
                  <div
                    key={`${slide.key}-${position >= count ? 'loop' : 'item'}`}
                    className="hb-track-item"
                    data-key={slide.key}
                    role="group"
                    aria-roledescription="slide"
                    aria-label={`${(position % count) + 1} of ${count}`}
                    aria-hidden={!visible}
                  >
                    <ProductBanner
                      slide={slide}
                      eager={position < visibleCount}
                      tabIndex={visible ? 0 : -1}
                      onOpen={isBooking(slide.key) ? () => adBookingsApi.track(slide.key, 'click') : undefined}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          {canSlide && (
            <button type="button" className="hb-arrow next" onClick={next} aria-label="Next advertisements"><Chevron dir="next" /></button>
          )}
        </div>
      )}
    </section>
  );
}
