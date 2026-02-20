export class OrderStatusUpdatedEvent {
  constructor(
    public readonly orderId: string,
    public readonly previousStatus: string,
    public readonly newStatus: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}
