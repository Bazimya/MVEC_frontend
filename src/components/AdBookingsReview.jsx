import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { adBookingsApi } from '../API/adBookings';
import { extractErrorMessage } from '../API/client';
import { money } from '../utils/format';
import { stageTime } from '../utils/tracker';
import ProductImage from './ProductImage';

const TABS = [['PAID', 'Waiting'], ['LIVE', 'Live'], ['PAUSED', 'Paused'], ['ENDED', 'Ended'], ['REJECTED', 'Rejected'], ['', 'All']];
const METHOD = { MOMO: 'MTN Mobile Money', AIRTEL: 'Airtel Money' };

/**
 * Ikiguzi: home banner ads. A booking arrives here once its payment was verified
 * with the payment provider. Approve to put it live (it then shows for the days
 * set in settings, and for the seconds the seller paid for each turn), or reject
 * and refund. Live ads can be paused, resumed or removed.
 */
export default function AdBookingsReview() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('PAID');
  const { data: rows = [], isPending, error } = useQuery({ queryKey: ['ad-bookings', 'admin', tab], queryFn: () => adBookingsApi.forAdmin(tab) });
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState(null);
  const act = async (id, fn) => {
    if (busy) return;
    setBusy(id); setNotice(null);
    try { const r = await fn(); setNotice({ ok: true, text: r.message }); qc.invalidateQueries({ queryKey: ['ad-bookings'] }); } catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); } finally { setBusy(''); }
  };
  const ask = (question, fn) => { const why = window.prompt(question); if (why) fn(why); };

  return (
    <div className="data-card">
      <div className="data-card-head"><div><h3>Home banner ads</h3><span>Sellers pay for seconds in the home banner. An ad goes live by itself once the payment provider confirms the payment; “Waiting” only holds older flat-fee bookings. You can pause, remove, or reject and refund an ad.</span></div></div>
      <div className="seg-tabs">{TABS.map(([v, l]) => <button key={v} type="button" className={tab === v ? 'active' : ''} onClick={() => setTab(v)}>{l}</button>)}</div>
      {notice && <div className={`form-alert ${notice.ok ? 'success' : 'error'}`}>{notice.text}</div>}
      {error && <div className="form-error">{extractErrorMessage(error)}</div>}
      {isPending && <p className="tiny">Loading…</p>}
      {!isPending && !rows.length && <p className="tiny">Nothing here.</p>}
      {rows.map((b) => (
        <div key={b.id} className="return-line ad-booking adm-ad">
          <ProductImage src={b.products?.[0]?.image} alt="" />
          <div>
            <b>{b.title || b.products?.[0]?.name || b.bookingNumber} · {b.statusLabel}</b>
            {b.description && <small className="adm-ad-desc">{b.description}</small>}
            <small className="tiny">
              {b.bookingNumber} · Seller: {b.sellerName || 'unknown'} · Product: {b.products?.map((p) => p.name).join(', ')}
            </small>
            <small className="tiny">
              {money(b.amount)}{b.displaySeconds ? ` for ${b.displaySeconds} seconds` : ' (older flat-fee booking)'} · {b.paymentLabel}
              {b.paymentMethod ? ` · ${METHOD[b.paymentMethod] || b.paymentMethod}` : ''}{b.payerPhone ? ` · ${b.payerPhone}` : ''}{b.paidAt ? ` · paid ${stageTime(b.paidAt)}` : ''}{b.displaySeconds ? ` · ${b.views || 0} views, ${b.clicks || 0} presses` : ''}
            </small>
            {(b.startsAt || b.endsAt) && <small className="tiny">Shows {stageTime(b.startsAt)} → {stageTime(b.endsAt)}</small>}
            {b.rejectionReason && <small className="tiny">Note: {b.rejectionReason}</small>}
          </div>
          <div className="row-actions">
            {b.status === 'PAID' && <>
              <button type="button" className="gradient-btn compact-btn" disabled={!!busy} onClick={() => act(b.id, () => adBookingsApi.approve(b.id))}>Approve</button>
              <button type="button" className="outline-btn compact-btn" disabled={!!busy} onClick={() => ask('Why reject it? The seller sees this, and the money is refunded.', (why) => act(b.id, () => adBookingsApi.reject(b.id, why)))}>Reject &amp; refund</button>
            </>}
            {b.status === 'LIVE' && <button type="button" className="outline-btn compact-btn" disabled={!!busy} onClick={() => act(b.id, () => adBookingsApi.deactivate(b.id))}>Pause</button>}
            {['LIVE', 'PAUSED'].includes(b.status) && b.displaySeconds && <button type="button" className="outline-btn compact-btn" disabled={!!busy} onClick={() => ask('Why take it down and refund? The seller sees this, and the money is refunded.', (why) => act(b.id, () => adBookingsApi.reject(b.id, why)))}>Refund &amp; take down</button>}
            {b.status === 'PAUSED' && <button type="button" className="gradient-btn compact-btn" disabled={!!busy} onClick={() => act(b.id, () => adBookingsApi.reactivate(b.id))}>Resume</button>}
            {['LIVE', 'PAUSED', 'ENDED'].includes(b.status) && <button type="button" className="outline-btn compact-btn" disabled={!!busy} onClick={() => ask('Why remove it? This takes the ad down for good. The record stays.', (why) => act(b.id, () => adBookingsApi.remove(b.id, why)))}>Remove</button>}
          </div>
        </div>
      ))}
    </div>
  );
}
