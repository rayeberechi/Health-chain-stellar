export interface ForecastThreshold {
  bloodType: string;
  region: string;
  daysThreshold: number;
}

export interface DemandForecast {
  bloodType: string;
  region: string;
  currentStock: number;
  averageDailyDemand: number;
  projectedDaysOfSupply: number;
}
