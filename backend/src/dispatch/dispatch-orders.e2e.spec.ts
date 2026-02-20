import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';
import { DispatchService } from './dispatch.service';
import { OrdersService } from '../orders/orders.service';

describe('Dispatch-Orders Event Integration (E2E)', () => {
  let dispatchService: DispatchService;
  let ordersService: OrdersService;
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot()],
      providers: [DispatchService, OrdersService],
    }).compile();

    dispatchService = module.get<DispatchService>(DispatchService);
    ordersService = module.get<OrdersService>(OrdersService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create dispatch when order is created', async () => {
    const dispatchSpy = jest.spyOn(dispatchService, 'handleOrderConfirmed');

    const createOrderDto = {
      hospitalId: 'hospital-123',
      bloodType: 'O-',
      quantity: 3,
      deliveryAddress: '456 Hospital Ave',
    };

    await ordersService.create(createOrderDto);

    // Wait for event propagation
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(dispatchSpy).toHaveBeenCalled();
    const callArgs = dispatchSpy.mock.calls[0][0];
    expect(callArgs.hospitalId).toBe('hospital-123');
    expect(callArgs.bloodType).toBe('O-');
    expect(callArgs.quantity).toBe(3);
  });

  it('should cancel dispatch when order is cancelled', async () => {
    const dispatchSpy = jest.spyOn(dispatchService, 'handleOrderCancelled');

    await ordersService.remove('order-123');

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(dispatchSpy).toHaveBeenCalled();
    const callArgs = dispatchSpy.mock.calls[0][0];
    expect(callArgs.orderId).toBe('order-123');
  });

  it('should update dispatch when order status changes', async () => {
    const dispatchSpy = jest.spyOn(dispatchService, 'handleOrderStatusUpdated');

    await ordersService.updateStatus('order-123', 'in-transit');

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(dispatchSpy).toHaveBeenCalled();
    const callArgs = dispatchSpy.mock.calls[0][0];
    expect(callArgs.orderId).toBe('order-123');
    expect(callArgs.newStatus).toBe('in-transit');
  });

  it('should assign rider to dispatch when rider is assigned to order', async () => {
    const dispatchSpy = jest.spyOn(dispatchService, 'handleOrderRiderAssigned');

    await ordersService.assignRider('order-123', 'rider-456');

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(dispatchSpy).toHaveBeenCalled();
    const callArgs = dispatchSpy.mock.calls[0][0];
    expect(callArgs.orderId).toBe('order-123');
    expect(callArgs.riderId).toBe('rider-456');
  });

  it('should handle complete order lifecycle', async () => {
    const confirmedSpy = jest.spyOn(dispatchService, 'handleOrderConfirmed');
    const statusSpy = jest.spyOn(dispatchService, 'handleOrderStatusUpdated');
    const riderSpy = jest.spyOn(dispatchService, 'handleOrderRiderAssigned');

    // Create order
    const result = await ordersService.create({
      hospitalId: 'hospital-789',
      bloodType: 'AB+',
      quantity: 1,
      deliveryAddress: '789 Medical Center',
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    const orderId = result.data.id;

    // Assign rider
    await ordersService.assignRider(orderId, 'rider-999');
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Update status
    await ordersService.updateStatus(orderId, 'delivered');
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(confirmedSpy).toHaveBeenCalledTimes(1);
    expect(riderSpy).toHaveBeenCalledTimes(1);
    expect(statusSpy).toHaveBeenCalledTimes(1);
  });

  it('should verify DispatchModule has no imports from OrdersModule', () => {
    // Verify that DispatchService constructor doesn't inject OrdersService
    const constructorParams = Reflect.getMetadata(
      'design:paramtypes',
      DispatchService,
    ) || [];

    const hasOrdersServiceDependency = constructorParams.some(
      (param: any) => param?.name === 'OrdersService',
    );

    expect(hasOrdersServiceDependency).toBe(false);
  });
});
