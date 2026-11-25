import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ProductImage from './ProductImage';
import { HeroSlide } from './HeroBanner';
import { adBookingsApi } from '../API/adBookings';
import { extractErrorMessage } from '../API/client';
import { money } from '../utils/format';
import { stageTime } from '../utils/tracker';

const TONE = { LIVE: 'ok', PAID: 'pending', AWAITING_PAYMENT: 'pending', PAUSED: 'pending', ENDED: 'muted', REJECTED: 'bad', CANCELLED: 'bad', REMOVED: 'bad' };
const NUMBER = (n) => Number(n || 0).toLocaleString();

/** One line of the usage grid. */
const Fact = ({ label, value, hint }) => <div className="bap-fact"><span>{label}</span><b>{value}</b>{hint && <small>{hint}</small>}</div>;

/** What is happening to this ad, in words a seller can act on. */
function Story({ b }) {
  if (b.status === 'LIVE') {
    if (b.usage?.showing === false) return <p className="bap-note warn">Your ad is live, but it is not on the banner right now because the product is out of stock or off sale. It comes back as soon as the product is on sale again.</p>;
    return <p className="bap-note">Your ad is on the Ikiguzi home page banner right now. Every visitor who opens the home page sees it for {b.usage?.secondsPerTurn || 5} seconds each time the banner comes round to it.</p>;
  }
  const text = {
    AWAITING_PAYMENT: 'Waiting for your payment. Approve the prompt on your phone; the ad goes live as soon as the payment is confirmed.',
    PAID: 'Payment received. Your ad is going live now.',
    PAUSED: 'Ikiguzi has paused this ad, so it is off the banner for now. Contact support to ask why.',
    ENDED: 'This ad finished its run. Book it again any time to bring it back.',
    REJECTED: `Ikiguzi did not approve this ad${b.rejectionReason ? `: ${b.rejectionReason}` : ''}. Your payment was refunded to ${b.payerPhone || 'the number that paid'}.`,
    CANCELLED: 'This booking was cancelled, so nothing was charged for it.',
    REMOVED: `Ikiguzi removed this ad${b.rejectionReason ? `: ${b.rejectionReason}` : ''}.`,
  }[b.status];
  return text ? <p className="bap-note">{text}</p> : null;
}

function AdCard({ b, onCancel, busy }) {
  const product = b.products?.[0] || {};
  const [open, setOpen] = useState(false);
  const clickRate = b.views > 0 ? `${((b.clicks / b.views) * 100).toFixed(1)}% of views` : null;
  const u = b.usage?.showing ? b.usage : null;
  const everRan = b.status === 'LIVE' || b.status === 'ENDED' || b.status === 'PAUSED' || b.status === 'REMOVED';
  return (
    <article className="bap-card">
      <header>
        <ProductImage src={product.image} alt="" />
        <div>
          <h4>{b.title || product.name}</h4>
          <small>{product.name} · {b.bookingNumber}</small>
        </div>
        <span className={`bap-pill ${TONE[b.status] || 'muted'}`}>{b.statusLabel}</span>
      </header>
      {b.description && <p className="bap-desc">{b.description}</p>}
      <Story b={b} />

      {b.status === 'LIVE' && <div className="bap-facts">
        <Fact label="Time on the banner" value={`${u?.secondsPerTurn || 5} seconds`} hint="each time it comes round" />
        <Fact label="Place in the rotation" value={u ? `${u.position} of ${u.liveAds}` : '—'} hint={u ? (u.liveAds > 1 ? 'ads share the banner' : 'yours is the only ad') : 'not showing now'} />
        <Fact label="Share of banner time" value={u ? `${u.sharePercent}%` : '—'} hint={u ? `${u.secondsPerTurn} of ${u.cycleSeconds} seconds per round` : ''} />
        <Fact label="Runs until" value={stageTime(b.endsAt)} hint={b.daysLeft != null ? `${b.daysLeft} day${b.daysLeft === 1 ? '' : 's'} left` : ''} />
      </div>}

      {everRan && <div className="bap-facts">
        <Fact label="Times shown" value={NUMBER(b.views)} hint="home page visits that saw it" />
        <Fact label="Button presses" value={NUMBER(b.clicks)} hint={clickRate || 'Buy now or Description'} />
        {b.status !== 'LIVE' && b.startsAt && <Fact label="Ran" value={`${stageTime(b.startsAt)} → ${stageTime(b.endsAt)}`} />}
      </div>}

      <footer>
        <span className="bap-pay">{money(b.amount)}{b.days ? ` for ${b.days} days` : ''} · {b.paymentLabel}{b.paymentMethod ? ` · ${b.paymentMethod === 'MOMO' ? 'MTN Mobile Money' : 'Airtel Money'}` : ''}</span>
        <span className="bap-actions">
          {b.displaySeconds && <button type="button" className="text-btn" aria-expanded={open} onClick={() => setOpen((v) => !v)}>{open ? 'Hide preview' : 'See how it looks'}</button>}
          {b.status === 'AWAITING_PAYMENT' && <button type="button" className="outline-btn compact-btn" disabled={busy} onClick={() => onCancel(b.id)}>Cancel</button>}
        </span>
      </footer>
      {open && <div className="hb-frame bap-preview"><HeroSlide preview slide={{ product: { id: b.product || product.id, name: product.name, image: product.image, price: 0 }, title: b.title || product.name, description: b.description || '' }} /></div>}
    </article>
  );
}

/**
 * The seller's home banner ads: what each one cost, whether it is live, where it
 * sits in the banner, how much of the banner's time it gets, how often it was
 * shown and pressed, and how long it has left. Everything comes from the server.
 */
export default function BannerAdsPanel({ title = 'Home banner ads' }) {
  const qc = useQueryClient();
  const { data, isPending, error } = useQuery({ queryKey: ['ad-bookings', 'mine'], queryFn: adBookingsApi.mine, refetchInterval: 30000 });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const bookings = data?.bookings || [];

  const cancel = async (id) => {
    setBusy(true); setProblem('');
    try { await adBookingsApi.cancel(id); qc.invalidateQueries({ queryKey: ['ad-bookings', 'mine'] }); } catch (err) { setProblem(extractErrorMessage(err)); } finally { setBusy(false); }
  };

  const live = bookings.filter((b) => b.status === 'LIVE');
  const views = bookings.reduce((n, b) => n + Number(b.views || 0), 0);
  const clicks = bookings.reduce((n, b) => n + Number(b.clicks || 0), 0);

  return (
    <section className="data-card bap" aria-label={title}>
      <div className="data-card-head">
        <div><h3>{title}</h3><span>Banner time you bought on the Ikiguzi home page, and how it is being used.</span></div>
        <Link className="gradient-btn compact-btn" to="/advertise">Buy banner time</Link>
      </div>
      {isPending && <p className="tiny">Loading your ads…</p>}
      {error && <div className="form-alert error">{extractErrorMessage(error)}</div>}
      {problem && <div className="form-alert error">{problem}</div>}
      {!isPending && !error && !bookings.length && <p className="tiny">You haven&apos;t bought banner time yet. Pick a product, write a title, and choose how many seconds it should show: {data?.basePrice ? `${money(data.basePrice)} buys ${data.baseSeconds} seconds.` : 'it starts from 5,000 RWF.'}</p>}
      {bookings.length > 0 && <div className="bap-summary">
        <Fact label="Live now" value={live.length} />
        <Fact label="Times shown" value={NUMBER(views)} />
        <Fact label="Button presses" value={NUMBER(clicks)} hint={views ? `${((clicks / views) * 100).toFixed(1)}% of views` : ''} />
      </div>}
      <div className="bap-list">{bookings.map((b) => <AdCard key={b.id} b={b} onCancel={cancel} busy={busy} />)}</div>
    </section>
  );
}
