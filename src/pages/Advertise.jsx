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

const SELLERS = ['vendor', 'supplier', 'super_admin'];
const PAYMENT_DONE = ['SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED'];
const DEFAULT_RULES = { price: 5000, seconds: 5, days: 7, titleMax: 60, descriptionMax: 1000 };

/**
 * "Advertise here": a seller buys banner time for one product on the home page.
 * Every ad costs the same flat price and shows for 5 seconds each turn (the
 * server sets both). The seller writes the banner's title and description, sees
 * a preview, picks how to pay, and pays by mobile money. The ad goes live once
 * the payment is confirmed; Ikiguzi can take it down and refund it.
 */
export default function Advertise() {
  const { user } = useAuth();
  const location = useLocation();
  const { data: rules = DEFAULT_RULES } = useQuery({ queryKey: ['ad-pricing'], queryFn: adBookingsApi.pricing });

  return <Storefront><main className="account-page">
    <div className="page-title"><span className="eyebrow">ADVERTISE ON IKIGUZI</span><h1>Put your product in the home banner</h1>
      <p>Your product takes turns in the big banner at the top of the home page: its picture on the right, your title, description and price on the left. One ad costs {money(rules.price)} and runs for {rules.days} days; each ad shows for {rules.seconds} seconds before the next one. Pay by mobile money; if Ikiguzi takes the ad down, you are refunded in full.</p></div>
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
    {user && SELLERS.includes(user.role) && <Book rules={rules} />}
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
  const [method, setMethod] = useState('');
  const [phone, setPhone] = useState(user.telephone || '');
  const [device, setDevice] = useState('desktop');
  const [step, setStep] = useState('edit'); // edit → review → paying
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [placed, setPlaced] = useState(null); // { bookingId, paymentId, message } once the prompt is sent
  useEffect(() => { setPhone((p) => p || user.telephone || ''); }, [user.telephone]);

  const price = rules.price;
  const product = products.find((p) => p.id === productId);
  const chosen = methods.find((m) => m.id === method);
  const usable = methods.filter((m) => m.available);

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
    if (!chosen) return fail('Choose how you want to pay.');
    if (!isRwandanPhone(phone)) return fail('Enter the MTN or Airtel number that pays, for example 0788 123 456.');
    setNotice(null); setStep('review');
    return true;
  };

  const pay = async () => {
    if (busy) return;
    setBusy(true); setNotice(null);
    try {
      // No price goes to the server; it charges the flat price itself.
      const res = await adBookingsApi.book({ productId, title: title.trim(), description: description.trim(), paymentMethod: method, phoneNumber: phone.trim() });
      setPlaced({ bookingId: res.booking.id, paymentId: res.paymentId, message: res.message });
      setStep('paying');
      qc.invalidateQueries({ queryKey: ['ad-bookings', 'mine'] });
    } catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); setStep('edit'); } finally { setBusy(false); }
  };

  const startOver = () => {
    setPlaced(null); setStep('edit'); setNotice(null);
    setProductId(''); setTitle(''); setDescription('');
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

      <h3>3. Price</h3>
      <p className="adv-total" aria-live="polite">One ad = <b>{money(price)}</b> for {rules.days} days. It shows for {rules.seconds} seconds each time the banner comes round to it, the same as every other ad.</p>

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
      {step === 'edit' && <button type="submit" className="gradient-btn" disabled={!usable.length}>Review and pay {money(price)}</button>}

      {step === 'review' && chosen && <div className="adv-review" role="region" aria-label="Check your order">
        <h3>Check before you pay</h3>
        <dl>
          <dt>Product</dt><dd>{product?.name}</dd>
          <dt>Banner title</dt><dd>{title.trim()}</dd>
          <dt>Time in the banner</dt><dd>{rules.seconds} seconds each turn, for {rules.days} days</dd>
          <dt>Pay with</dt><dd>{chosen.label} · {phone.trim()}</dd>
          <dt>Total</dt><dd><b>{money(price)}</b></dd>
        </dl>
        <p className="tiny">You will get a prompt on your phone. Your ad goes live in the home banner as soon as the payment is confirmed.</p>
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
