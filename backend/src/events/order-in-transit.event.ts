export class OrderInTransitEvent {
  constructor(
    public readonly orderId: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}
