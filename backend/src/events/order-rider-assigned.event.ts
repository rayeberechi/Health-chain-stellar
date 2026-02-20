export class OrderRiderAssignedEvent {
  constructor(
    public readonly orderId: string,
    public readonly riderId: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}
