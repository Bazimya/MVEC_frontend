import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { riderApi } from "../API/rider";
import { ordersApi } from "../API/orders";
import { extractErrorMessage } from "../API/client";
import LiveMap from "./LiveMap";
import { parcelPoints, minutesLeft, kmLeft, kigaliTime as time } from "../utils/liveTracking";

const VEHICLE = { MOTORBIKE: "Motorbike", BICYCLE: "Bicycle", CAR: "Car", ON_FOOT: "On foot" };
function Parcel({ p, viewer }) {
  const loc = p.rider.location;
  return (
    <div className="data-card live-track">
      <div className="live-track-head">
        <div>
          <h3>{viewer === "seller" && p.phase === "to_store" ? "A rider is coming for your parcel" : p.phaseLabel}</h3>
          <p className="tiny">From {p.store.name}{viewer === "buyer" && p.phase === "to_store" ? ". The rider is collecting it now." : ""}</p>
        </div>
        {p.route && <div className="live-track-eta">
          <b>{minutesLeft(p.route.durationS)} min</b>
          <small className="tiny">{kmLeft(p.route.distanceM)} · about {time(p.route.etaAt)}</small>
        </div>}
      </div>
      <div className="live-track-rider">
        <span><b>{p.rider.name}</b> · {VEHICLE[p.rider.vehicleType] || "Rider"}{p.rider.plateNumber ? ` · ${p.rider.plateNumber}` : ""}</span>
        {p.rider.phone && <a className="outline-btn compact-btn" href={`tel:${p.rider.phone}`}>Call the rider</a>}
      </div>
      {!loc && <p className="tiny">Waiting for the rider's location.</p>}
      {loc?.stale && <p className="tiny">Last seen at {time(loc.at)}.</p>}
      <LiveMap points={parcelPoints(p)} route={p.route?.geometry} height={280} />
    </div>
  );
}

const minutesSince = (at) => (at ? Math.max(0, Math.round((Date.now() - new Date(at).getTime()) / 60000)) : 0);

/** A parcel no rider took yet. The seller may deliver it instead. */
function Waiting({ p, viewer, orderId, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const waited = minutesSince(p.offeredAt);
  const takeOver = async () => {
    if (!window.confirm("Deliver this parcel yourself? Ikiguzi stops looking for a rider, the delivery fee goes to you, and you confirm the hand-over with the buyer's 6-digit code.")) return;
    setBusy(true); setError("");
    try { await ordersApi.deliverMyself(orderId); onChanged?.(); } catch (err) { setError(extractErrorMessage(err)); } finally { setBusy(false); }
  };
  return (
    <div className="data-card live-track-waiting">
      <div>
        <h3>{viewer === "seller" ? "Looking for a rider" : p.statusLabel}</h3>
        <p className="tiny">
          {viewer === "seller"
            ? `Ikiguzi is offering the parcel from ${p.store.name} to riders near your store${waited ? ` (${waited} min so far)` : ""}. Riders who come online nearby get it too.`
            : `Ikiguzi is finding a rider for the parcel from ${p.store.name}.`}
        </p>
        {error && <div className="form-error">{error}</div>}
      </div>
      {viewer === "seller" && p.waitingForRider && <button type="button" className="outline-btn" disabled={busy} onClick={takeOver}>{busy ? "Saving…" : "Deliver it myself"}</button>}
    </div>
  );
}

/**
 * Where the Ikiguzi riders carrying this order's parcels are, refreshed every
 * few seconds while one is on the way. Shows nothing for parcels without a rider.
 * `viewer`: "buyer" (all parcels) or "seller" (only its own; the server filters).
 */
export default function LiveTracking({ orderId, viewer = "buyer", onChanged }) {
  const { data, refetch } = useQuery({
    queryKey: ["order-live", orderId],
    queryFn: () => riderApi.orderLive(orderId),
    enabled: Boolean(orderId),
    refetchInterval: (q) => ((q.state.data?.parcels || []).some((p) => p.active) ? (q.state.data.parcels.find((p) => p.active).refreshAfterS || 4) * 1000 : 30_000),
  });
  const parcels = data?.parcels || [];
  const waiting = parcels.filter((p) => !p.active && p.status === "READY_FOR_PICKUP");
  if (!parcels.some((p) => p.active) && !waiting.length) return null;
  return (
    <section className="live-track">
      {parcels.filter((p) => p.active).map((p) => <Parcel key={p.deliveryId} p={p} viewer={viewer} />)}
      {waiting.map((p) => <Waiting key={p.deliveryId} p={p} viewer={viewer} orderId={orderId} onChanged={() => { refetch(); onChanged?.(); }} />)}
    </section>
  );
}
