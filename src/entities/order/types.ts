export type OrderStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface Order {
  id: string;
  title: string;
  status: OrderStatus;
  totalPrice: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}
