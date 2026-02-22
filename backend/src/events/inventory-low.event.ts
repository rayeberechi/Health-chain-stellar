export class InventoryLowEvent {
  constructor(
    public readonly bloodType: string,
    public readonly region: string,
    public readonly currentStock: number,
    public readonly projectedDaysOfSupply: number,
    public readonly averageDailyDemand: number,
    public readonly threshold: number,
  ) {}
}
