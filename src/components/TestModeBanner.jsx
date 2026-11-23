import { useLoader } from '../lib/useLoader';
import { paymentsApi } from '../API/payments';

/** Shared with the Payment page: true while the server simulates payments. */
export function usePaymentTestMode() {
  const { data } = useLoader(['payments', 'mode'], () => paymentsApi.getMode().catch(() => null));
  return Boolean(data?.testMode);
}

/**
 * While no payment gateway is connected the server simulates payments
 * (TEST_PAYMENTS on the backend). Say so on every shop page, so nobody
 * mistakes a test order for a real purchase.
 */
export default function TestModeBanner() {
  if (!usePaymentTestMode()) return null;
  return <div className="site-test-banner" role="note">
    <b>Test mode</b> Ikiguzi is being tested. Payments are simulated: no money is taken and orders are not delivered.
  </div>;
}
