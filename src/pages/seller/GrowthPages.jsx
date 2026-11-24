// Seller subscription page (the freemium plan).
import { useState } from 'react';
import { vendorServicesApi } from '../../API/vendorServices';
import { Link } from 'react-router-dom';
import { PageHead, Loading, Metric, StatusPill, money, dateDMY, useNotice } from './shared';
import { useLoader } from '../../lib/useLoader';

// Fallback when the server's plan details haven't loaded.
const PLAN_PERKS = {
  FREE: ['Create a seller or supplier account and store', 'List products up to the Free limit', 'Receive and manage orders', 'Basic sales and inventory tools', 'Standard support'],
  PREMIUM: ['Higher or unlimited product listings (fair use)', 'Advanced sales reports and product analytics', 'Bulk product upload', 'Premium store branding', 'Promotional campaigns and featured listings', 'Priority support', 'Low-stock alerts', 'Growth insights'],
};

export function SubscriptionPage({ api = vendorServicesApi, balanceLink = '/vendor/payouts' }) {
  const { data, loading, error, reload } = useLoader(['subscription'], () => api.getSubscription());
  const [busy, setBusy] = useState('');
  const notice = useNotice();

  const tiers = data?.tiers || [];
  const sub = data?.subscription;
  const premium = sub?.planKey === 'PREMIUM' && sub?.status === 'Active';
  const plans = data?.plans;
  const programActive = Boolean(plans?.programActive);
  const perks = { FREE: plans?.freeIncludes || PLAN_PERKS.FREE, PREMIUM: plans?.premiumFeatures || PLAN_PERKS.PREMIUM };
  const price = plans?.sellerPremiumPrice || tiers.find(t => t.planKey === 'PREMIUM')?.price || 5000;
  const balance = Number(data?.availableBalance || 0);
  const short = !premium && balance < price;

  const run = async (plan, confirmText) => {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(plan);
    try {
      const res = await api.changeSubscription(plan);
      notice.success(res.message);
      reload();
    } catch (err) { notice.fail(err); }
    finally { setBusy(''); }
  };
  const upgrade = () => run('PREMIUM', `Pay ${money(price)} from your available balance (${money(balance)}) for 30 days of Seller Premium? It renews monthly from your balance until you turn auto-renew off.`);
  const stopRenew = () => run('FREE', `Turn off auto-renew? Premium stays active until ${dateDMY(sub?.renewalDate)}, then you move to Free.`);
  const resumeRenew = () => run('PREMIUM');

  return <>
    <PageHead title="Subscription" desc="Selling on Ikiguzi is free. Premium adds visibility and advanced tools, paid monthly from your sales balance." />
    {notice.banner}
    {data && !programActive && <div className="verified-box"><b>Every tool is free for now</b><p>While Ikiguzi grows, you have everything, including the Premium tools, at no cost. Paid plans will start later, and you'll be told well before anything changes.</p></div>}
    {loading && !data && <Loading />}
    {error && <div className="form-error">{error}</div>}
    {data && <>
      <div className="metric-grid">
        <Metric label="Current plan" value={premium ? 'Seller Premium' : programActive ? 'Free' : 'Free · all tools included'} icon="tag" sub={premium ? (sub.autoRenew ? `Renews ${dateDMY(sub.renewalDate)}` : `Ends ${dateDMY(sub.renewalDate)}`) : 'No monthly fee'} />
        <Metric label="Available balance" value={money(balance)} icon="wallet" sub="Premium is paid from this" />
        <Metric label="Auto-renew" value={premium ? (sub.autoRenew ? 'On' : 'Off') : '—'} icon="shield" sub={premium ? `${money(sub.price || price)} every 30 days` : 'Starts with Premium'} />
      </div>

      <div className="seller-plans">
        {tiers.map(t => {
          const current = (t.planKey === 'PREMIUM') === premium;
          return <div className={'data-card seller-plan' + (current ? ' current' : '')} key={t.planKey}>
            <div className="data-card-head"><div><span className="eyebrow">{t.plan}</span></div>{current && <StatusPill value="ACTIVE" />}</div>
            <h2>{t.price ? money(t.price) : 'Free'}<small>{t.price ? ' / 30 days' : ''}</small></h2>
            <ul className="simple-list">{(perks[t.planKey] || []).map(p => <li key={p}>{t.planKey === 'FREE' && p.startsWith('List products') && plans?.freeProductLimit ? `${p} (${plans.freeProductLimit})` : p}</li>)}</ul>
            {t.planKey === 'PREMIUM' && !programActive && !premium && <button type="button" className="outline-btn" disabled>Coming soon</button>}
            {t.planKey === 'PREMIUM' && (programActive || premium) && (premium
              ? (sub.autoRenew
                  ? <button type="button" className="outline-btn" disabled={!!busy} onClick={stopRenew}>{busy ? 'Updating…' : 'Turn off auto-renew'}</button>
                  : <button type="button" className="gradient-btn" disabled={!!busy} onClick={resumeRenew}>{busy ? 'Updating…' : 'Resume auto-renew'}</button>)
              : <>
                  <button type="button" className="gradient-btn" disabled={!!busy || short} onClick={upgrade}>{busy === 'PREMIUM' ? 'Paying…' : `Upgrade · pay ${money(t.price)}`}</button>
                  {short && <p className="tiny">You need {money(price - balance)} more in your available balance. Money becomes available when buyers confirm delivery. <Link to={balanceLink}>See balance</Link></p>}
                </>)}
            {t.planKey === 'FREE' && <button type="button" className="outline-btn" disabled>{premium ? (sub.autoRenew ? `Free after you stop renewal` : `Starts ${dateDMY(sub.renewalDate)}`) : 'Current plan'}</button>}
          </div>;
        })}
      </div>

      <div className="data-card">
        <div className="data-card-head"><h3>Billing history</h3></div>
        {(data.charges || []).length === 0 && <p className="tiny">No subscription charges yet.</p>}
        {(data.charges || []).map(c => <div className="activity-row" key={c._id || c.reference}>
          <div><b>{c.reference}</b><small>{dateDMY(c.createdAt)} · {c.description}</small></div>
          <div><strong className="seller-negative">-{money(c.amount)}</strong><StatusPill value={c.status} /></div>
        </div>)}
      </div>
    </>}
  </>;
}
