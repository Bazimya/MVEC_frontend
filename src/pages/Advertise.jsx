import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Storefront from '../components/Storefront';
import ProductImage from '../components/ProductImage';
import { useAuth } from '../context/AuthContext';
import { adBookingsApi } from '../API/adBookings';
import { productsApi } from '../API/products';
import { suppliersApi } from '../API/suppliers';
import { extractErrorMessage } from '../API/client';
import { money, formatDate } from '../utils/format';
import { isRwandanPhone } from '../utils/delivery';

const SELLERS = ['vendor', 'supplier', 'super_admin'];

/**
 * "Advertise here": sellers and suppliers put products in the home page
 * hero for a flat fee per product, paid by mobile money. Ikiguzi approves it,
 * or rejects it and refunds the number that paid.
 */
export default function Advertise() {
  const { user } = useAuth();
  const location = useLocation();
  const { data: price } = useQuery({ queryKey: ['ad-pricing'], queryFn: adBookingsApi.pricing });
  const per = price?.pricePerProduct ?? 1000;
  const days = price?.days ?? 7;

  return <Storefront><main className="account-page">
    <div className="page-title"><span className="eyebrow">ADVERTISE ON IKIGUZI</span><h1>Put your products on the home page</h1>
      <p>Your products show in the big banner at the top of the Ikiguzi home page for {days} days. It costs {money(per)} per product: 3 products cost {money(per * 3)}. Pay by mobile money; Ikiguzi checks the ad and puts it live, or refunds you in full.</p></div>
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
    {user && SELLERS.includes(user.role) && <Book per={per} days={days} />}
  </main></Storefront>;
}

function Book({ per, days }) {
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
  const { data: mine } = useQuery({ queryKey: ['ad-bookings', 'mine'], queryFn: adBookingsApi.mine, refetchInterval: 15000 });
  const [picked, setPicked] = useState([]);
  const [phone, setPhone] = useState(user.telephone || '');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  useEffect(() => { setPhone((p) => p || user.telephone || ''); }, [user.telephone]);
  const toggle = (id) => setPicked((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id]));
  const total = per * picked.length;

  const pay = async (e) => {
    e.preventDefault();
    if (!picked.length) { setNotice({ ok: false, text: 'Choose at least one product.' }); return; }
    if (!isRwandanPhone(phone)) { setNotice({ ok: false, text: 'Enter the MTN or Airtel number that pays, for example 0788 123 456.' }); return; }
    setBusy(true); setNotice(null);
    try {
      const res = await adBookingsApi.book(picked, phone.trim());
      setNotice({ ok: true, text: res.message });
      setPicked([]);
      qc.invalidateQueries({ queryKey: ['ad-bookings', 'mine'] });
    } catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); } finally { setBusy(false); }
  };

  return <>
    <form className="data-card" onSubmit={pay}>
      <h3>Choose products</h3>
      {!products.length && <p className="tiny">You have no products on sale yet. Add products first: only live, in-stock products can be advertised.</p>}
      <div className="ad-pick-grid">
        {products.map((p) => (
          <label key={p.id} className={'ad-pick' + (picked.includes(p.id) ? ' active' : '')}>
            <input type="checkbox" checked={picked.includes(p.id)} onChange={() => toggle(p.id)} />
            <ProductImage src={p.media?.mainImage} alt="" />
            <span><b>{p.name}</b><small className="tiny">{money(p.discountPrice || p.price)}</small></span>
          </label>
        ))}
      </div>
      <div className="two-col">
        <label className="field"><span>Mobile money number that pays</span><input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0788 123 456" /></label>
        <div className="field"><span>Total</span><b className="ad-total">{picked.length} × {money(per)} = {money(total)}</b><small className="tiny">{days} days on the home page after Ikiguzi approves it.</small></div>
      </div>
      {notice && <div className={`form-alert ${notice.ok ? 'success' : 'error'}`}>{notice.text}</div>}
      <button type="submit" className="gradient-btn" disabled={busy || !picked.length}>{busy ? 'Sending the payment prompt…' : `Pay ${money(total)}`}</button>
    </form>
    {(mine?.bookings || []).length > 0 && <div className="data-card">
      <h3>My ads</h3>
      {mine.bookings.map((b) => (
        <div key={b.id} className="return-line ad-booking">
          <ProductImage src={b.products[0]?.image} alt="" />
          <div><b>{b.bookingNumber} · {b.statusLabel}</b><small className="tiny">{b.products.map((p) => p.name).join(', ')} · {money(b.amount)}{b.status === 'LIVE' ? ` · until ${formatDate(b.endsAt)}` : ''}</small>{b.status === 'REJECTED' && <small className="tiny">Reason: {b.rejectionReason}. Refunded to {b.payerPhone || 'the paying number'}.</small>}</div>
        </div>
      ))}
    </div>}
  </>;
}
