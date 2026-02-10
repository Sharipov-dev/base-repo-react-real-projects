'use client';

import { useOrdersQuery } from '../model/useOrdersQuery';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export function OrdersTable() {
  const { data, isLoading, error } = useOrdersQuery();

  if (isLoading) {
    return <div className="text-gray-500">Loading orders…</div>;
  }

  if (error) {
    return (
      <div className="text-red-600">
        Failed to load orders: {error.message}
      </div>
    );
  }

  if (!data?.items.length) {
    return <div className="text-gray-500">No orders found.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Title
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Status
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
              Price
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
              Created
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.items.map((order) => (
            <tr key={order.id}>
              <td className="px-4 py-3 text-sm text-gray-900">
                {order.title}
              </td>
              <td className="px-4 py-3 text-sm">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    statusColors[order.status] ?? 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {order.status}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 text-right">
                {order.totalPrice.toFixed(2)} {order.currency}
              </td>
              <td className="px-4 py-3 text-sm text-gray-500">
                {new Date(order.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
