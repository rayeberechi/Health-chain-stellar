export class OrderConfirmedEvent {
  constructor(
    public readonly orderId: string,
    public readonly hospitalId: string,
    public readonly bloodType: string,
    public readonly quantity: number,
    public readonly deliveryAddress: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}
