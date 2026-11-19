import { useEffect, useState } from "react";
import { autoPayoutsApi } from "../API/autoPayouts";
import { extractErrorMessage } from "../API/client";
import { money } from "../utils/format";

/**
 * "Send my money automatically": after each delivery the server splits the
 * sale (Ikiguzi's commission and any affiliate's share are set aside) and
 * sends what is yours to this mobile money number, without a request.
 */
export default function AutoPayoutCard({ defaultName = "", defaultPhone = "", onSaved }) {
  const [setting, setSetting] = useState(null);
  const [form, setForm] = useState({ auto: false, phone: defaultPhone, accountName: defaultName });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let alive = true;
    autoPayoutsApi.get().then((s) => {
      if (!alive) return;
      setSetting(s);
      setForm({ auto: s.auto, phone: s.phone || defaultPhone, accountName: s.accountName || defaultName });
    }).catch((err) => alive && setNotice({ ok: false, text: extractErrorMessage(err) }));
    return () => { alive = false; };
  }, [defaultName, defaultPhone]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setNotice(null);
    try {
      const res = await autoPayoutsApi.save(form);
      setSetting(res.setting);
      setNotice({ ok: true, text: res.message });
      onSaved?.();
    } catch (err) { setNotice({ ok: false, text: extractErrorMessage(err) }); }
    finally { setBusy(false); }
  };

  return (
    <form className="data-card auto-payout" onSubmit={save}>
      <div className="data-card-head"><div>
        <h3>Get paid automatically</h3>
        <span>When a buyer receives an order, Ikiguzi takes its commission (and any affiliate's share) and sends the rest to your mobile money{setting ? `, from ${money(setting.minimum)}` : ""}. No withdrawal request needed.</span>
      </div></div>
      {notice && <div className={notice.ok ? "form-alert success" : "form-error"}>{notice.text}</div>}
      <label className="filter-check"><input type="checkbox" checked={form.auto} onChange={(e) => setForm({ ...form, auto: e.target.checked })} /> Send my money automatically</label>
      <div className="two-col">
        <label className="field"><span>Mobile money number</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="078 / 079 (MTN) or 072 / 073 (Airtel)" inputMode="tel" /></label>
        <label className="field"><span>Name on the account</span><input value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} /></label>
      </div>
      {setting?.lastError && <p className="tiny form-error">Last attempt failed: {setting.lastError}. We'll try again shortly.</p>}
      {setting?.lastSentAt && !setting.lastError && <p className="tiny">Last sent {new Date(setting.lastSentAt).toLocaleString("en-GB")}.</p>}
      <div className="row-actions"><button type="submit" className="gradient-btn" disabled={busy}>{busy ? "Saving…" : "Save"}</button></div>
    </form>
  );
}
