import type { Order } from '@/entities/order';

/** Params for fetching orders list */
export interface GetOrdersParams {
  page?: number;
  limit?: number;
  status?: Order['status'];
}

/** Backend response shape for paginated orders */
export interface OrdersListResponse {
  items: Order[];
  total: number;
  page: number;
  limit: number;
}
