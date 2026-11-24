import { client } from "./client";

const data = (r) => r.data;

/** "Advertise here": home banner time bought per second and paid by mobile money. The server prices every ad. */
export const adBookingsApi = {
  // { basePrice, baseSeconds, extraSecondPrice, maxSeconds, days, ladder, titleMax, descriptionMax }
  pricing: () => client.get("/ad-bookings/pricing").then(data),
  // The server's answer for a number of seconds or an amount: { seconds, amount, days }. 400 if it is not a price on the ladder.
  quote: (params) => client.get("/ad-bookings/quote", { params }).then(data),
  // { methods: [{ id: "MOMO" | "AIRTEL", provider, label, numbers, available, testMode }] }
  paymentMethods: () => client.get("/ad-bookings/payment-methods").then((r) => r.data.methods || []),
  mine: () => client.get("/ad-bookings/mine").then(data),
  // { productId, title, description, seconds, paymentMethod, phoneNumber } -> { message, booking, paymentId, status }
  book: (payload) => client.post("/ad-bookings", payload).then(data),
  cancel: (id) => client.post(`/ad-bookings/${id}/cancel`).then(data),
  forAdmin: (status) => client.get("/ad-bookings/admin", { params: status ? { status } : {} }).then((r) => r.data.bookings || []),
  approve: (id) => client.post(`/ad-bookings/${id}/approve`).then(data),
  reject: (id, reason) => client.post(`/ad-bookings/${id}/reject`, { reason }).then(data),
  deactivate: (id) => client.post(`/ad-bookings/${id}/deactivate`).then(data),
  reactivate: (id) => client.post(`/ad-bookings/${id}/reactivate`).then(data),
  remove: (id, reason) => client.post(`/ad-bookings/${id}/remove`, { reason }).then(data),
};
