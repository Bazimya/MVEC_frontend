import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adBookingsApi } from '../API/adBookings';
import { extractErrorMessage } from '../API/client';
import { money, formatDate } from '../utils/format';
import ProductImage from './ProductImage';

const TABS = [['PAID', 'To approve'], ['LIVE', 'Live'], ['REJECTED', 'Rejected'], ['', 'All']];

/** Ikiguzi: home page ad bookings that are paid; approve to put live, or reject and refund. */
export default function AdBookingsReview() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('PAID');
  const { data: rows = [], isPending, error } = useQuery({ queryKey: ['ad-bookings', 'admin', tab], queryFn: () => adBookingsApi.forAdmin(tab) });
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  const act = async (id, fn) => {
    setBusy(id); setNotice(null);
    try { const r = await fn(); setNotice({ ok: true, text: r.message }); qc.invalidateQueries({ queryKey: ['ad-bookings'] }); } catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); } finally { setBusy(''); }
  };
  return (
    <div className="data-card">
      <div className="data-card-head"><div><h3>Home page ad bookings</h3><span>"Advertise here": paid per product. Approve to put them in the home banner; rejecting refunds the number that paid.</span></div></div>
      <div className="seg-tabs">{TABS.map(([v, l]) => <button key={v} type="button" className={tab === v ? 'active' : ''} onClick={() => setTab(v)}>{l}</button>)}</div>
      {notice && <div className={`form-alert ${notice.ok ? 'success' : 'error'}`}>{notice.text}</div>}
      {error && <div className="form-error">{extractErrorMessage(error)}</div>}
      {isPending && <p className="tiny">Loading…</p>}
      {!isPending && !rows.length && <p className="tiny">Nothing here.</p>}
      {rows.map((b) => (
        <div key={b.id} className="return-line ad-booking">
          <ProductImage src={b.products[0]?.image} alt="" />
          <div>
            <b>{b.bookingNumber} · {b.sellerName} · {money(b.amount)}</b>
            <small className="tiny">{b.statusLabel} · {b.products.map((p) => p.name).join(', ')} · paid {formatDate(b.paidAt)} from {b.payerPhone}{b.status === 'LIVE' ? ` · live until ${formatDate(b.endsAt)}` : ''}</small>
          </div>
          {b.status === 'PAID' && <div className="row-actions">
            <button type="button" className="gradient-btn compact-btn" disabled={!!busy} onClick={() => act(b.id, () => adBookingsApi.approve(b.id))}>Approve</button>
            <button type="button" className="outline-btn compact-btn" disabled={!!busy} onClick={() => { const why = window.prompt('Why reject it? The seller sees this, and the money is refunded.'); if (why) act(b.id, () => adBookingsApi.reject(b.id, why)); }}>Reject & refund</button>
          </div>}
        </div>
      ))}
    </div>
  );
}
