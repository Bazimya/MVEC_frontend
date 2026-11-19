import { client } from "./client";

const data = (r) => r.data;
const LAST_PIN = "ikiguzi.lastPin";

/** Map helpers (`/api/geo`). */
export const geoApi = {
  // A typed street, sector or district → [{ label, lat, lng }] in Rwanda.
  search: (q) => client.get("/geo/search", { params: { q } }).then((r) => r.data.results || []),
  // The device's position at sign-in: fills the account's empty pins.
  saveMine: (pin) => client.post("/geo/me", pin).then(data),
};

/** The last position this browser shared, as a starting pin (guests too). */
export function lastPin() {
  try {
    const p = JSON.parse(localStorage.getItem(LAST_PIN) || "null");
    return p && Number.isFinite(p.lat) && Number.isFinite(p.lng) ? { lat: p.lat, lng: p.lng } : null;
  } catch {
    return null;
  }
}

export function rememberPin(pin) {
  try { localStorage.setItem(LAST_PIN, JSON.stringify({ lat: pin.lat, lng: pin.lng })); } catch { /* private mode */ }
}
