export class OrderCancelledEvent {
  constructor(
    public readonly orderId: string,
    public readonly hospitalId: string,
    public readonly reason: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}
