import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderEventEntity } from '../entities/order-event.entity';
import { OrderEventType } from '../enums/order-event-type.enum';
import { OrderStatus } from '../enums/order-status.enum';

export interface CreateOrderEventDto {
  orderId: string;
  eventType: OrderEventType;
  payload: Record<string, any>;
  actorId?: string;
}

/**
 * Maps each OrderEventType to the OrderStatus it represents, so that
 * replaying the event log always produces the correct current state.
 */
const EVENT_TO_STATUS: Record<OrderEventType, OrderStatus> = {
  [OrderEventType.ORDER_CREATED]: OrderStatus.PENDING,
  [OrderEventType.ORDER_CONFIRMED]: OrderStatus.CONFIRMED,
  [OrderEventType.ORDER_DISPATCHED]: OrderStatus.DISPATCHED,
  [OrderEventType.ORDER_IN_TRANSIT]: OrderStatus.IN_TRANSIT,
  [OrderEventType.ORDER_DELIVERED]: OrderStatus.DELIVERED,
  [OrderEventType.ORDER_CANCELLED]: OrderStatus.CANCELLED,
};

@Injectable()
export class OrderEventStoreService {
  constructor(
    @InjectRepository(OrderEventEntity)
    private readonly eventRepo: Repository<OrderEventEntity>,
  ) {}

  /**
   * Appends a new immutable event row to the order_events table.
   */
  async persistEvent(dto: CreateOrderEventDto): Promise<OrderEventEntity> {
    const entity = this.eventRepo.create({
      orderId: dto.orderId,
      eventType: dto.eventType,
      payload: dto.payload,
      actorId: dto.actorId ?? null,
    });
    return this.eventRepo.save(entity);
  }

  /**
   * Returns the full, chronologically-ordered event log for an order.
   * This is what the GET /orders/:id/history endpoint surfaces.
   */
  async getOrderHistory(orderId: string): Promise<OrderEventEntity[]> {
    return this.eventRepo.find({
      where: { orderId },
      order: { timestamp: 'ASC' },
    });
  }

  /**
   * Derives the current OrderStatus by replaying all persisted events
   * for the given order.  The status is always the one carried by the
   * most-recent event in the log.
   *
   * This guarantees that the state is fully derivable from the event store
   * alone, independent of any mutable status column on the orders table.
   */
  async replayOrderState(orderId: string): Promise<OrderStatus> {
    const events = await this.getOrderHistory(orderId);

    if (events.length === 0) {
      throw new NotFoundException(
        `No events found for order '${orderId}'. Cannot replay state.`,
      );
    }

    const lastEventType = events[events.length - 1].eventType as OrderEventType;
    const status = EVENT_TO_STATUS[lastEventType];

    if (!status) {
      throw new Error(
        `Cannot map event type '${lastEventType}' to an OrderStatus.`,
      );
    }

    return status;
  }
}
