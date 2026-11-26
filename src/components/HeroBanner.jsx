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

function ProductBanner({ slide, eager = false, onOpen, tabIndex = 0 }) {
  const { product } = slide;
  const description = String(slide.description || product.category || '')
    .replace(/\s+/g, ' ')
    .trim();
  const shortDescription = description.length > 72 ? `${description.slice(0, 69).trimEnd()}…` : description;

  return (
    <Link
      to={`/product/${product.id}`}
      className="hb-product"
      onClick={onOpen}
      tabIndex={tabIndex}
      aria-label={`View ${product.name}${shortDescription ? `, ${shortDescription}` : ''}`}
    >
      <ProductImage src={product.image} alt={product.name} loading={eager ? 'eager' : 'lazy'} decoding="async" />
      <span className="hb-product-copy">
        <b>{product.name}</b>
        {shortDescription && <small>{shortDescription}</small>}
      </span>
    </Link>
  );
}

export default function HeroBanner({ slides, empty = null }) {
  const count = slides.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [visibleCount, setVisibleCount] = useState(3);
  const [offset, setOffset] = useState(0);
  const [resetting, setResetting] = useState(false);
  const trackRef = useRef(null);
  const previousVisibleKeys = useRef(new Set());
  const signature = slides.map((slide) => slide.key).join('|');
  const nextImage = count > 1 ? slides[(index + visibleCount) % count]?.product?.image : null;
  const renderedSlides = count > 1
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

  useEffect(() => { setIndex(0); }, [signature]);

  useEffect(() => {
    if (count < 2 || paused || hidden || reducedMotion) return undefined;
    const timer = setTimeout(() => setIndex((current) => current + 1), SLIDE_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [index, count, paused, hidden, reducedMotion, signature]);

  useEffect(() => {
    if (nextImage) new Image().src = resolveImageUrl(nextImage);
  }, [nextImage]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    const updateOffset = () => {
      const current = track.children[index];
      if (current) setOffset(current.offsetLeft);
    };
    updateOffset();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateOffset);
    if (observer) {
      observer.observe(track);
      Array.from(track.children).forEach((item) => observer.observe(item));
    } else {
      window.addEventListener('resize', updateOffset);
    }
    const frame = resetting ? requestAnimationFrame(() => setResetting(false)) : null;
    return () => {
      observer?.disconnect();
      if (!observer) window.removeEventListener('resize', updateOffset);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [index, renderedSlides.length, resetting, visibleCount]);

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
        .filter((item) => item.offsetLeft < right && item.offsetLeft + item.offsetWidth > left)
        .map((item) => item.dataset.key)
        .filter(isBooking),
    );
    visibleKeys.forEach((key) => {
      if (!previousVisibleKeys.current.has(key)) adBookingsApi.track(key, 'view');
    });
    previousVisibleKeys.current = visibleKeys;
  }, [index, offset, hidden, signature, visibleCount]);

  if (!count) return empty;
  const onTransitionEnd = (event) => {
    if (event.target !== trackRef.current || event.propertyName !== 'transform' || index < count) return;
    setResetting(true);
    setIndex(0);
  };
  const pointer = (on) => (event) => { if (event.pointerType === 'mouse') setPaused(on); };

  return (
    <section className="hb-carousel" aria-roledescription="carousel" aria-label="Featured products">
      <h1 className="hb-sr">Shop popular products on Ikiguzi</h1>
      <div
        className="hb-viewport"
        onPointerEnter={pointer(true)}
        onPointerLeave={pointer(false)}
        onFocus={() => setPaused(true)}
        onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}
      >
        <div
          ref={trackRef}
          className={`hb-track${resetting ? ' is-resetting' : ''}`}
          style={{ transform: `translate3d(-${offset}px, 0, 0)` }}
          onTransitionEnd={onTransitionEnd}
        >
          {renderedSlides.map((slide, position) => {
            const visible = position >= index && position < index + visibleCount;
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
    </section>
  );
}
