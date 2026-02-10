'use client';

import { clientFetch } from '@/shared/api/client/apiClient.client';
import { withRetry } from '@/shared/api/client/retry';
import { mapOrderDTO, type OrderDTO } from '@/shared/api/mapping/dto';
import type { Order } from '@/entities/order';
import type { GetOrdersParams } from '../types';

interface OrdersListDTO {
  items: OrderDTO[];
  total: number;
  page: number;
  limit: number;
}

/** Fetch paginated orders from the backend (browser-side) */
export async function fetchOrders(
  params: GetOrdersParams = {},
): Promise<{ items: Order[]; total: number; page: number; limit: number }> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.status) searchParams.set('status', params.status);

  const query = searchParams.toString();
  const path = `/orders${query ? `?${query}` : ''}`;

  // TODO: Replace with actual backend endpoint
  const data = await withRetry(() =>
    clientFetch<OrdersListDTO>(path),
  );

  return {
    ...data,
    items: data.items.map(mapOrderDTO),
  };
}
