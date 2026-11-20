import { useEffect, useState } from "react";
import { client } from "../API/client";

// Whether guest checkout, "follow my order" and rider sign-up ask for a text
// code (GET /api/auth/phone-codes). Off until SMS is set up on the server.
let asked = null;
export function phoneCodesRequired() {
  asked ||= client.get("/auth/phone-codes").then((r) => Boolean(r.data?.required)).catch(() => true);
  return asked;
}

/** null while unknown, then true or false. */
export function usePhoneCodes() {
  const [required, setRequired] = useState(null);
  useEffect(() => {
    let live = true;
    phoneCodesRequired().then((v) => { if (live) setRequired(v); });
    return () => { live = false; };
  }, []);
  return required;
}
