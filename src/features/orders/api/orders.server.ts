import 'server-only';

import { serverFetch } from '@/shared/api/client/apiClient.server';
import { mapOrderDTO, type OrderDTO } from '@/shared/api/mapping/dto';
import type { Order } from '@/entities/order';

interface OrdersListDTO {
  items: OrderDTO[];
  total: number;
  page: number;
  limit: number;
}

/** Fetch orders from the backend (server-side, forwards auth headers) */
export async function fetchOrdersServer(): Promise<{
  items: Order[];
  total: number;
}> {
  // TODO: Replace with actual backend endpoint
  const data = await serverFetch<OrdersListDTO>('/orders', {
    forwardAuth: true,
    forwardCookies: true,
  });

  return {
    total: data.total,
    items: data.items.map(mapOrderDTO),
  };
}
