import { useQuery } from '@tanstack/react-query';
import { productsApi } from '../API/products';
import { suppliersApi } from '../API/suppliers';

/** The seller's products that can be advertised: on sale and in stock. Suppliers advertise the marketplace listings of their wholesale products. */
export function useAdProducts(user) {
  return useQuery({
    queryKey: ['ad-products', user?.id],
    enabled: Boolean(user),
    queryFn: () => (user.role === 'supplier'
      ? suppliersApi.getMyProducts().then((r) => (r.products || []).map((w) => w.retailProduct).filter((p) => p && typeof p === 'object').map((p) => ({ ...p, id: p.id || p._id })))
      : productsApi.getVendorProducts().then((r) => r.products || []))
      .then((list) => list.filter((p) => p.status === 'ACTIVE' && p.stockQuantity > 0)),
  });
}
