import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ProductImage from './ProductImage';
import { AdCardPreview } from './HeroBanner';
import { adBookingsApi } from '../API/adBookings';
import { useAuth } from '../context/AuthContext';
import { useAdProducts } from '../lib/useAdProducts';
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

const EDITABLE = ['AWAITING_PAYMENT', 'LIVE', 'PAUSED'];

/** Change the title, description or product (its picture) of an ad. Status, price and dates stay as they are. */
function EditAd({ b, products, rules, busy, onSave, onClose }) {
  const [title, setTitle] = useState(b.title || '');
  const [description, setDescription] = useState(b.description || '');
  const [productId, setProductId] = useState(String(b.product || b.products?.[0]?.id || ''));
  const [problem, setProblem] = useState('');
  // The current product may be out of stock now; keep it listed so the choice still shows.
  const options = products.some((p) => String(p.id) === productId) ? products : [{ id: productId, name: b.products?.[0]?.name || 'Current product' }, ...products];
  const submit = async (e) => {
    e.preventDefault();
    if (title.trim().length < 3) return setProblem('Write a title of at least 3 characters.');
    if (description.trim().length < 5) return setProblem('Write a short description.');
    setProblem('');
    const changes = {};
    if (title.trim() !== (b.title || '')) changes.title = title.trim();
    if (description.trim() !== (b.description || '')) changes.description = description.trim();
    if (productId !== String(b.product || b.products?.[0]?.id || '')) changes.productId = productId;
    if (!Object.keys(changes).length) return onClose();
    return onSave(changes, setProblem);
  };
  return (
    <form className="bap-edit" onSubmit={submit}>
      <label className="field"><span>Product <small className="tiny">(its picture is your ad&apos;s picture)</small></span>
        <select value={productId} onChange={(e) => setProductId(e.target.value)}>
          {options.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label className="field"><span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={rules?.titleMax || 60} />
      </label>
      <label className="field"><span>Description</span>
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={rules?.descriptionMax || 1000} />
      </label>
      {problem && <div className="form-alert error" role="alert">{problem}</div>}
      <p className="tiny">Changes show on the home page right away. Your payment, dates and Ikiguzi&apos;s review are not affected.</p>
      <div className="row-actions">
        <button type="submit" className="gradient-btn compact-btn" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        <button type="button" className="outline-btn compact-btn" disabled={busy} onClick={onClose}>Close</button>
      </div>
    </form>
  );
}

function AdCard({ b, onCancel, onSave, onDelete, products, rules, busy }) {
  const product = b.products?.[0] || {};
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
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
          {EDITABLE.includes(b.status) && <button type="button" className="outline-btn compact-btn" disabled={busy} aria-expanded={editing} onClick={() => { setEditing((v) => !v); setConfirming(false); }}>Edit</button>}
          {b.status === 'AWAITING_PAYMENT' && <button type="button" className="outline-btn compact-btn" disabled={busy} onClick={() => onCancel(b.id)}>Cancel</button>}
          {['LIVE', 'PAUSED'].includes(b.status) && <button type="button" className="outline-btn compact-btn bap-danger" disabled={busy} onClick={() => { setConfirming(true); setEditing(false); }}>Delete</button>}
        </span>
      </footer>
      {editing && <EditAd b={b} products={products} rules={rules} busy={busy} onClose={() => setEditing(false)} onSave={async (changes, fail) => { if (await onSave(b.id, changes, fail)) setEditing(false); }} />}
      {confirming && <div className="bap-confirm" role="alertdialog" aria-label="Delete this ad?">
        <p><b>Delete &ldquo;{b.title || product.name}&rdquo;?</b> It leaves the home page right away. The {money(b.amount)} you paid is not refunded, because the ad already ran. This can&apos;t be undone.</p>
        <div className="row-actions">
          <button type="button" className="danger-btn compact-btn" disabled={busy} onClick={async () => { await onDelete(b.id); setConfirming(false); }}>{busy ? 'Deleting…' : 'Yes, delete it'}</button>
          <button type="button" className="outline-btn compact-btn" disabled={busy} onClick={() => setConfirming(false)}>Keep it</button>
        </div>
      </div>}
      {open && <AdCardPreview slide={{ product: { id: b.product || product.id, name: product.name, image: product.image, price: 0 }, title: b.title || product.name, description: b.description || '' }} />}
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
  const { user } = useAuth();
  const { data: products = [] } = useAdProducts(user);
  const { data, isPending, error } = useQuery({ queryKey: ['ad-bookings', 'mine'], queryFn: adBookingsApi.mine, refetchInterval: 30000 });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [done, setDone] = useState('');
  const bookings = data?.bookings || [];

  const cancel = async (id) => {
    setBusy(true); setProblem('');
    try { await adBookingsApi.cancel(id); qc.invalidateQueries({ queryKey: ['ad-bookings', 'mine'] }); } catch (err) { setProblem(extractErrorMessage(err)); } finally { setBusy(false); }
  };

  const refresh = () => qc.invalidateQueries({ queryKey: ['ad-bookings', 'mine'] });
  // Saves an edit. Returns true when it worked; otherwise `fail` shows the server's reason in the form.
  const save = async (id, changes, fail) => {
    setBusy(true); setProblem(''); setDone('');
    try { const r = await adBookingsApi.update(id, changes); setDone(r.message); refresh(); return true; } catch (err) { fail(extractErrorMessage(err)); return false; } finally { setBusy(false); }
  };
  const destroy = async (id) => {
    setBusy(true); setProblem(''); setDone('');
    try { const r = await adBookingsApi.destroy(id); setDone(r.message); refresh(); } catch (err) { setProblem(extractErrorMessage(err)); } finally { setBusy(false); }
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
      {problem && <div className="form-alert error" role="alert">{problem}</div>}
      {done && <div className="form-alert success" role="status">{done}</div>}
      {!isPending && !error && !bookings.length && <p className="tiny">You haven&apos;t advertised yet. Pick a product, write a title and a short description, and pay {data?.price ? money(data.price) : 'the flat price'}: your ad is in the home page banner for {data?.days || 7} days.</p>}
      {bookings.length > 0 && <div className="bap-summary">
        <Fact label="Live now" value={live.length} />
        <Fact label="Times shown" value={NUMBER(views)} />
        <Fact label="Button presses" value={NUMBER(clicks)} hint={views ? `${((clicks / views) * 100).toFixed(1)}% of views` : ''} />
      </div>}
      <div className="bap-list">{bookings.map((b) => <AdCard key={b.id} b={b} onCancel={cancel} onSave={save} onDelete={destroy} products={products} rules={data} busy={busy} />)}</div>
    </section>
  );
}
