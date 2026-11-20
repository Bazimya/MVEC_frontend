import { Link } from "react-router-dom";
import { authApi } from "../API/auth";
import { useAuth } from "../context/AuthContext";
import { isRwandanPhone } from "../utils/delivery";
import { usePhoneCodes } from "../lib/phoneCodes";
import { useEffect, useMemo, useState } from "react";
import Pagination from "../components/Pagination";
import Storefront from "../components/Storefront";
import { ordersApi } from "../API/orders";
import { extractErrorMessage } from "../API/client";
import { money, formatDate } from "../utils/format";
import { buyerStatus, canCancel, countdown, isAwaitingPayment, paidCancelRemaining } from "../utils/orders";

const PER_PAGE = 8;

/**
 * Signed out: follow an order with the phone it was placed with. A text code
 * proves the phone (guests and regular buyers alike), then the orders show.
 */
export function FollowOrders() {
  const { startSession } = useAuth();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  // No SMS yet: the phone and an order number instead of a code.
  const codesOn = usePhoneCodes();
  const [orderNumber, setOrderNumber] = useState("");

  const lookUp = async (e) => {
    e.preventDefault();
    if (!isRwandanPhone(phone)) { setError("Enter the phone number you ordered with (07…)."); return; }
    if (orderNumber.trim().length < 5) { setError("Enter the order number from your confirmation (it starts with ORD-)."); return; }
    setBusy(true); setError("");
    try { startSession(await authApi.guestVerify({ phone: phone.trim(), track: true, orderNumber: orderNumber.trim() })); }
    catch (err) { setError(extractErrorMessage(err)); setBusy(false); }
  };

  const send = async (e) => {
    e.preventDefault();
    if (!isRwandanPhone(phone)) { setError("Enter the phone number you ordered with (07…)."); return; }
    setBusy(true); setError("");
    try { const r = await authApi.guestSendCode(phone.trim()); setSent(true); setNote(r.message || "We sent you a 6-digit code."); }
    catch (err) { setError(extractErrorMessage(err)); }
    finally { setBusy(false); }
  };
  const verify = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) { setError("Enter the 6-digit code."); return; }
    setBusy(true); setError("");
    try { startSession(await authApi.guestVerify({ phone: phone.trim(), code: code.trim(), track: true })); }
    catch (err) { setError(extractErrorMessage(err)); setBusy(false); }
  };

  return (
    <Storefront>
      <section className="follow-orders">
        <span className="eyebrow">MY ORDERS</span>
        <h1>Follow your order</h1>
        <p>{codesOn === false
          ? "Enter the phone number you ordered with and one of your order numbers. We'll show your orders and where each parcel is."
          : "Enter the phone number you ordered with. We'll text you a code, then show your orders and where each parcel is."}</p>
        {error && <div className="form-error" role="alert">{error}</div>}
        {codesOn === false ? (
          <form onSubmit={lookUp} className="follow-orders-form">
            <label className="field"><span>Phone number</span><input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xx xxx xxx" required /></label>
            <label className="field"><span>Order number</span><input value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="ORD-…" autoCapitalize="characters" required /></label>
            <button type="submit" className="gradient-btn" disabled={busy}>{busy ? "Checking…" : "Show my orders"}</button>
          </form>
        ) : !sent ? (
          <form onSubmit={send} className="follow-orders-form">
            <label className="field"><span>Phone number</span><input type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xx xxx xxx" required /></label>
            <button type="submit" className="gradient-btn" disabled={busy}>{busy ? "Sending…" : "Text me a code"}</button>
          </form>
        ) : (
          <form onSubmit={verify} className="follow-orders-form">
            {note && <p className="tiny">{note}</p>}
            <label className="field"><span>6-digit code</span><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required /></label>
            <button type="submit" className="gradient-btn" disabled={busy}>{busy ? "Checking…" : "Show my orders"}</button>
            <button type="button" className="text-btn" onClick={() => { setSent(false); setCode(""); setNote(""); }}>Use another number</button>
          </form>
        )}
        <p className="tiny">Have a password? <Link to="/login" state={{ from: "/orders" }}>Sign in</Link> instead.</p>
      </section>
    </Storefront>
  );
}

/** /orders and /orders/:id: the page, or the phone check when signed out. */
export function OrdersGate({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Storefront><div className="loading-screen">Loading…</div></Storefront>;
  return user ? (children || <Orders />) : <FollowOrders />;
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    ordersApi.getMyOrders()
      .then((res) => setOrders(res.orders || []))
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  // Tick only while some order still has a cancellation countdown.
  const needsClock = orders.some((o) => paidCancelRemaining(o, now) > 0);
  useEffect(() => {
    if (!needsClock) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [needsClock]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return orders;
    return orders.filter((o) => [o.orderNumber, buyerStatus(o), ...(o.items || []).map((i) => i.name)]
      .join(" ").toLowerCase().includes(needle));
  }, [orders, q]);
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const currentPage = Math.min(page, pages);
  const shown = filtered.slice((currentPage - 1) * PER_PAGE, currentPage * PER_PAGE);

  const cancel = async (order) => {
    const paid = order.paymentStatus === "PAID";
    const backTo = order.paymentMethod === "CARD" ? "the card you paid with" : "your mobile money";
    if (!window.confirm(paid ? `Cancel this order? Your payment is sent back to ${backTo}.` : "Cancel this order?")) return;
    setError("");
    setMessage("");
    setBusyId(order.id);
    try {
      const res = await ordersApi.cancel(order.id);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? res.order : o)));
      setMessage(res.message);
    } catch (err) {
      setError(extractErrorMessage(err));
    } finally {
      setBusyId("");
    }
  };

  if (loading) {
    return <Storefront><main className="account-page"><div className="empty-state"><h3>Loading your orders…</h3></div></main></Storefront>;
  }

  return <Storefront><main className="account-page">
    <div className="page-title"><span className="eyebrow">PURCHASES</span><h1>My orders</h1><p>Track payment, delivery and protected settlement from one place.</p></div>
    {orders.length > 0 && <div className="dash-toolbar"><div className="dash-filter"><span aria-hidden="true">⌕</span><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search by order number, product or status…" aria-label="Search orders" /></div></div>}
    {message && <div className="form-alert success" role="status">{message}</div>}
    {error && <div className="form-alert error" role="alert">{error}</div>}

    {orders.length === 0 && !error && (
      <div className="empty-state"><h3>No orders yet</h3><p>Once you check out, your orders will show up here.</p><Link className="gradient-btn" to="/shop">Start shopping</Link></div>
    )}
    {orders.length > 0 && filtered.length === 0 && <div className="empty-state"><h3>No matching orders</h3></div>}

    {shown.length > 0 && (
      <div className="orders-list">
        {shown.map((o) => {
          const remaining = paidCancelRemaining(o, now);
          const items = o.items || [];
          return (
            <div className="order-row" key={o.id}>
              <div className="order-row-main">
                <Link to={`/orders/${o.id}`}><b>{o.orderNumber}</b></Link>
                <small>{formatDate(o.createdAt)}</small>
                <span>{items[0]?.name || "Order"}{items.length > 1 ? ` + ${items.length - 1} more` : ""}</span>
              </div>
              <div className="order-row-meta">
                <strong>{money(o.totalAmount)}</strong>
                <span className={`status ${isAwaitingPayment(o) ? "pending" : (o.orderStatus || "").toLowerCase()}`}>{buyerStatus(o)}</span>
              </div>
              <div className="order-row-actions">
                {isAwaitingPayment(o) && <Link className="gradient-btn" to={`/payment/${o.id}`}>Pay now</Link>}
                {remaining > 0 && <small>Cancel within {countdown(remaining)}</small>}
                {canCancel(o, now) && <button type="button" className="outline-btn" disabled={busyId === o.id} onClick={() => cancel(o)}>{busyId === o.id ? "Cancelling…" : "Cancel"}</button>}
                <Link className="text-btn" to={`/orders/${o.id}`}>Details</Link>
              </div>
            </div>
          );
        })}
      </div>
    )}
    {filtered.length > PER_PAGE && <Pagination page={currentPage} setPage={setPage} total={filtered.length} perPage={PER_PAGE} />}

    <div className="verified-box"><b>🔒 Protected payment &amp; delivery</b><p>Ikiguzi holds your payment until you confirm delivery with your code. You can cancel within 30 minutes of paying, before the seller ships. Unpaid orders are cancelled automatically after 30 minutes.</p></div>
    <Link className="gradient-btn" to="/shop">Continue shopping</Link>
  </main></Storefront>;
}
