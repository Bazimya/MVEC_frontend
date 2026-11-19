import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { geoApi, rememberPin } from "../API/geo";

const ASK_FOR = {
  buyer: "so riders find your door and checkout starts with your pin",
  vendor: "so Ikiguzi riders can collect your parcels at your store",
  supplier: "so Ikiguzi riders can collect your parcels at your store",
  delivery: "so you get parcels near you",
};
const askedKey = (id) => `ikiguzi.locationAsked.${id}`;

const wasAsked = (id) => { try { return Boolean(localStorage.getItem(askedKey(id))); } catch { return true; } };
const markAsked = (id) => { try { localStorage.setItem(askedKey(id), new Date().toISOString()); } catch { /* private mode */ } };

/**
 * Once per account on this browser, after sign-in: share your location? A yes
 * pins it wherever the account has no pin yet (`POST /api/geo/me`); a pin the
 * person placed is never moved. Admins and affiliates aren't asked.
 */
export default function LocationPrompt() {
  const { user } = useAuth();
  const id = user?.id || user?._id;
  const why = ASK_FOR[user?.role];
  const [open, setOpen] = useState(false);
  const [state, setState] = useState({ busy: false, text: "", ok: false });

  useEffect(() => {
    setOpen(Boolean(id && why && typeof navigator !== "undefined" && navigator.geolocation && !wasAsked(id)));
    setState({ busy: false, text: "", ok: false });
  }, [id, why]);

  if (!open) return null;
  const close = () => { markAsked(id); setOpen(false); };
  const share = () => {
    setState({ busy: true, text: "Finding you…", ok: false });
    navigator.geolocation.getCurrentPosition(async (p) => {
      const pin = { lat: Math.round(p.coords.latitude * 1e6) / 1e6, lng: Math.round(p.coords.longitude * 1e6) / 1e6 };
      rememberPin(pin);
      markAsked(id);
      try {
        const res = await geoApi.saveMine(pin);
        setState({ busy: false, text: res.message, ok: true });
      } catch {
        setState({ busy: false, text: "Location saved on this device. Checkout will start from it.", ok: true });
      }
      setTimeout(() => setOpen(false), 4000);
    }, () => {
      markAsked(id);
      setState({ busy: false, text: "Location wasn't shared. You can pin it on the map any time.", ok: false });
      setTimeout(() => setOpen(false), 4000);
    }, { enableHighAccuracy: true, timeout: 15000 });
  };

  return (
    <div className="location-prompt" role="dialog" aria-live="polite" aria-label="Share your location">
      <div>
        <b>Share your location?</b>
        <p>{state.text || `Ikiguzi pins it on the map ${why}. You can move the pin any time.`}</p>
      </div>
      {!state.ok && !state.text.startsWith("Location wasn't") && (
        <div className="location-prompt-actions">
          <button type="button" className="outline-btn compact-btn" onClick={close} disabled={state.busy}>Not now</button>
          <button type="button" className="gradient-btn compact-btn" onClick={share} disabled={state.busy}>{state.busy ? "Finding you…" : "Share location"}</button>
        </div>
      )}
    </div>
  );
}
