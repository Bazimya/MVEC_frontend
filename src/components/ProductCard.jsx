import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon';
import ProductImage from './ProductImage';
import { useAuth } from '../context/AuthContext';
import { useMarketplace } from '../context/MarketplaceContext';
import { money, ratingLabel } from '../utils/format';
import { buyNowLink, needsChoice } from '../utils/shopping';
import { DealTag } from './ProductExtras';

const COOLDOWN_MS = 900; // a second click right after an add is ignored
const NOTE_MS = 2200; // how long "Added to your cart" stays on screen

/**
 * Storefront product tile used on Home, Shop and store pages.
 * The wishlist button sits beside the link (not inside it) so clicking it
 * never also opens the product. Two shopping actions: a cart button that adds
 * one to the existing cart, and "Buy now", which opens the existing checkout
 * for this product. A product sold in sizes or colours opens its page instead,
 * where the choice is made.
 */
export default function ProductCard({ p, href, label }) {
  const { user } = useAuth();
  const { toggleWishlist, isWishlisted, addToCart } = useMarketplace();
  const navigate = useNavigate();
  const location = useLocation();
  const wished = isWishlisted(p.id);
  const to = href || `/product/${p.id}`;
  const soldOut = Number(p.stock) <= 0;
  const onSale = Number(p.oldPrice) > Number(p.price);
  const hasRating = Number(p.rating) > 0;

  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState(null); // { ok, message } shown over the picture for a moment
  const busy = useRef(false); // set synchronously, so two fast clicks can't both add
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)); };

  const save = () => {
    if (!user) {
      navigate('/login', { state: { from: `${location.pathname}${location.search}` } });
      return;
    }
    toggleWishlist(p);
  };

  const addToCartClick = async () => {
    if (soldOut || busy.current) return;
    if (needsChoice(p)) { navigate(to); return; }
    busy.current = true;
    setAdding(true);
    const result = await addToCart(p, 1);
    setAdding(false);
    setNote({ ok: result.ok, message: result.ok ? 'Added to your cart' : result.message });
    later(() => { busy.current = false; }, COOLDOWN_MS);
    later(() => setNote(null), NOTE_MS);
  };

  const buyNow = () => { if (!soldOut) navigate(buyNowLink(p)); };
  const added = note?.ok;

  return (
    <div className="product-card">
      <div className="product-img-wrap">
        <Link to={to} className="product-img">
          <ProductImage src={p.image} alt={p.name} loading="lazy" />
          {soldOut ? <span className="sale-badge sold-out-badge">SOLD OUT</span> : p.deal?.live ? <span className="sale-badge deal-badge">−{p.deal.percentOff}%</span> : onSale && <span className="sale-badge">SALE</span>}
        </Link>
        <button
          type="button"
          className={'quick-heart ' + (wished ? 'wish-active' : '')}
          onClick={save}
          aria-pressed={wished}
          aria-label={wished ? `Remove ${p.name} from wishlist` : `Save ${p.name} to wishlist`}
        >
          <Icon name="heart" size={17} />
        </button>
        <span className={'pc-note' + (note ? (note.ok ? ' ok' : ' bad') : '')} role="status" aria-live="polite">{note?.message}</span>
      </div>
      <div className="product-info">
        <small>{label ?? p.category}{p.bulkSeller && <span className="bulk-flag" title="Sold by a supplier: good for buying in large quantities">Supplier · bulk</span>}</small>
        <Link to={to} className="product-name">{p.name}</Link>
        {hasRating && (
          <div className="rating">
            ★ {ratingLabel(p.rating)} {p.reviews > 0 && <span>({p.reviews})</span>}
          </div>
        )}
        <div>
          <b>{money(p.price)}</b> {onSale && <del>{money(p.oldPrice)}</del>}
        </div>
        {p.deal && <DealTag deal={p.deal} compact />}
        <div className="pc-actions">
          <button
            type="button"
            className={'pc-cart' + (added ? ' added' : '')}
            onClick={addToCartClick}
            disabled={soldOut || adding}
            aria-label={soldOut ? `${p.name} is sold out` : needsChoice(p) ? `Choose options for ${p.name}` : `Add ${p.name} to cart`}
            title={needsChoice(p) ? 'Choose a size or colour' : 'Add to cart'}
          >
            <Icon name={added ? 'check' : 'cart'} size={18} />
          </button>
          <button type="button" className="pc-buy" onClick={buyNow} disabled={soldOut} aria-label={`Buy ${p.name} now`}>
            {soldOut ? 'Sold out' : 'Buy now'}
          </button>
        </div>
      </div>
    </div>
  );
}
