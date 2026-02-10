'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchOrders } from '../api/orders.client';
import type { GetOrdersParams } from '../types';

const ORDERS_QUERY_KEY = 'orders';

export function useOrdersQuery(params: GetOrdersParams = {}) {
  return useQuery({
    queryKey: [ORDERS_QUERY_KEY, params],
    queryFn: () => fetchOrders(params),
  });
}
