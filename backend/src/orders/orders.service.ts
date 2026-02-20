import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  OrderConfirmedEvent,
  OrderCancelledEvent,
  OrderStatusUpdatedEvent,
  OrderRiderAssignedEvent,
} from '../events';

@Injectable()
export class OrdersService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async findAll(status?: string, hospitalId?: string) {
    // TODO: Implement find all orders logic
    return {
      message: 'Orders retrieved successfully',
      data: [],
    };
  }

  async findAllWithFilters(params: OrderQueryParamsDto): Promise<OrdersResponseDto> {
    const {
      hospitalId,
      startDate,
      endDate,
      bloodTypes,
      statuses,
      bloodBank,
      sortBy = 'placedAt',
      sortOrder = 'desc',
      page = 1,
      pageSize = 25,
    } = params;

    // Start with all orders for the hospital
    let filteredOrders = this.orders.filter(
      (order) => order.hospital.id === hospitalId
    );

    // Apply date range filter
    if (startDate) {
      const start = new Date(startDate);
      filteredOrders = filteredOrders.filter(
        (order) => new Date(order.placedAt) >= start
      );
    }

    if (endDate) {
      const end = new Date(endDate);
      filteredOrders = filteredOrders.filter(
        (order) => new Date(order.placedAt) <= end
      );
    }

    // Apply blood type filter
    if (bloodTypes) {
      const bloodTypeArray = bloodTypes.split(',') as BloodType[];
      filteredOrders = filteredOrders.filter((order) =>
        bloodTypeArray.includes(order.bloodType)
      );
    }

    // Apply status filter
    if (statuses) {
      const statusArray = statuses.split(',') as OrderStatus[];
      filteredOrders = filteredOrders.filter((order) =>
        statusArray.includes(order.status)
      );
    }

    // Apply blood bank name filter (case-insensitive partial match)
    if (bloodBank) {
      const searchTerm = bloodBank.toLowerCase();
      filteredOrders = filteredOrders.filter((order) =>
        order.bloodBank.name.toLowerCase().includes(searchTerm)
      );
    }

    // Sort orders with active orders prioritization
    const activeStatuses: OrderStatus[] = ['pending', 'confirmed', 'in_transit'];
    filteredOrders.sort((a, b) => {
      // First, prioritize active orders
      const aIsActive = activeStatuses.includes(a.status);
      const bIsActive = activeStatuses.includes(b.status);

      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;

      // Then apply column sorting
      const aValue = this.getSortValue(a, sortBy);
      const bValue = this.getSortValue(b, sortBy);

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    // Calculate pagination
    const totalCount = filteredOrders.length;
    const totalPages = Math.ceil(totalCount / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    // Get paginated results
    const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

    return {
      data: paginatedOrders,
      pagination: {
        currentPage: page,
        pageSize,
        totalCount,
        totalPages,
      },
    };
  }

  private getSortValue(order: Order, sortBy: string): any {
    switch (sortBy) {
      case 'id':
        return order.id;
      case 'bloodType':
        return order.bloodType;
      case 'quantity':
        return order.quantity;
      case 'bloodBank':
        return order.bloodBank.name;
      case 'status':
        return order.status;
      case 'rider':
        return order.rider?.name || '';
      case 'placedAt':
        return new Date(order.placedAt).getTime();
      case 'deliveredAt':
        return order.deliveredAt ? new Date(order.deliveredAt).getTime() : 0;
      default:
        return new Date(order.placedAt).getTime();
    }
  }

  async findOne(id: string) {
    // TODO: Implement find order by id logic
    return {
      message: 'Order retrieved successfully',
      data: { id },
    };
  }

  async create(createOrderDto: any) {
    // TODO: Implement create order logic
    const order = {
      id: `order-${Date.now()}`,
      ...createOrderDto,
      status: 'confirmed',
    };

    // Emit order confirmed event
    this.eventEmitter.emit(
      'order.confirmed',
      new OrderConfirmedEvent(
        order.id,
        order.hospitalId,
        order.bloodType,
        order.quantity,
        order.deliveryAddress,
      ),
    );

    return {
      message: 'Order created successfully',
      data: order,
    };
  }

  async update(id: string, updateOrderDto: any) {
    // TODO: Implement update order logic
    return {
      message: 'Order updated successfully',
      data: { id, ...updateOrderDto },
    };
  }

  async remove(id: string) {
    // TODO: Implement delete order logic
    const reason = 'Order cancelled by user';

    // Emit order cancelled event
    this.eventEmitter.emit(
      'order.cancelled',
      new OrderCancelledEvent(id, 'hospital-id', reason),
    );

    return {
      message: 'Order deleted successfully',
      data: { id },
    };
  }

  async updateStatus(id: string, status: string) {
    // TODO: Implement update order status logic
    const previousStatus = 'pending'; // In real implementation, fetch from DB

    // Emit status updated event
    this.eventEmitter.emit(
      'order.status.updated',
      new OrderStatusUpdatedEvent(id, previousStatus, status),
    );

    return {
      message: 'Order status updated successfully',
      data: { id, status },
    };
  }

  async assignRider(orderId: string, riderId: string) {
    // TODO: Implement assign rider to order logic

    // Emit rider assigned event
    this.eventEmitter.emit(
      'order.rider.assigned',
      new OrderRiderAssignedEvent(orderId, riderId),
    );

    return {
      message: 'Rider assigned successfully',
      data: { orderId, riderId },
    };
  }

  async trackOrder(id: string) {
    // TODO: Implement track order logic
    return {
      message: 'Order tracking information retrieved successfully',
      data: { id, status: 'pending', location: null },
    };
  }
}
