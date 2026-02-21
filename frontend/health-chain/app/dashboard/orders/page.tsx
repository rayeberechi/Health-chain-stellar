"use client";

// OrdersPage - Main page component for Hospital Order History Dashboard

import React, { useState, useEffect, useCallback, useRef } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import {
  Order,
  OrderFilters,
  SortConfig,
  PaginationConfig,
  OrdersResponse,
} from "@/lib/types/orders";
import { URLStateManager } from "@/lib/utils/url-state-manager";
import { WebSocketClient, ConnectionStatus } from "@/lib/utils/websocket-client";
import { CSVExporter } from "@/lib/utils/csv-exporter";
import { FilterPanel } from "@/components/orders/FilterPanel";
import { OrderTable } from "@/components/orders/OrderTable";
import { PaginationController } from "@/components/orders/PaginationController";
import { ConnectionStatusIndicator } from "@/components/orders/ConnectionStatusIndicator";

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<OrderFilters>({
    startDate: null,
    endDate: null,
    bloodTypes: [],
    statuses: [],
    bloodBank: "",
  });
  const [sort, setSort] = useState<SortConfig>({
    column: "placedAt",
    order: "desc",
  });
  const [pagination, setPagination] = useState<PaginationConfig>({
    page: 1,
    pageSize: 25,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [wsStatus, setWsStatus] = useState<ConnectionStatus>("disconnected");

  const wsClientRef = useRef<WebSocketClient | null>(null);

  // Track whether we are currently in a reconnecting/disconnected state
  // so StatusBadge can show stale styling
  const isStale = wsStatus === "reconnecting" || wsStatus === "disconnected";

  useEffect(() => {
    const urlState = URLStateManager.readFromURL();
    setFilters(urlState.filters);
    setSort(urlState.sort);
    setPagination({
      page: urlState.pagination.page,
      pageSize: urlState.pagination.pageSize,
    });
  }, []);

  const fetchOrders = useCallback(
    async (silent = false) => {
      try {
        if (!silent) {
          setLoading(true);
        }
        setError(null);

        const params = new URLSearchParams();
        params.set("hospitalId", "HOSP-001");

        if (filters.startDate) {
          params.set("startDate", filters.startDate.toISOString().split("T")[0]);
        }
        if (filters.endDate) {
          params.set("endDate", filters.endDate.toISOString().split("T")[0]);
        }
        if (filters.bloodTypes.length > 0) {
          filters.bloodTypes.forEach((bt) => params.append("bloodType", bt));
        }
        if (filters.statuses.length > 0) {
          filters.statuses.forEach((s) => params.append("status", s));
        }
        if (filters.bloodBank) {
          params.set("bloodBank", filters.bloodBank);
        }

        params.set("sortBy", sort.column);
        params.set("sortOrder", sort.order);
        params.set("page", pagination.page.toString());
        params.set("pageSize", pagination.pageSize.toString());

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
        const apiPrefix = process.env.NEXT_PUBLIC_API_PREFIX || "api/v1";
        const response = await fetch(
          `${apiUrl}/${apiPrefix}/orders?${params.toString()}`,
        );

        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}`);
        }

        const data: OrdersResponse = await response.json();

        const ordersWithDates = data.orders.map((order) => ({
          ...order,
          placedAt: new Date(order.placedAt),
          deliveredAt: order.deliveredAt ? new Date(order.deliveredAt) : null,
          confirmedAt: order.confirmedAt ? new Date(order.confirmedAt) : null,
          cancelledAt: order.cancelledAt ? new Date(order.cancelledAt) : null,
          createdAt: new Date(order.createdAt),
          updatedAt: new Date(order.updatedAt),
        }));

        setOrders(ordersWithDates);
        setTotalCount(data.pagination.totalCount);
      } catch (err) {
        console.error("Error fetching orders:", err);
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    },
    [filters, sort, pagination],
  );

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // WebSocket setup
  useEffect(() => {
    const hospitalId = "HOSP-001";
    const wsClient = new WebSocketClient(hospitalId);
    wsClientRef.current = wsClient;

    wsClient.onConnectionChange((status) => {
      setWsStatus(status);
    });

    // After a successful reconnect, silently re-fetch to reconcile
    // React Query cache / local state with the current server state
    wsClient.onReconnected(() => {
      console.log("WebSocket reconnected — reconciling order data via REST");
      fetchOrders(true);
    });

    wsClient.onOrderUpdate((updatedOrder) => {
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order.id === updatedOrder.id
            ? {
                ...order,
                ...updatedOrder,
                updatedAt: updatedOrder.updatedAt
                  ? new Date(updatedOrder.updatedAt as unknown as string)
                  : order.updatedAt,
                deliveredAt: updatedOrder.deliveredAt
                  ? new Date(updatedOrder.deliveredAt as unknown as string)
                  : order.deliveredAt,
              }
            : order,
        ),
      );
    });

    wsClient.connect().catch((err) => {
      console.error("WebSocket connection failed:", err);
    });

    return () => {
      wsClient.disconnect();
    };
    // fetchOrders intentionally excluded — we only want this to run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFiltersChange = useCallback(
    (newFilters: OrderFilters) => {
      setFilters(newFilters);
      URLStateManager.updateURL(newFilters, sort, pagination);
    },
    [sort, pagination],
  );

  const handleClearFilters = useCallback(() => {
    const cleared: OrderFilters = {
      startDate: null,
      endDate: null,
      bloodTypes: [],
      statuses: [],
      bloodBank: "",
    };
    setFilters(cleared);
    URLStateManager.updateURL(cleared, sort, pagination);
  }, [sort, pagination]);

  const handleSortChange = useCallback(
    (column: string) => {
      const newSort: SortConfig = {
        column,
        order: sort.column === column && sort.order === "asc" ? "desc" : "asc",
      };
      setSort(newSort);
      URLStateManager.updateURL(filters, newSort, pagination);
    },
    [filters, sort, pagination],
  );

  const handlePageChange = useCallback(
    (page: number) => {
      setPagination((prev) => ({ ...prev, page }));
      URLStateManager.updateURL(filters, sort, { ...pagination, page });
    },
    [filters, sort, pagination],
  );

  const handlePageSizeChange = useCallback(
    (pageSize: number) => {
      setPagination({ page: 1, pageSize: pageSize as 25 | 50 | 100 });
      URLStateManager.updateURL(filters, sort, {
        page: 1,
        pageSize: pageSize as 25 | 50 | 100,
      });
    },
    [filters, sort],
  );

  const handleExport = useCallback(() => {
    CSVExporter.export(orders);
  }, [orders]);

  const handleRetry = useCallback(() => {
    fetchOrders();
  }, [fetchOrders]);

  return (
    <div className="max-w-[1600px] mx-auto">
      {/* Page Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Order History</h1>
          <p className="text-gray-600 mt-2">
            View and manage your hospital&apos;s blood order history
          </p>
        </div>
        {/* Connection status indicator — always visible in the header */}
        <div className="pt-1">
          <ConnectionStatusIndicator status={wsStatus} />
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 font-medium">Error loading orders</p>
              <p className="text-red-700 text-sm mt-1">{error}</p>
            </div>
            <button
              onClick={handleRetry}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
            >
              <RefreshCw size={14} />
              Retry
            </button>
          </div>
        </div>
      )}

      <FilterPanel
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClearFilters={handleClearFilters}
        onExport={handleExport}
      />

      {/* Pass isStale down to OrderTable so StatusBadge can dim during reconnect */}
      <OrderTable
        orders={orders}
        sort={sort}
        onSortChange={handleSortChange}
        loading={loading}
        emptyMessage="No orders found"
        onClearFilters={handleClearFilters}
        isStale={isStale}
      />

      {!loading && orders.length > 0 && (
        <PaginationController
          currentPage={pagination.page}
          totalCount={totalCount}
          pageSize={pagination.pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      )}
    </div>
  );
}
