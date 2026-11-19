import { client } from "./client";

/** Automatic payouts (`/api/auto-payouts`): sellers, suppliers, riders and affiliates. */
export const autoPayoutsApi = {
  // -> { auto, method, phone, accountName, lastSentAt, lastError, minimum }
  get: () => client.get("/auto-payouts").then((r) => r.data),
  // { auto, phone, accountName } -> { message, setting }
  save: (payload) => client.put("/auto-payouts", payload).then((r) => r.data),
};
