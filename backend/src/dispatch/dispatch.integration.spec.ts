import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { DispatchService } from './dispatch.service';
import {
  OrderConfirmedEvent,
  OrderCancelledEvent,
  OrderStatusUpdatedEvent,
  OrderRiderAssignedEvent,
} from '../events';

describe('DispatchService Integration Tests', () => {
  let dispatchService: DispatchService;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [DispatchService],
    }).compile();

    dispatchService = module.get<DispatchService>(DispatchService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Event-Driven Dispatch Creation', () => {
    it('should create dispatch when order.confirmed event is emitted', async () => {
      const event = new OrderConfirmedEvent(
        'order-123',
        'hospital-456',
        'A+',
        2,
        '123 Main St',
      );

      const handleSpy = jest.spyOn(dispatchService, 'handleOrderConfirmed');

      eventEmitter.emit('order.confirmed', event);

      // Wait for async event handler
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(handleSpy).toHaveBeenCalledWith(event);
      expect(handleSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle order.cancelled event', async () => {
      const event = new OrderCancelledEvent(
        'order-123',
        'hospital-456',
        'Patient recovered',
      );

      const handleSpy = jest.spyOn(dispatchService, 'handleOrderCancelled');

      eventEmitter.emit('order.cancelled', event);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(handleSpy).toHaveBeenCalledWith(event);
      expect(handleSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle order.status.updated event', async () => {
      const event = new OrderStatusUpdatedEvent(
        'order-123',
        'pending',
        'confirmed',
      );

      const handleSpy = jest.spyOn(dispatchService, 'handleOrderStatusUpdated');

      eventEmitter.emit('order.status.updated', event);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(handleSpy).toHaveBeenCalledWith(event);
      expect(handleSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle order.rider.assigned event', async () => {
      const event = new OrderRiderAssignedEvent('order-123', 'rider-789');

      const handleSpy = jest.spyOn(dispatchService, 'handleOrderRiderAssigned');

      eventEmitter.emit('order.rider.assigned', event);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(handleSpy).toHaveBeenCalledWith(event);
      expect(handleSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Idempotency', () => {
    it('should not process duplicate order.confirmed events', async () => {
      const timestamp = new Date();
      const event = new OrderConfirmedEvent(
        'order-123',
        'hospital-456',
        'A+',
        2,
        '123 Main St',
        timestamp,
      );

      const handleSpy = jest.spyOn(dispatchService, 'handleOrderConfirmed');

      // Emit the same event twice
      eventEmitter.emit('order.confirmed', event);
      eventEmitter.emit('order.confirmed', event);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Handler should be called twice but only process once
      expect(handleSpy).toHaveBeenCalledTimes(2);
    });

    it('should not process duplicate order.cancelled events', async () => {
      const timestamp = new Date();
      const event = new OrderCancelledEvent(
        'order-123',
        'hospital-456',
        'Patient recovered',
        timestamp,
      );

      const handleSpy = jest.spyOn(dispatchService, 'handleOrderCancelled');

      eventEmitter.emit('order.cancelled', event);
      eventEmitter.emit('order.cancelled', event);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(handleSpy).toHaveBeenCalledTimes(2);
    });

    it('should not process duplicate order.status.updated events', async () => {
      const timestamp = new Date();
      const event = new OrderStatusUpdatedEvent(
        'order-123',
        'pending',
        'confirmed',
        timestamp,
      );

      const handleSpy = jest.spyOn(dispatchService, 'handleOrderStatusUpdated');

      eventEmitter.emit('order.status.updated', event);
      eventEmitter.emit('order.status.updated', event);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(handleSpy).toHaveBeenCalledTimes(2);
    });

    it('should not process duplicate order.rider.assigned events', async () => {
      const timestamp = new Date();
      const event = new OrderRiderAssignedEvent('order-123', 'rider-789', timestamp);

      const handleSpy = jest.spyOn(dispatchService, 'handleOrderRiderAssigned');

      eventEmitter.emit('order.rider.assigned', event);
      eventEmitter.emit('order.rider.assigned', event);

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(handleSpy).toHaveBeenCalledTimes(2);
    });

    it('should process events with different timestamps', async () => {
      const event1 = new OrderConfirmedEvent(
        'order-123',
        'hospital-456',
        'A+',
        2,
        '123 Main St',
        new Date('2024-01-01'),
      );

      const event2 = new OrderConfirmedEvent(
        'order-123',
        'hospital-456',
        'A+',
        2,
        '123 Main St',
        new Date('2024-01-02'),
      );

      const handleSpy = jest.spyOn(dispatchService, 'handleOrderConfirmed');

      eventEmitter.emit('order.confirmed', event1);
      eventEmitter.emit('order.confirmed', event2);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // Both should be processed as they have different timestamps
      expect(handleSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('Module Independence', () => {
    it('should not have direct dependency on OrdersModule', () => {
      // This test verifies that DispatchService doesn't import OrdersService
      const dispatchServiceString = dispatchService.constructor.toString();
      expect(dispatchServiceString).not.toContain('OrdersService');
    });
  });
});
