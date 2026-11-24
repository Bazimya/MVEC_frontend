import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Storefront from '../components/Storefront';
import ProductImage from '../components/ProductImage';
import { HeroSlide } from '../components/HeroBanner';
import BannerAdsPanel from '../components/BannerAdsPanel';
import { useAuth } from '../context/AuthContext';
import { adBookingsApi } from '../API/adBookings';
import { paymentsApi } from '../API/payments';
import { productsApi } from '../API/products';
import { suppliersApi } from '../API/suppliers';
import { extractErrorMessage } from '../API/client';
import { mapBackendProduct } from '../services/catalogApi';
import { money } from '../utils/format';
import { isRwandanPhone } from '../utils/delivery';
import { amountProblem, priceForSeconds, secondsForAmount } from '../utils/adPricing';

const SELLERS = ['vendor', 'supplier', 'super_admin'];
const QUICK_SECONDS = [3, 5, 10, 15, 20];
const PAYMENT_DONE = ['SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED'];
const DEFAULT_RULES = { basePrice: 5000, baseSeconds: 3, extraSecondPrice: 1000, maxSeconds: 60, days: 7, titleMax: 60, descriptionMax: 1000 };

/**
 * "Advertise here": a seller buys banner time for one product on the home page.
 * Each second costs money (the server's price list decides how much); the seller
 * writes the banner's title and description, sees a preview, picks how to pay,
 * and pays by mobile money. Ikiguzi checks the ad and puts it live, or refunds.
 */
export default function Advertise() {
  const { user } = useAuth();
  const location = useLocation();
  const { data: rules = DEFAULT_RULES } = useQuery({ queryKey: ['ad-pricing'], queryFn: adBookingsApi.pricing });

  return <Storefront><main className="account-page">
    <div className="page-title"><span className="eyebrow">ADVERTISE ON IKIGUZI</span><h1>Put your product in the home banner</h1>
      <p>Pay for the seconds you want. {money(rules.basePrice)} buys {rules.baseSeconds} seconds in the big banner at the top of the home page, and every extra second costs {money(rules.extraSecondPrice)}. Your ad runs for {rules.days} days after Ikiguzi approves it. Pay by mobile money; if Ikiguzi can&apos;t approve the ad, you are refunded in full.</p></div>
    {!user && <div className="data-card">
      <h3>Sign in to advertise</h3>
      <p className="tiny">Advertising is for seller and supplier accounts, the accounts that list products.</p>
      <div className="row-actions">
        <Link className="gradient-btn" to="/login" state={{ from: `${location.pathname}` }}>Log in</Link>
        <Link className="outline-btn" to="/signup" state={{ role: 'vendor', from: location.pathname }}>Create a seller account</Link>
      </div>
    </div>}
    {user && !SELLERS.includes(user.role) && <div className="data-card">
      <h3>Advertising is for sellers and suppliers</h3>
      <p className="tiny">Your account is a {user.role === 'buyer' ? 'buyer' : user.role} account. Open a store to list products, then advertise them here.</p>
      <Link className="gradient-btn" to="/signup" state={{ role: 'vendor' }}>Start selling</Link>
    </div>}
    {user && SELLERS.includes(user.role) && <Book key={`${rules.basePrice}-${rules.baseSeconds}-${rules.extraSecondPrice}-${rules.maxSeconds}`} rules={rules} />}
  </main></Storefront>;
}

function Book({ rules }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: products = [] } = useQuery({
    queryKey: ['ad-products', user.id],
    // Suppliers advertise the marketplace listings of their wholesale products.
    queryFn: () => (user.role === 'supplier'
      ? suppliersApi.getMyProducts().then((r) => (r.products || []).map((w) => w.retailProduct).filter((p) => p && typeof p === 'object').map((p) => ({ ...p, id: p.id || p._id })))
      : productsApi.getVendorProducts().then((r) => r.products || []))
      .then((list) => list.filter((p) => p.status === 'ACTIVE' && p.stockQuantity > 0)),
  });
  const { data: methods = [], isPending: methodsLoading, error: methodsError } = useQuery({ queryKey: ['ad-payment-methods'], queryFn: adBookingsApi.paymentMethods });

  const [productId, setProductId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [seconds, setSeconds] = useState(String(rules.baseSeconds));
  const [amountText, setAmountText] = useState(String(rules.basePrice));
  const [method, setMethod] = useState('');
  const [phone, setPhone] = useState(user.telephone || '');
  const [device, setDevice] = useState('desktop');
  const [step, setStep] = useState('edit'); // edit → review → paying
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [placed, setPlaced] = useState(null); // { bookingId, paymentId, message } once the prompt is sent
  useEffect(() => { setPhone((p) => p || user.telephone || ''); }, [user.telephone]);

  const price = priceForSeconds(Number(seconds), rules);
  const secondsOk = price !== null;
  const problem = amountProblem(amountText, rules, money) || (!secondsOk && seconds !== '' ? `Choose between ${rules.baseSeconds} and ${rules.maxSeconds} whole seconds.` : '');
  const product = products.find((p) => p.id === productId);
  const chosen = methods.find((m) => m.id === method);
  const usable = methods.filter((m) => m.available);

  // Seconds and amount are two ways to say the same thing: change one, the other follows.
  const pickSeconds = (value) => {
    setSeconds(value);
    const p = priceForSeconds(Number(value), rules);
    setAmountText(p === null ? '' : String(p));
  };
  const typeAmount = (value) => {
    setAmountText(value);
    const s = secondsForAmount(value, rules);
    setSeconds(s === null ? '' : String(s));
  };

  const preview = useMemo(() => ({
    product: product ? mapBackendProduct(product) : { id: '', name: 'Choose a product', image: '', price: 0 },
    title: title.trim() || 'Your title appears here',
    description: description.trim() || 'Your description appears here, under the title.',
  }), [product, title, description]);

  const review = (e) => {
    e.preventDefault();
    const fail = (text) => { setNotice({ ok: false, text }); return false; };
    if (!product) return fail('Choose the product you want to advertise.');
    if (title.trim().length < 3) return fail('Write a title of at least 3 characters.');
    if (description.trim().length < 5) return fail('Write a short description.');
    if (!secondsOk) return fail(problem || 'Choose how many seconds your ad should run.');
    if (!chosen) return fail('Choose how you want to pay.');
    if (!isRwandanPhone(phone)) return fail('Enter the MTN or Airtel number that pays, for example 0788 123 456.');
    setNotice(null); setStep('review');
    return true;
  };

  const pay = async () => {
    if (busy) return;
    setBusy(true); setNotice(null);
    try {
      // Only the seconds go to the server; it works out and charges the price itself.
      const res = await adBookingsApi.book({ productId, title: title.trim(), description: description.trim(), seconds: Number(seconds), paymentMethod: method, phoneNumber: phone.trim() });
      setPlaced({ bookingId: res.booking.id, paymentId: res.paymentId, message: res.message });
      setStep('paying');
      qc.invalidateQueries({ queryKey: ['ad-bookings', 'mine'] });
    } catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); setStep('edit'); } finally { setBusy(false); }
  };

  const startOver = () => {
    setPlaced(null); setStep('edit'); setNotice(null);
    setProductId(''); setTitle(''); setDescription(''); pickSeconds(String(rules.baseSeconds));
  };

  if (step === 'paying' && placed) return <>
    <PaymentStatus placed={placed} onAnother={startOver} />
    <BannerAdsPanel title="My banner ads" />
  </>;

  return <>
    <form className="data-card adv-form" onSubmit={review}>
      <h3>1. Choose the product</h3>
      {!products.length && <p className="tiny">You have no products on sale yet. Add products first: only live, in-stock products can be advertised.</p>}
      <div className="ad-pick-grid" role="radiogroup" aria-label="Product to advertise">
        {products.map((p) => (
          <label key={p.id} className={'ad-pick' + (productId === p.id ? ' active' : '')}>
            <input type="radio" name="product" checked={productId === p.id} onChange={() => setProductId(p.id)} />
            <ProductImage src={p.media?.mainImage} alt="" />
            <span><b>{p.name}</b><small className="tiny">{money(p.discountPrice || p.price)}</small></span>
          </label>
        ))}
      </div>

      <h3>2. Write your banner</h3>
      <label className="field"><span>Title <small className="tiny">(the big text)</small></span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={rules.titleMax} placeholder="Fresh coffee, direct from Huye" />
        <small className="tiny adv-count">{title.length} / {rules.titleMax}</small>
      </label>
      <label className="field"><span>Description <small className="tiny">(smaller text under the title)</small></span>
        <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={rules.descriptionMax} placeholder="Say what makes it worth a look. Long text is cut off with … in the banner." />
        <small className="tiny adv-count">{description.length} / {rules.descriptionMax}</small>
      </label>

      <h3>3. How long should it show?</h3>
      <p className="tiny">This is the time your ad stays in the banner each time it comes round. {money(rules.basePrice)} buys {rules.baseSeconds} seconds, then {money(rules.extraSecondPrice)} for every extra second.</p>
      <div className="adv-chips" role="group" aria-label="Quick choices">
        {QUICK_SECONDS.filter((s) => s >= rules.baseSeconds && s <= rules.maxSeconds).map((s) => (
          <button type="button" key={s} className={'adv-chip' + (Number(seconds) === s ? ' on' : '')} aria-pressed={Number(seconds) === s} onClick={() => pickSeconds(String(s))}>
            <b>{s} seconds</b><small>{money(priceForSeconds(s, rules))}</small>
          </button>
        ))}
      </div>
      <div className="two-col">
        <label className="field"><span>Seconds</span>
          <input type="number" inputMode="numeric" min={rules.baseSeconds} max={rules.maxSeconds} step="1" value={seconds} onChange={(e) => pickSeconds(e.target.value)} />
        </label>
        <label className="field"><span>Or the amount to spend (RWF)</span>
          <input type="text" inputMode="numeric" value={amountText} onChange={(e) => typeAmount(e.target.value.replace(/[^\d]/g, ''))} />
        </label>
      </div>
      {problem
        ? <div className="form-alert error" role="alert">{problem}</div>
        : <p className="adv-total" aria-live="polite">{secondsOk ? <>{seconds} seconds = <b>{money(price)}</b></> : 'Choose the seconds or the amount.'}</p>}

      <h3>4. Preview</h3>
      <div className="adv-preview-bar" role="group" aria-label="Preview size">
        {[['desktop', 'Computer'], ['phone', 'Phone']].map(([key, label]) => (
          <button type="button" key={key} className={device === key ? 'on' : ''} aria-pressed={device === key} onClick={() => setDevice(key)}>{label}</button>
        ))}
      </div>
      <div className={'adv-preview ' + device}>
        <div className="hb-frame"><HeroSlide slide={preview} preview /></div>
      </div>
      <p className="tiny">This is how your ad looks on the home page. The buttons take shoppers to this product.</p>

      <h3>5. Pay</h3>
      <div className="adv-methods" role="radiogroup" aria-label="Payment method">
        {methodsLoading && <p className="tiny">Loading payment methods…</p>}
        {methodsError && <div className="form-alert error">We couldn&apos;t load the payment methods. Refresh the page to try again.</div>}
        {methods.map((m) => (
          <label key={m.id} className={'adv-method' + (method === m.id ? ' active' : '') + (m.available ? '' : ' off')}>
            <input type="radio" name="method" value={m.id} disabled={!m.available} checked={method === m.id} onChange={() => setMethod(m.id)} />
            <span><b>{m.label}</b><small className="tiny">{m.available ? `Numbers starting ${m.numbers}${m.testMode ? ' · test mode, no money is taken' : ''}` : 'Not available right now'}</small></span>
          </label>
        ))}
        {!methodsLoading && !methodsError && !usable.length && <p className="tiny">No payment method is available right now. Please try again later.</p>}
      </div>
      <label className="field"><span>Mobile money number that pays</span>
        <input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0788 123 456" autoComplete="tel" />
      </label>

      {notice && <div className={`form-alert ${notice.ok ? 'success' : 'error'}`} role="alert">{notice.text}</div>}
      {step === 'edit' && <button type="submit" className="gradient-btn" disabled={!usable.length}>Review and pay{secondsOk ? ` ${money(price)}` : ''}</button>}

      {step === 'review' && chosen && <div className="adv-review" role="region" aria-label="Check your order">
        <h3>Check before you pay</h3>
        <dl>
          <dt>Product</dt><dd>{product?.name}</dd>
          <dt>Banner title</dt><dd>{title.trim()}</dd>
          <dt>Time in the banner</dt><dd>{seconds} seconds, for {rules.days} days once approved</dd>
          <dt>Pay with</dt><dd>{chosen.label} · {phone.trim()}</dd>
          <dt>Total</dt><dd><b>{money(price)}</b></dd>
        </dl>
        <p className="tiny">You will get a prompt on your phone. Your ad is booked only after the payment is confirmed, and goes live after Ikiguzi approves it.</p>
        <div className="row-actions">
          <button type="button" className="gradient-btn" disabled={busy} onClick={pay}>{busy ? 'Sending the payment prompt…' : `Confirm and pay ${money(price)}`}</button>
          <button type="button" className="outline-btn" disabled={busy} onClick={() => setStep('edit')}>Change something</button>
        </div>
      </div>}
    </form>
    <BannerAdsPanel title="My banner ads" />
  </>;
}

/** What the payment is doing right now, straight from the server (the page never decides an ad is paid). */
function PaymentStatus({ placed, onAnother }) {
  const qc = useQueryClient();
  const [cancelled, setCancelled] = useState(null);
  const { data, error } = useQuery({
    queryKey: ['ad-payment', placed.paymentId],
    queryFn: () => paymentsApi.getStatus(placed.paymentId),
    refetchInterval: (query) => (PAYMENT_DONE.includes(query.state.data?.payment?.status) ? false : 4000),
  });
  const status = cancelled ? 'CANCELLED' : data?.payment?.status || 'PENDING';
  const done = PAYMENT_DONE.includes(status);
  useEffect(() => { if (done) qc.invalidateQueries({ queryKey: ['ad-bookings', 'mine'] }); }, [done, qc]);

  const cancel = async () => {
    try { await adBookingsApi.cancel(placed.bookingId); setCancelled(true); } catch (err) { setCancelled(null); window.alert(extractErrorMessage(err)); }
  };
  const view = {
    PENDING: ['Pending', 'pending', 'Approve the payment prompt on your phone. This page updates by itself.'],
    PROCESSING: ['Pending', 'pending', 'Your payment is being processed. This page updates by itself.'],
    SUCCESS: ['Successful', 'ok', 'Payment received. Ikiguzi will review your ad and tell you when it is live. Nothing shows in the banner until then.'],
    FAILED: ['Failed', 'bad', 'The payment did not go through, so your ad was not booked. No money was taken. You can try again.'],
    CANCELLED: ['Cancelled', 'bad', 'This payment was cancelled and your ad was not booked.'],
    REFUNDED: ['Refunded', 'bad', 'This payment was refunded.'],
  }[status] || ['Pending', 'pending', ''];

  return <div className="data-card adv-status" role="status" aria-live="polite">
    <span className={`adv-pill ${view[1]}`}>{view[0]}</span>
    <h3>{view[0] === 'Successful' ? 'Payment successful' : view[0] === 'Pending' ? 'Waiting for your payment' : `Payment ${view[0].toLowerCase()}`}</h3>
    <p>{view[2]}</p>
    {placed.message && !done && <p className="tiny">{placed.message}</p>}
    {error && <p className="tiny">We couldn&apos;t check the payment just now. If you approved it, it will still be recorded.</p>}
    <div className="row-actions">
      {!done && <button type="button" className="outline-btn" onClick={cancel}>Cancel this booking</button>}
      {done && <button type="button" className="gradient-btn" onClick={onAnother}>{status === 'SUCCESS' ? 'Book another ad' : 'Try again'}</button>}
    </div>
  </div>;
}
