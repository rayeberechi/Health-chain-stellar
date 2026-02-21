// OrderTable - Displays orders in a sortable table with status badges

import React from "react";
import { ArrowUp, ArrowDown, Package } from "lucide-react";
import { Order, SortConfig } from "@/lib/types/orders";
import { StatusBadge } from "./StatusBadge";
import { format } from "date-fns";

interface OrderTableProps {
  orders: Order[];
  sort: SortConfig;
  onSortChange: (column: string) => void;
  loading: boolean;
  emptyMessage?: string;
  onClearFilters?: () => void;
  isStale?: boolean;
}

export const OrderTable: React.FC<OrderTableProps> = ({
  orders,
  sort,
  onSortChange,
  loading,
  emptyMessage = "No orders found",
  onClearFilters,
  isStale = false,
}) => {
  const columns = [
    { key: "id", label: "Order ID", sortable: true },
    { key: "bloodType", label: "Blood Type", sortable: true },
    { key: "quantity", label: "Quantity", sortable: true },
    { key: "bloodBank", label: "Blood Bank", sortable: true },
    { key: "status", label: "Status", sortable: true },
    { key: "rider", label: "Rider", sortable: false },
    { key: "placedAt", label: "Placed At", sortable: true },
    { key: "deliveredAt", label: "Delivered At", sortable: true },
  ];

  const handleHeaderClick = (columnKey: string, sortable: boolean) => {
    if (sortable) {
      onSortChange(columnKey);
    }
  };

  const isActiveOrder = (status: string) =>
    ["pending", "confirmed", "in_transit"].includes(status);

  const formatDate = (date: Date | null) => {
    if (!date) return "-";
    try {
      return format(new Date(date), "MMM dd, yyyy HH:mm");
    } catch {
      return "-";
    }
  };

  const renderSortIndicator = (columnKey: string) => {
    if (sort.column !== columnKey) {
      return <ArrowUp size={14} className="text-gray-300" />;
    }
    return sort.order === "asc" ? (
      <ArrowUp size={14} className="text-blue-500" />
    ) : (
      <ArrowDown size={14} className="text-blue-500" />
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-6 py-4">
                      <div className="h-4 bg-gray-200 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center mb-4">
        <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500 text-lg">{emptyMessage}</p>
        {onClearFilters && (
          <button
            onClick={onClearFilters}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  onClick={() => handleHeaderClick(column.key, column.sortable)}
                  className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    column.sortable ? "cursor-pointer hover:bg-gray-100" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{column.label}</span>
                    {column.sortable && renderSortIndicator(column.key)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {orders.map((order) => (
              <tr
                key={order.id}
                className={`${
                  isActiveOrder(order.status)
                    ? "bg-blue-50 hover:bg-blue-100"
                    : "hover:bg-gray-50"
                } transition-colors`}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {order.id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <span className="font-semibold">{order.bloodType}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {order.quantity} {order.quantity === 1 ? "unit" : "units"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {order.bloodBank.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {/* isStale dims the badge without clearing state */}
                  <StatusBadge status={order.status} size="sm" isStale={isStale} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {order.rider ? order.rider.name : "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(order.placedAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {formatDate(order.deliveredAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
