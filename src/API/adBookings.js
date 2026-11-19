import { client } from "./client";

const data = (r) => r.data;

/** "Advertise here": flat-fee home page ad spots, paid by mobile money. */
export const adBookingsApi = {
  pricing: () => client.get("/ad-bookings/pricing").then(data),
  mine: () => client.get("/ad-bookings/mine").then(data),
  // { productIds, phoneNumber } -> { message, booking, paymentId, status }
  book: (productIds, phoneNumber) => client.post("/ad-bookings", { productIds, phoneNumber }).then(data),
  forAdmin: (status) => client.get("/ad-bookings/admin", { params: status ? { status } : {} }).then((r) => r.data.bookings || []),
  approve: (id) => client.post(`/ad-bookings/${id}/approve`).then(data),
  reject: (id, reason) => client.post(`/ad-bookings/${id}/reject`, { reason }).then(data),
};
